//供 unit-e2ePorts 以子行程載入 e2e-setup.mjs，並以「假 dev server」跑一次前端服務的啟動與收尾(配套工具, 非測試檔)。
//驗證: ①baseUrl／dev server 命令列／假服務所收到之埠皆等於保留後之實際埠 ②他人占用時不沿用、不下殺、不對占用者發任何請求(搶走情境除外) ③cleanup 只殺自己 spawn 之行程。
//  輸出最後一行: @@RESULT <JSON>
//  環境變數 FV309_GATE_DIR: 設定時, 保留完成(import 之後)先寫 <dir>/reserved.json，再等 <dir>/go 出現才啟動服務(上限 60 秒)——
//    供測試端在「保留之後、綁定之前」把保留埠占走(規格 E5)。
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { baseUrl, createE2eServices, devServerArgs, checkDevServerTail, trackDevServer, startServers } from '../e2e-setup.mjs'
import { FRONTEND_PORT, reservation } from './e2ePorts.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const fakeScript = path.join(here, 'e2eFakeDevServer.mjs')
//vue-cli 於首編完成後印出之網址行(樣本; 主機以變數組入, 不在測試碼寫死「主機:埠」)
const HOST = '127.0.0.1'
const localLine = (port) => `  - Local:   http://${HOST}:${port}/ \n`
const networkLine = (port) => `  - Network: http://${HOST}:${port}/\n`
//以 ChildProcess 之結束狀態判斷存活(不以 PID 存在性: PID 可能被回收)
const running = (c) => c.exitCode === null && c.signalCode === null

const spawned = []
const children = []
//FV309_FAKE_DELTA: 假服務印出之 Local 埠 = 實際埠 + delta(非 0 仿 portfinder 靜默改埠, 供 startServers 核對之負向案例)
//FV309_USE_STARTSERVERS=1: 以 e2e-setup 的 startServers(含核對實際綁定埠)啟動, 否則只用管理器 startServersOnce
const delta = process.env.FV309_FAKE_DELTA || '0'
const useStartServers = process.env.FV309_USE_STARTSERVERS === '1'
const services = createE2eServices({
    spawnFrontend: ({ port }) => {
        const c = spawn(process.execPath, [fakeScript, String(port), delta], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
        spawned.push({ port, pid: c.pid })
        children.push(c)
        return trackDevServer(c, port) //與真 dev server 同一條輸出追蹤(startServers 據以核對實際綁定埠)
    },
})

const gateDir = process.env.FV309_GATE_DIR
if (gateDir) {
    fs.mkdirSync(gateDir, { recursive: true })
    fs.writeFileSync(path.join(gateDir, 'reserved.json'), JSON.stringify({ ports: reservation.ports, offset: reservation.offset }))
    const t0 = Date.now()
    while (!fs.existsSync(path.join(gateDir, 'go')) && Date.now() - t0 < 60000) {
        await new Promise((r) => setTimeout(r, 100))
    }
}

const result = {
    base: FRONTEND_PORT,
    reservedPorts: reservation.ports,
    offset: reservation.offset,
    source: reservation.source,
    env: { E2E_PORT_OFFSET: process.env.E2E_PORT_OFFSET === undefined ? null : process.env.E2E_PORT_OFFSET },
    baseUrl,
    devServerArgsFor9999: devServerArgs(9999),
    //dev server 實際綁定埠之核對(vue-cli portfinder 於埠被搶走時靜默改埠; checkDevServerTail 由輸出之 Local 網址判定)
    tailChecks: {
        ok: checkDevServerTail(`${String.fromCharCode(27)}[2K DONE  Compiled successfully\n  App running at:\n${localLine(8180)}${networkLine(8180)}`, 8180),
        mismatch: checkDevServerTail(`  App running at:\n${localLine(8181)}`, 8180),
        unknown: checkDevServerTail('[3%] setup (watch run)\n[7%] setup (compile)\n', 8180),
        lastWins: checkDevServerTail(`${localLine(8181)}${localLine(8180)}`, 8180),
    },
}
try {
    if (useStartServers) await startServers({ manager: services, verifyTimeoutMs: 3000 })
    else await services.startServersOnce()
    const res = await fetch(baseUrl + '/')
    result.ok = true
    result.body = await res.text()
    result.spawned = spawned.map((s) => ({ ...s }))
    result.state = services.state('frontend')
}
catch (err) {
    result.ok = false
    result.error = String(err && err.message ? err.message : err)
    result.spawned = spawned.map((s) => ({ ...s }))
}
finally {
    services.cleanup()
}
//cleanup 為同步送出終止; 以條件(全部自建行程已結束,上限 15 秒)等待 exit 事件,不以固定延時後即斷言
for (const t0 = Date.now(); children.some(running) && Date.now() - t0 < 15000;) {
    await new Promise((r) => setTimeout(r, 100))
}
result.spawnedAliveAfterCleanup = children.map((c) => running(c))
console.log('@@RESULT ' + JSON.stringify(result))
