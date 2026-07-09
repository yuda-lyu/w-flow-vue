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
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

//一律用 127.0.0.1 不用 localhost: webpack-dev-server 只綁 IPv4, 瀏覽器解析 localhost
//會先試 IPv6 ::1 → 失敗回退 → 每次連線多 ~155ms(Happy-Eyeballs 回退延遲)。
const baseUrl = 'http://127.0.0.1:8080'

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

export { baseUrl, captureStable, assertBaselineMatch }
