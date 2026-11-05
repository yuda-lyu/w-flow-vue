/**
 * e2e 埠保留與前端服務接線(排程第 309 項, 2026-11-05 fv309; 規格 C:/opensrcOper/dspec/e2e埠與多套件同跑.md E1～E8; 規則帳本 R-E2E-PORT-01)。
 *
 * 一律以「真實子行程＋真實監聽」驗證(占用者為獨立行程, 子行程為真實 node, 假 dev server 為真實 HTTP 監聽); 與環境無關:
 *  - 占用情境為動態期望: 占得到就占, 占不到(EADDRINUSE: 已被他人占用)視為已占用, 兩者皆預期位移; 位址族不可用(EAFNOSUPPORT)者自位址清單剔除, 其餘照斷言。
 *  - 子行程之保留登錄目錄(E2E_PORT_REG_DIR)指向本檔專屬暫存夾, 不受本機其他套件之預約影響; 位移相關環境變數一律在子行程環境中清除後再依案例設定。
 *  - 沒有以 skip 當常態; 「基準埠空閒則必為基準埠」之斷言以前後兩次實際綁定檢查為條件(中途被他人占走即不適用), 其餘一致性斷言無條件執行。
 *
 * 項目(對應規格):
 *  EP-1  E1/E2: 沒有占用時即基準埠且位移環境變數維持未設; 有他人占用時位移(動態)
 *  EP-2  E2/E4: 占用基準埠(4 種綁定位址)→ 整組位移, 占用者 PID 存在、仍回應、被測碼打到 0 次
 *  EP-3  E2:    兩個行程同時開跑(共用登錄目錄)→ 不會選到同一組
 *  EP-4  E5:    保留之後、綁定之前保留埠被搶走 → 管理器拋錯寫明占用者, 不沿用、不下殺、不 spawn
 *  EP-5  E3/E6: 位移後 baseUrl／dev server 命令列／假服務收到之埠皆為實際埠; cleanup 只殺自己 spawn 者; 占用者 0 次被打到
 *  EP-6  E4:    手動設 E2E_PORT_OFFSET=0(逃生口)時不換埠, 且絕不下殺占用者
 *  EP-7  E5:    dev server 實際綁定埠之核對(vue-cli portfinder 於埠被搶走時靜默改埠, 由其輸出之 Local 網址判定)之判定函數
 *  EP-8  E5:    startServers 於就緒後核對: 一致通過、不一致拋錯(經假 dev server 走與真 dev server 同一條追蹤路徑)
 *  EP-S1 E1:    基準埠字面值只出現在 test/tools/e2ePorts.mjs
 *  EP-S2 E3:    測試碼無寫死 localhost／127.0.0.1 加埠
 *  EP-S3 E4:    測試碼無任何依埠／依名稱下殺站點
 *  EP-S4 E8:    測試碼寫死之監聽埠必在 e2ePorts.mjs 之基準埠或 OTHER_TEST_PORTS 內(avoid 清單與事實一致)
 *  EP-S5 E1/E4: e2e-setup 帶入 reservation、不開 killForeignOnRestart; e2e-flow 起停服務
 */
import fs from 'fs'
import http from 'http'
import net from 'net'
import path from 'path'
import { spawn, execFileSync } from 'child_process'

jest.setTimeout(240000)

const TEST_DIR = __dirname
const TOOLS = path.join(TEST_DIR, 'tools')
const TMP = path.join(TEST_DIR, '_tmp', 'e2ePorts')
const FP_PORTS = path.join(TOOLS, 'e2ePorts.mjs')
const PORTS_SRC = fs.readFileSync(FP_PORTS, 'utf8')
//基準埠與 avoid 清單自 e2ePorts.mjs 原文讀取(本檔不含基準埠字面值, 避免與 EP-S1 自相矛盾)
const BASE = Number(/export const FRONTEND_PORT = (\d+)/.exec(PORTS_SRC)[1])
const AVOID = (/export const OTHER_TEST_PORTS = \[([^\]]*)\]/.exec(PORTS_SRC)[1].match(/\d+/g) || []).map(Number)
const STEP = 100

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const tracked = new Set() //本檔啟動之行程(ChildProcess 物件: 占用者、子行程), afterAll 只終止這些

//以 ChildProcess 自身的結束狀態判斷是否仍在跑(不以 PID 存在性: 已結束之 PID 可能被作業系統回收給別的行程,
//  憑 PID 殺會殺到無關行程——別套件 e2e 同時跑時尤其可能)
const isRunning = (child) => !!child && child.exitCode === null && child.signalCode === null

//終止「本檔自己啟動」且仍在跑之行程樹(占用者、子行程); 已結束者不動
function killChild(child) {
    if (!isRunning(child)) return
    try {
        if (process.platform === 'win32') execFileSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore', windowsHide: true })
        else child.kill('SIGKILL')
    }
    catch (e) {}
}

//實際綁定檢查: 該埠於 4 種位址上是否都可綁(位址族不可用者視為可綁)
function bindFree(port) {
    return new Promise((resolve) => {
        const hosts = ['127.0.0.1', '0.0.0.0', '::', '::1']
        let free = true
        const next = () => {
            if (hosts.length === 0) return resolve(free)
            const h = hosts.shift()
            const s = net.createServer()
            s.once('error', (e) => {
                if (!(e.code === 'EAFNOSUPPORT' || e.code === 'EADDRNOTAVAIL')) free = false
                next()
            })
            s.listen(port, h, () => s.close(() => next()))
        }
        next()
    })
}

//此環境可用之綁定位址(位址族不可用者剔除)
async function usableHosts() {
    const out = []
    for (const h of ['127.0.0.1', '0.0.0.0', '::', '::1']) {
        const ok = await new Promise((resolve) => {
            const s = net.createServer()
            s.once('error', () => resolve(false))
            s.listen(0, h, () => s.close(() => resolve(true)))
        })
        if (ok) out.push(h)
    }
    return out
}

function probe(port, host = '127.0.0.1') {
    return new Promise((resolve) => {
        const req = http.get({ host, port, path: '/', headers: { 'x-fv309-probe': '1' }, timeout: 3000 }, (res) => {
            res.resume()
            res.on('end', () => resolve(res.statusCode))
        })
        req.on('error', () => resolve(null))
        req.on('timeout', () => {
            req.destroy()
            resolve(null)
        })
    })
}

let seq = 0
const tagOf = (name) => `${name}-${process.pid}-${++seq}`

//啟動占用者。回傳 { ok, busyByOther, unavailable, child, log, port }
//  ok: 占到了; busyByOther: 綁定遇 EADDRINUSE(已被他人占用, 視為已占用); unavailable: 位址族不可用(此位址無法占用)
async function startOccupier(port, host, tag) {
    const log = path.join(TMP, `occ-${tag}.log`)
    fs.writeFileSync(log, '')
    const args = [path.join(TOOLS, 'e2ePortsOccupier.mjs'), String(port), log]
    if (host) args.push(host)
    const child = spawn(process.execPath, args, { stdio: 'ignore', windowsHide: true })
    tracked.add(child)
    const t0 = Date.now()
    while (Date.now() - t0 < 15000) {
        const txt = fs.readFileSync(log, 'utf8')
        //只綁 ::1 之占用者須經 ::1 探測(其餘位址經 127.0.0.1 皆可達)
        if (/ listening /.test(txt)) return { ok: true, child, log, port, probeHost: host === '::1' ? '::1' : '127.0.0.1' }
        const m = / error (\w+)/.exec(txt)
        if (m) {
            const code = m[1]
            return { ok: false, busyByOther: code === 'EADDRINUSE', unavailable: code === 'EAFNOSUPPORT' || code === 'EADDRNOTAVAIL', code, child, log, port }
        }
        await sleep(100)
    }
    killChild(child)
    throw new Error('占用者啟動逾時')
}

//占用者狀態: 行程是否仍在(以 ChildProcess 狀態判斷)、是否仍回應、被測碼(非本檔探測)打到幾次與其請求行
async function occupierState(o) {
    const isAlive = isRunning(o.child)
    const status = isAlive ? await probe(o.port, o.probeHost) : null
    const lines = fs.readFileSync(o.log, 'utf8').split(/\r?\n/).filter(Boolean)
    const hits = lines.filter((l) => / hit /.test(l))
    return { alive: isAlive, responds: status !== null, hits: hits.length, hitLines: hits }
}

//跑子行程腳本(真實 node), 回傳 { code, result, out }; result 為最後一行 @@RESULT 之 JSON
function runNode(script, env, timeoutMs = 120000) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join(TOOLS, script)], { cwd: path.dirname(TEST_DIR), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
        tracked.add(child)
        let out = ''
        child.stdout.on('data', (d) => (out += d))
        child.stderr.on('data', (d) => (out += d))
        const timer = setTimeout(() => killChild(child), timeoutMs)
        child.on('exit', (code) => {
            clearTimeout(timer)
            const line = out.split(/\r?\n/).reverse().find((l) => l.startsWith('@@RESULT '))
            resolve({ code, out, result: line ? JSON.parse(line.slice(9)) : null, pid: child.pid })
        })
    })
}

//子行程環境: 清掉位移相關環境變數, 登錄目錄指向本檔專屬暫存夾
function childEnv(regDir, extra = {}) {
    const env = { ...process.env }
    for (const k of ['E2E_PORT_OFFSET', 'E2E_PORT_HOLD', 'E2E_PORT_REG_DIR', 'FV309_HOLD_FILE', 'FV309_GATE_DIR', 'FV309_FAKE_DELTA', 'FV309_USE_STARTSERVERS']) delete env[k]
    env.E2E_PORT_REG_DIR = regDir
    return { ...env, ...extra }
}

const freshReg = (name) => {
    const d = path.join(TMP, `reg-${tagOf(name)}`)
    fs.mkdirSync(d, { recursive: true })
    return d
}

//位移結果之一致性斷言(E1/E2/E6): 位移 = 間距之正整數倍, 實際埠 = 基準埠 + 位移 ≥ 8000, 位移寫入環境變數
function shiftedFailures(r, label) {
    const f = []
    if (!(r && r.source === 'auto')) f.push(`${label}: source 應為 auto, 實得 ${r && r.source}`)
    if (!(r.offset >= STEP && r.offset % STEP === 0)) f.push(`${label}: 位移應為 ${STEP} 之正整數倍, 實得 ${r.offset}`)
    if (r.ports[0] !== BASE + r.offset) f.push(`${label}: 實際埠 ${r.ports[0]} 應為基準埠+位移 ${BASE + r.offset}`)
    if (!(r.ports[0] >= 8000)) f.push(`${label}: 實際埠 ${r.ports[0]} 應 ≥ 8000`)
    if (r.env.E2E_PORT_OFFSET !== String(r.offset)) f.push(`${label}: E2E_PORT_OFFSET 應為 ${r.offset}, 實得 ${r.env.E2E_PORT_OFFSET}`)
    return f
}

beforeAll(() => {
    fs.rmSync(TMP, { recursive: true, force: true })
    fs.mkdirSync(TMP, { recursive: true })
})

afterAll(() => {
    for (const child of tracked) killChild(child) //只殺仍在跑之自建行程(isRunning), 不憑 PID
    fs.rmSync(TMP, { recursive: true, force: true })
})

// ───────────────────────── 真實子行程＋真實監聽 ─────────────────────────

describe('EP 埠保留(真實子行程＋真實監聽)', () => {
    test('EP-1 沒有占用時即基準埠且位移環境變數維持未設; 有他人占用時整組位移(動態期望)', async () => {
        const freeBefore = await bindFree(BASE)
        const r = await runNode('e2ePortsChild.mjs', childEnv(freshReg('ep1')))
        const freeAfter = await bindFree(BASE)
        expect(r.code).toBe(0)
        const x = r.result
        expect(x).not.toBeNull()
        expect(x.base).toBe(BASE)
        expect(x.ports[0]).toBe(BASE + x.offset)
        //一致性(無條件): 位移 0 ⇔ 環境變數未設 ⇔ 實際埠即基準埠; 位移 > 0 時為間距之整數倍
        expect(x.offset === 0).toBe(x.env.E2E_PORT_OFFSET === null)
        expect(x.shifted).toBe(x.offset !== 0)
        if (x.offset !== 0) expect(shiftedFailures(x, 'EP-1')).toEqual([])
        //基準埠前後兩次實際綁定檢查皆空閒 ⇒ 必為基準埠(中途被他人占走即不適用)
        if (freeBefore && freeAfter) {
            expect(x.offset).toBe(0)
            expect(x.env.E2E_PORT_OFFSET).toBeNull()
        }
    })

    //本案排在所有占用情境之前: 後面的案例會在基準埠上留下連線殘留(TIME_WAIT), 使「基準埠空閒」之前提較難成立
    test('EP-5b 沒有占用時 baseUrl 即 http://127.0.0.1:基準埠(與導入前相同); 一致性無條件', async () => {
        const freeBefore = await bindFree(BASE)
        const r = await runNode('e2eServicesChild.mjs', childEnv(freshReg('ep5b')))
        const freeAfter = await bindFree(BASE)
        expect(r.code).toBe(0)
        const x = r.result
        expect(x.ok).toBe(true)
        expect(x.baseUrl).toBe(`http://127.0.0.1:${x.reservedPorts[0]}`)
        expect(x.spawned[0].port).toBe(x.reservedPorts[0])
        expect(x.spawnedAliveAfterCleanup).toEqual([false])
        if (freeBefore && freeAfter) {
            expect(x.offset).toBe(0)
            expect(x.baseUrl).toBe(`http://127.0.0.1:${BASE}`)
        }
    })

    test('EP-2 占用基準埠(4 種綁定位址)→ 整組位移; 占用者 PID 存在、仍回應、被測碼打到 0 次', async () => {
        const hosts = await usableHosts()
        expect(hosts.length).toBeGreaterThan(0)
        const failures = []
        for (const host of hosts) {
            const occ = await startOccupier(BASE, host, tagOf('ep2'))
            if (!occ.ok && !occ.busyByOther) {
                //位址族於此環境不可占用(已由 usableHosts 剔除, 此處為保險): 不構成占用, 不斷言位移
                continue
            }
            try {
                const r = await runNode('e2ePortsChild.mjs', childEnv(freshReg('ep2')))
                if (r.code !== 0 || !r.result) {
                    failures.push(`host=${host}: 子行程失敗 code=${r.code} ${r.out.slice(-300)}`)
                    continue
                }
                failures.push(...shiftedFailures(r.result, `host=${host}`))
                if (occ.ok) {
                    const st = await occupierState(occ)
                    if (!st.alive) failures.push(`host=${host}: 占用者 PID ${occ.child.pid} 已不存在`)
                    if (!st.responds) failures.push(`host=${host}: 占用者不再回應`)
                    if (st.hits !== 0) failures.push(`host=${host}: 占用者被打到 ${st.hits} 次: ${st.hitLines.join(' | ')}`)
                }
            }
            finally {
                killChild(occ.child)
            }
        }
        expect(failures).toEqual([])
    })

    test('EP-3 兩個行程同時開跑(共用登錄目錄)→ 不會選到同一組埠', async () => {
        const reg = freshReg('ep3')
        const gate = path.join(TMP, `hold-${tagOf('ep3')}`)
        const env = childEnv(reg)
        const first = runNode('e2ePortsChild.mjs', { ...env, FV309_HOLD_FILE: gate })
        //等第一個行程完成保留(其預約檔出現)再起第二個
        const t0 = Date.now()
        while (Date.now() - t0 < 60000 && !(fs.existsSync(reg) && fs.readdirSync(reg).some((f) => /^p\d+\.json$/.test(f)))) {
            await sleep(100)
        }
        const second = await runNode('e2ePortsChild.mjs', env)
        fs.writeFileSync(gate, 'release')
        const a = await first
        expect(a.code).toBe(0)
        expect(second.code).toBe(0)
        expect(a.result.ports[0]).not.toBe(second.result.ports[0])
        expect(second.result.offset).not.toBe(a.result.offset)
        //第二個行程因第一個之預約而位移: 位移為間距之整數倍
        expect(second.result.offset % STEP).toBe(0)
    })

    test('EP-6 手動設 E2E_PORT_OFFSET=0(逃生口)時不換埠; 絕不下殺占用者', async () => {
        const occ = await startOccupier(BASE, undefined, tagOf('ep6'))
        try {
            const r = await runNode('e2ePortsChild.mjs', childEnv(freshReg('ep6'), { E2E_PORT_OFFSET: '0' }))
            expect(r.code).toBe(0)
            expect(r.result.source).toBe('pinned')
            expect(r.result.offset).toBe(0)
            expect(r.result.ports[0]).toBe(BASE)
            if (occ.ok) {
                const st = await occupierState(occ)
                expect(st.alive).toBe(true)
                expect(st.responds).toBe(true)
                expect(st.hits).toBe(0) //只保留與告警, 不對占用者發請求
            }
        }
        finally {
            killChild(occ.child)
        }
    })
})

// ───────────────────────── 前端服務接線(假 dev server) ─────────────────────────

describe('EP 前端服務接線(e2e-setup 以假 dev server 實跑起停)', () => {
    test('EP-5 位移後 baseUrl／dev server 命令列／假服務收到之埠皆為實際埠; cleanup 只殺自己 spawn 者; 占用者 0 次被打到', async () => {
        const occ = await startOccupier(BASE, undefined, tagOf('ep5'))
        try {
            const r = await runNode('e2eServicesChild.mjs', childEnv(freshReg('ep5')))
            expect(r.code).toBe(0)
            const x = r.result
            expect(x).not.toBeNull()
            expect(x.ok).toBe(true)
            //占用基準埠(占得到或已被占): 必須位移
            expect(shiftedFailures({ source: x.source, offset: x.offset, ports: x.reservedPorts, env: x.env }, 'EP-5')).toEqual([])
            const port = x.reservedPorts[0]
            expect(port).not.toBe(BASE)
            //E3/E6: baseUrl、假服務收到之 port 引數、實際回應之服務, 三者同一個實際埠
            expect(x.baseUrl).toBe(`http://127.0.0.1:${port}`)
            expect(x.spawned).toHaveLength(1)
            expect(x.spawned[0].port).toBe(port)
            expect(x.body).toBe('fv309-fake-dev-server')
            //真 dev server 之命令列(以 9999 代入): 顯式 --host／--port(免 vue-cli portfinder 靜默改埠)
            const args = x.devServerArgsFor9999
            expect(args.slice(1)).toEqual(['serve', '--host', '127.0.0.1', '--port', '9999'])
            expect(args[0]).toMatch(/vue-cli-service\.js$/)
            //cleanup 只殺自己 spawn 之假服務
            expect(x.spawnedAliveAfterCleanup).toEqual([false])
            if (occ.ok) {
                const st = await occupierState(occ)
                expect(st.alive).toBe(true)
                expect(st.responds).toBe(true)
                expect(st.hits).toBe(0)
            }
        }
        finally {
            killChild(occ.child)
        }
    })

    test('EP-7 dev server 實際綁定埠之核對: Local 網址與預期埠相同為 ok、不同為 mismatch(portfinder 改埠)、未見為 unknown、多個取最後一個', async () => {
        const r = await runNode('e2eServicesChild.mjs', childEnv(freshReg('ep7')))
        expect(r.code).toBe(0)
        const t = r.result.tailChecks
        expect(t.ok).toEqual({ state: 'ok', actual: 8180 })
        expect(t.mismatch).toEqual({ state: 'mismatch', actual: 8181 })
        expect(t.unknown).toEqual({ state: 'unknown', actual: null })
        expect(t.lastWins).toEqual({ state: 'ok', actual: 8180 })
    })

    test('EP-8 startServers 於就緒後核對 dev server 實際綁定埠: 一致則通過; portfinder 靜默改埠(輸出之 Local 埠不等於預期)則拋錯而不繼續跑', async () => {
        const good = await runNode('e2eServicesChild.mjs', childEnv(freshReg('ep8a'), { FV309_USE_STARTSERVERS: '1' }))
        expect(good.code).toBe(0)
        expect(good.result.ok).toBe(true)
        expect(good.result.spawnedAliveAfterCleanup).toEqual([false])
        //假服務綁定預期埠, 但輸出之 Local 埠偏 1(仿 vue-cli 改用 port+1)
        const bad = await runNode('e2eServicesChild.mjs', childEnv(freshReg('ep8b'), { FV309_USE_STARTSERVERS: '1', FV309_FAKE_DELTA: '1' }))
        expect(bad.code).toBe(0)
        expect(bad.result.ok).toBe(false)
        expect(bad.result.error).toMatch(/實際綁定埠 \d+ 不是預期之 \d+/)
        expect(bad.result.error).toMatch(/重跑即重選埠/)
        expect(bad.result.spawnedAliveAfterCleanup).toEqual([false]) //拋錯後 cleanup 仍只殺自建者
    })

    test('EP-4 保留之後、綁定之前保留埠被搶走 → 拋錯寫明占用者, 不沿用、不下殺、不 spawn', async () => {
        const gateDir = path.join(TMP, `gate-${tagOf('ep4')}`)
        const env = childEnv(freshReg('ep4'), { FV309_GATE_DIR: gateDir })
        const running = runNode('e2eServicesChild.mjs', env)
        const t0 = Date.now()
        while (Date.now() - t0 < 60000 && !fs.existsSync(path.join(gateDir, 'reserved.json'))) {
            await sleep(100)
        }
        const reserved = JSON.parse(fs.readFileSync(path.join(gateDir, 'reserved.json'), 'utf8'))
        const port = reserved.ports[0]
        //保留後才起占用者(此時保留埠經驗證為空閒, 理應占得到; 占不到即視為已被他人占走)
        const occ = await startOccupier(port, undefined, tagOf('ep4'))
        try {
            fs.writeFileSync(path.join(gateDir, 'go'), 'go')
            const r = await running
            expect(r.code).toBe(0)
            const x = r.result
            expect(x.ok).toBe(false)
            expect(x.error).toMatch(/保留後被他人占用/)
            expect(x.error).toMatch(/不沿用、不下殺/)
            expect(x.spawned).toEqual([]) //沒有 spawn 任何服務
            if (occ.ok) {
                const st = await occupierState(occ)
                expect(st.alive).toBe(true)
                expect(st.responds).toBe(true)
                //管理器為判斷有無回應必探測 1 次 GET /(套件設計, 非沿用); 之後不得再有請求
                expect(st.hits).toBeLessThanOrEqual(1)
                expect(st.hitLines.every((l) => / hit GET \/$/.test(l))).toBe(true)
            }
        }
        finally {
            killChild(occ.child)
        }
    })

    test('EP-6b 手動設 E2E_PORT_OFFSET=0 且基準埠有他人服務: 沿用(逃生口語意), 但絕不下殺占用者', async () => {
        const occ = await startOccupier(BASE, undefined, tagOf('ep6b'))
        try {
            const r = await runNode('e2eServicesChild.mjs', childEnv(freshReg('ep6b'), { E2E_PORT_OFFSET: '0' }))
            expect(r.code).toBe(0)
            const x = r.result
            expect(x.source).toBe('pinned')
            expect(x.baseUrl).toBe(`http://127.0.0.1:${BASE}`)
            if (occ.ok) {
                //pinned: 基準埠已有回應者即沿用(開發者已起 dev server 之用途), 因此不 spawn、被打到屬預期; 占用者必須仍在
                expect(x.ok).toBe(true)
                expect(x.spawned).toEqual([])
                const st = await occupierState(occ)
                expect(st.alive).toBe(true)
                expect(st.responds).toBe(true)
            }
        }
        finally {
            killChild(occ.child)
        }
    })
})

// ───────────────────────── 靜態守護(原始碼) ─────────────────────────

//去除註解(區塊註解、前有空白或行首之 // 註解; http:// 前為冒號故保留)
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
const listMjs = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => path.join(dir, f))
const SELF = path.join(TEST_DIR, 'unit-e2ePorts.test.mjs')
const ALL_TEST_CODE = [...listMjs(TEST_DIR), ...listMjs(TOOLS)].filter((f) => f !== SELF)

describe('EP 靜態守護', () => {
    test('EP-S1 基準埠字面值只出現在 test/tools/e2ePorts.mjs(可執行碼)', () => {
        const re = new RegExp(`\\b${BASE}\\b`)
        const hits = ALL_TEST_CODE.filter((f) => f !== FP_PORTS && re.test(stripComments(fs.readFileSync(f, 'utf8')))).map((f) => path.relative(TEST_DIR, f))
        expect(hits).toEqual([])
        expect(re.test(stripComments(PORTS_SRC))).toBe(true) //唯一定義處
    })

    test('EP-S2 測試碼無寫死 localhost／127.0.0.1 加埠(須由 resolveE2ePort 衍生)', () => {
        const re = /(localhost|127\.0\.0\.1):\d+/
        const hits = ALL_TEST_CODE.filter((f) => re.test(stripComments(fs.readFileSync(f, 'utf8')))).map((f) => path.relative(TEST_DIR, f))
        expect(hits).toEqual([])
    })

    test('EP-S3 測試碼無任何依埠／依名稱下殺站點(killPortListeners／taskkill／Stop-Process／process.kill／.kill(／wmic／netstat)', () => {
        //process.kill(pid, 0) 為存在探測(訊號 0), 不下殺, 不計
        const re = /killPortListeners|taskkill|Stop-Process|process\.kill\((?![^)]*,\s*0\s*\))|(?<!process)\.kill\(|wmic|netstat/
        const hits = ALL_TEST_CODE.filter((f) => re.test(stripComments(fs.readFileSync(f, 'utf8')))).map((f) => path.relative(TEST_DIR, f))
        expect(hits).toEqual([])
    })

    test('EP-S4 測試碼寫死之監聽埠必在基準埠或 OTHER_TEST_PORTS 內(avoid 清單與事實一致)', () => {
        const allowed = new Set([BASE, ...AVOID])
        const found = []
        for (const f of ALL_TEST_CODE) {
            const code = stripComments(fs.readFileSync(f, 'utf8'))
            for (const m of code.matchAll(/\.listen\(\s*(\d+)/g)) found.push({ file: path.relative(TEST_DIR, f), port: Number(m[1]) })
            for (const m of code.matchAll(/\bport\s*[:=]\s*(\d{4,5})\b/g)) found.push({ file: path.relative(TEST_DIR, f), port: Number(m[1]) })
        }
        const outside = found.filter((x) => !allowed.has(x.port))
        expect(outside).toEqual([])
        //avoid 之每個埠必須被某處實際寫死(清單不得含已不存在之埠, 否則日後無從維護)
        for (const p of AVOID) expect(found.some((x) => x.port === p)).toBe(true)
    })

    test('EP-S5 e2e-setup 帶入 reservation、不開 killForeignOnRestart、baseUrl 由實際埠衍生; e2e-flow 起停服務', () => {
        const setup = stripComments(fs.readFileSync(path.join(TEST_DIR, 'e2e-setup.mjs'), 'utf8'))
        expect(setup).toMatch(/from '\.\/tools\/e2ePorts\.mjs'/)
        expect(setup).toMatch(/createServiceManager\(\{[\s\S]*?\breservation,/)
        expect(setup).not.toMatch(/killForeignOnRestart\s*:\s*true/)
        expect(setup).not.toMatch(/killListeners/)
        expect(setup).toMatch(/const baseUrl = `http:\/\/127\.0\.0\.1:\$\{resolveE2ePort\(FRONTEND_PORT\)\}`/)
        expect(setup).toMatch(/'--port', String\(port\)/) //dev server 顯式 --port(取 spawn 收到之實際埠)
        expect(setup).toMatch(/'--host', '127\.0\.0\.1'/)
        //startServers 於就緒後核對自建 dev server 實際綁定埠(portfinder 靜默改埠時拋錯, EP-7 驗判定函數)
        expect(setup).toMatch(/checkDevServerTail\(ownDevServer\.getTail\(\), ownDevServer\.port\)[\s\S]*?r\.state === 'mismatch'[\s\S]*?throw new Error/)
        const flow = stripComments(fs.readFileSync(path.join(TEST_DIR, 'e2e-flow.test.mjs'), 'utf8'))
        expect(flow).toMatch(/await startServers\(\)/)
        //主函式結束(含失敗)與例外兩條路徑都要 cleanup()(dev server 不殘留)
        expect(flow).toMatch(/\.then\(\(\) => \{\s*cleanup\(\)/)
        expect(flow).toMatch(/\.catch\(\(e\) => \{[^}]*cleanup\(\)/)
        //e2ePorts.mjs 於載入時保留(單一定義處)
        expect(stripComments(PORTS_SRC)).toMatch(/reserveE2ePorts\(\[FRONTEND_PORT\], \{ avoid: OTHER_TEST_PORTS \}\)/)
    })
})
