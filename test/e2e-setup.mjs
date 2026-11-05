/**
 * e2e / visual regression 共用層。
 *
 * 架構對齊 w-web-sso(test/e2e-setup.mjs):產製端(generate)與比對端必須 import 同一個
 * captureStable, 兩邊 settle 條件才會一致 —— 否則比對必然失敗。
 *
 * 比對採 pixelmatch(反鋸齒感知 + maxDiffPixels 容差)。曾先試 byte-exact 但實測不穩定,
 * 決策與數據詳 ./e2e核心問題.md。
 */
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import createServiceManager from 'w-package-tools-e2e/src/createServiceManager.mjs'
import resolveE2ePort from 'w-package-tools-e2e/src/resolveE2ePort.mjs'
import probeHttp from 'w-package-tools-e2e/src/probeHttp.mjs'
import registerCleanupHooks from 'w-package-tools-e2e/src/registerCleanupHooks.mjs'
//基準埠與埠保留(排程第 309 項): e2ePorts.mjs 載入時即呼叫 reserveE2ePorts(基準埠有占用時整組位移並寫入 E2E_PORT_OFFSET),
//須早於本檔任何 resolveE2ePort／createServiceManager——ES 模組先評估被匯入者, 故下列匯入早於本檔本體。
import { FRONTEND_PORT, reservation } from './tools/e2ePorts.mjs'

const projRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

//一律用 127.0.0.1 不用 localhost: webpack-dev-server 只綁 IPv4, 瀏覽器解析 localhost
//會先試 IPv6 ::1 → 失敗回退 → 每次連線多 ~155ms(Happy-Eyeballs 回退延遲)。
//埠由保留後之實際埠衍生(未位移時＝FRONTEND_PORT)。
const baseUrl = `http://127.0.0.1:${resolveE2ePort(FRONTEND_PORT)}`

//—— 前端 dev server 之生命週期(排程第 309 項: 原依賴開發者手動 `npm run serve` 於 8080, 現由 e2e 自行起停) ——
//  - dev server 以 --host 127.0.0.1 --port <實際埠> 指定: --host 令其只綁 IPv4(不綁全部位址)。注意 --port 只是 vue-cli portfinder 之「起點」
//    (@vue/cli-service serve.js: portfinder.basePort = args.port; getPortPromise()): 實際埠於 spawn 與綁定之間被搶走時, vue-cli 仍會靜默改用 port+1 而 baseUrl 不變,
//    就緒探測若剛好被搶走者回應就會打到別人的服務——故就緒後以其輸出之 Local 網址核對實際綁定埠(checkDevServerTail), 不符即拋錯(startServers)。
//  - 直接以 node 執行 vue-cli-service(不經 npm／shell): 免 Windows 之 npm.cmd 與多一層行程, 隱藏視窗。
//  - 沿用政策: 實際埠已有回應者, 由套件 createServiceManager 依保留狀態處理——自動換埠(source=auto)時一律拋錯寫明占用者(不沿用、不下殺);
//    手動設 E2E_PORT_OFFSET(source=pinned, 含 0)才沿用既有服務(開發者已起 dev server 之逃生口)。
//  - 本檔不含任何依埠下殺之碼: 只有 createServiceManager.cleanup 殺「自己 spawn 之行程樹」。
const VUE_CLI_BIN = path.join(projRoot, 'node_modules', '@vue', 'cli-service', 'bin', 'vue-cli-service.js')

/** dev server 之 node 命令列參數(埠取實際埠) */
function devServerArgs(port) {
    return [VUE_CLI_BIN, 'serve', '--host', '127.0.0.1', '--port', String(port)]
}

/**
 * 由 dev server 輸出之尾段核對其實際綁定埠(vue-cli 於首編完成後印 `- Local:   http://127.0.0.1:<埠>/`)。
 * 回傳 { state: 'ok' | 'mismatch' | 'unknown', actual }: ok＝與預期埠相同; mismatch＝印出之埠不同(portfinder 改埠); unknown＝尚未見到 Local 網址。
 */
function checkDevServerTail(tail, port) {
    const clean = String(tail).replace(new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[A-Za-z]', 'g'), '') //去 ANSI 控制碼
    const all = [...clean.matchAll(/Local:\s+https?:\/\/[^\s/:]+:(\d+)\//g)]
    if (all.length === 0) return { state: 'unknown', actual: null }
    const actual = Number(all[all.length - 1][1])
    return { state: actual === Number(port) ? 'ok' : 'mismatch', actual }
}

//子行程之 stdout／stderr 只保留末段(避免 buffer 塞滿又不洩漏到測試輸出); 非因 cleanup 而結束且離開碼非 0 時印出尾段
const SPAWN_TAIL_MAX = 4000
//本實例自建之 dev server(供 startServers 核對其實際綁定埠); 沿用既有服務時為 null
let ownDevServer = null

/** 追蹤自建 dev server(stdio 須為 pipe): 保留輸出尾段供 startServers 核對實際綁定埠; 單元測試以假服務經此函數走同一條核對路徑 */
function trackDevServer(child, port) {
    let tail = ''
    const keep = (d) => {
        tail += String(d)
        if (tail.length > SPAWN_TAIL_MAX) tail = tail.slice(tail.length - SPAWN_TAIL_MAX)
    }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    child.on('exit', (code) => {
        //cleanup 以 taskkill 結束行程樹時 code 非 0 或為 null(signal); 僅在尚未進入 cleanup 時印出
        if (!shuttingDown && typeof code === 'number' && code !== 0) {
            console.log(`[e2e-setup] dev server exited unexpectedly (code=${code}, port=${port})\n[output tail]\n${tail}`)
        }
    })
    ownDevServer = { port, getTail: () => tail }
    return child
}

function spawnDevServer({ port }) {
    return trackDevServer(spawn(process.execPath, devServerArgs(port), { cwd: projRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }), port)
}

let shuttingDown = false

/**
 * 建立前端服務管理器。spawnFrontend({ port, projRoot }) 供單元測試以假服務取代真 dev server(驗埠接線); 預設為真 dev server。
 * 就緒判準: HTTP 狀態碼 < 500(dev server 首編完成前請求會被擱置, 探測逾時視為未就緒)。
 */
function createE2eServices({ spawnFrontend = spawnDevServer, log = console.log } = {}) {
    return createServiceManager({
        services: [
            {
                name: 'frontend',
                port: FRONTEND_PORT, //基準埠; 管理器內部已套用位移, spawn 收到之 port 即實際埠
                readyTimeoutMs: 180000,
                startNote: 'webpack 首編較久',
                spawn: ({ port }) => spawnFrontend({ port, projRoot }),
            },
        ],
        probe: (svc) => probeHttp(svc.url, { timeoutMs: 2500, accept: (st) => st > 0 && st < 500 }),
        //已導入埠保留(reservation 明確帶入): 本檔不使用 restart, 亦不開 killForeignOnRestart——任何情形都不依埠下殺他人(規格 E4)
        reservation,
        log,
    })
}

const services = createE2eServices()

/** 啟動前端 dev server(埠經保留與位移; 已有他人占用則拋錯, 不沿用、不下殺); 啟動後核對自建 dev server 實際綁定之埠 */
async function startServers({ verifyTimeoutMs = 15000, manager = services } = {}) {
    await manager.startServersOnce()
    if (!ownDevServer) return //沿用既有服務(E2E_PORT_OFFSET 指定), 無自建輸出可核對
    const t0 = Date.now()
    for (;;) {
        const r = checkDevServerTail(ownDevServer.getTail(), ownDevServer.port)
        if (r.state === 'mismatch') {
            throw new Error(`dev server 實際綁定埠 ${r.actual} 不是預期之 ${ownDevServer.port}(保留後、綁定前該埠被搶走, vue-cli 之 portfinder 靜默改埠); 為免打到別人的服務而中止, 重跑即重選埠`)
        }
        if (r.state === 'ok') return
        if (Date.now() - t0 > verifyTimeoutMs) {
            console.log('[e2e-setup] 警告: 未於 dev server 輸出見到 Local 網址, 無法核對其實際綁定埠')
            return
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
    }
}

/** 同步收尾: 只殺自己 spawn 之 dev server 行程樹(可重複呼叫) */
function cleanup() {
    shuttingDown = true
    services.cleanup()
}

//收尾之兩條觸發來源: 直跑主函式末尾顯式呼叫 cleanup(); exit／SIGINT／SIGTERM 備援(同步殺)
registerCleanupHooks(cleanup)

/**
 * pixel baseline 截圖統一 helper: retry 至連續兩張 byte 一致再回傳。
 * 治 cold-start / CJK glyph lazy rasterization / GPU init / paint timing 等 pixel drift。
 *
 * opts:
 *   clip          — 截圖區域(同 page.screenshot 之 clip); 不給則 fullPage
 *   parkMouse     — 截圖前把滑鼠移到 (0,0) 消除 hover 殘留。預設 true。
 *                   ★ 刻意保留 hover 態之 baseline(node-hovered / edge-hovered)須傳 false,
 *                     否則 hover 效果會在截圖前消失。
 *   initialWaitMs — 等 setTimeout-based delayed-reveal 已 fire(animations:'disabled' 不會
 *                   fast-forward setTimeout, 故此等待必要)
 */
async function captureStable(page, opts = {}) {
    let { maxRetries = 8, intervalMs = 200, initialWaitMs = 800, parkMouse = true, clip = null } = opts

    //animations:'disabled' 讓 finite 動畫跳完、infinite 動畫 reset 回首格。
    //本專案 .vue-flow__edge--animated 為 stroke-dashoffset 無限動畫, 不凍結則每次相位不同 → byte 必不同。
    let shotOpts = { animations: 'disabled' }
    if (clip) shotOpts.clip = clip
    else shotOpts.fullPage = true

    if (parkMouse) {
        await page.mouse.move(0, 0)
    }

    await page.waitForTimeout(initialWaitMs)

    //凍結 inline <svg> 之 SMIL 動畫: animations:'disabled' 只管 CSS, 不影響 SVG <animate>
    await page.evaluate(() => {
        document.querySelectorAll('svg').forEach((svg) => {
            if (typeof svg.pauseAnimations === 'function') {
                svg.pauseAnimations()
                if (typeof svg.setCurrentTime === 'function') svg.setCurrentTime(0)
            }
        })
    })

    //等字型載入完成, 否則 CJK glyph 未光柵化 → 文字區塊 byte 不穩
    await page.evaluate(() => {
        return (document.fonts && typeof document.fonts.ready?.then === 'function') ? document.fonts.ready : Promise.resolve()
    })

    let prev = await page.screenshot(shotOpts)
    for (let i = 0; i < maxRetries; i++) {
        await page.waitForTimeout(intervalMs)
        let curr = await page.screenshot(shotOpts)
        if (curr.equals(prev)) return curr
        prev = curr
    }
    //未 settle 也回傳最後一張, 讓後續比對失敗來揭露真實 flake(而非偽裝穩定)
    return prev
}

/**
 * baseline 比對 + fail 時保留證據到 ./testPending(永不覆蓋)。
 *
 * 比對採 pixelmatch(反鋸齒感知)+ maxDiffPixels 容差, 取代 byte-exact 的 buf.equals:
 * - includeAA:false 會自動偵測並「忽略反鋸齒邊緣像素」(YIQ 感知色差 + AA slope 偵測),
 *   專治 SVG icon / 字型邊緣之次像素 raster 跨 browser session 不決定性。
 * - maxDiffPixels: 允許之最大「真不同」像素數(預設 100)。反鋸齒殘留為個位數~數十;
 *   真 regression(icon 換 / 版面位移 / 顏色變)動輒數百~數千 px, 遠超此值 → 仍被抓到。
 * - 尺寸不同 = 必為真差異(版面/裁切變)→ 直接 fail。
 * - pixel baseline 為補強層, 每 case 仍須以語意斷言為主; 容差只放輔助層。
 *
 * 本專案改用 pixelmatch 之實測依據見 ./e2e核心問題.md:byte-exact 連跑 3 次為 3/0/2 張不穩定,
 * 差異僅 2~32 px 且集中於 @mdi 齒輪 SVG 與曲線邊緣, 最大通道差 ≤54, 肉眼等同。
 *
 * pass 靜默通過; fail 將 capture / baseline / diff 標紅圖存檔(帶 ms timestamp, 絕不覆蓋)後 throw。
 * opts.maxDiffPixels / opts.threshold 可由呼叫端覆寫(預設 100 / 0.1)。
 */
function assertBaselineMatch(buf, baselinePath, label, opts = {}) {
    let { maxDiffPixels = 100, threshold = 0.1 } = opts

    if (!fs.existsSync(baselinePath)) {
        throw new Error(`標準圖不存在: ${baselinePath}(請先執行 node test/generate-visual-baselines.mjs 產製)`)
    }
    let baselineBuf = fs.readFileSync(baselinePath)

    //解碼 PNG → RGBA(pngjs 同步; 保持本函式同步, 呼叫端不需 await)
    let capPng = PNG.sync.read(buf)
    let basePng = PNG.sync.read(baselineBuf)

    let dump = (reason, diffPng) => {
        let dir = './testPending'
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        let safe = (label || path.basename(baselinePath, '.png')).replace(/[^\w.-]/g, '_')
        //ms 精度 timestamp; 同 label 同毫秒撞檔機率近 0, 仍加 -N 後綴保證絕不覆蓋
        let ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 23)
        let stem = `${dir}/${safe}__${ts}`
        let n = 0
        while (fs.existsSync(`${stem}__capture.png`) || fs.existsSync(`${stem}__baseline.png`)) {
            n += 1
            stem = `${dir}/${safe}__${ts}-${n}`
        }
        fs.writeFileSync(`${stem}__capture.png`, buf)
        fs.writeFileSync(`${stem}__baseline.png`, baselineBuf)
        if (diffPng) fs.writeFileSync(`${stem}__diff.png`, PNG.sync.write(diffPng))
        throw new Error(`截圖與標準圖不一致 (${reason}): ${safe} — capture/baseline${diffPng ? '/diff' : ''} 已存 ${stem}__*.png 供 diff`)
    }

    //尺寸不同 = 必為真差異(版面/裁切變); pixelmatch 要求同尺寸, 故直接 fail
    if (capPng.width !== basePng.width || capPng.height !== basePng.height) {
        dump(`尺寸不同 cap=${capPng.width}x${capPng.height} base=${basePng.width}x${basePng.height}`)
    }

    //pixelmatch: 反鋸齒感知比對, 回傳「真不同」像素數(反鋸齒邊緣已被忽略)
    let { width, height } = basePng
    let diffPng = new PNG({ width, height })
    let numDiff = pixelmatch(capPng.data, basePng.data, diffPng.data, width, height, { threshold, includeAA: false })
    if (numDiff <= maxDiffPixels) {
        return //通過: 反鋸齒次像素已忽略, 殘留真差異在容差內
    }
    dump(`diff=${numDiff}px > maxDiffPixels=${maxDiffPixels}`, diffPng)
}

export { baseUrl, captureStable, assertBaselineMatch, startServers, cleanup, createE2eServices, devServerArgs, checkDevServerTail, trackDevServer }
