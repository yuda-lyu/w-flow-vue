/**
 * ./testPending 失敗證據之盤點(配套工具, 非測試檔): 判斷哪些事件「已處理完」可清。
 *
 * 用法(於專案根): node test/tools/pendingAudit.mjs
 * 前提: 先跑一次全套 e2e 且全數通過(已處理完之第一個條件是「該圖現在通過」, 本工具不跑 e2e)。
 *
 * 事件 = 同一「標籤__時間戳」之 capture / baseline / diff。逐事件比對當時之 baseline 與現行 test/pics/<標籤>.png:
 *   obsolete     現行無此標準圖(案例已改名或移除)            → 可清
 *   rebaselined  當時之 baseline 與現行不同(事後已重產)        → 可清(重產之理由應已記於 spec〈標準圖對照〉或經驗檔)
 *   same-base    baseline 未變而現已通過(靠修程式或為偶發)     → 須先看 diff 圖找出成因(動畫未凍、視口未重設…)才可清;
 *                                                               找不到成因者保留待分析
 * capNow 欄為當時之 capture 對現行 baseline 之差異像素數(pixelmatch, 與 e2e-setup 同參數), 0 表示當時之畫面即現行之真理。
 */
import fs from 'fs'
import path from 'path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const dir = './testPending'
const pics = './test/pics'
if (!fs.existsSync(dir)) {
    console.log('無 ./testPending')
    process.exit(0)
}
const events = {}
for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+)__(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}(?:-\d+)?)__(capture|baseline|diff)\.png$/)
    if (!m) {
        console.log('無法解析(人工判斷):', f)
        continue
    }
    const k = m[1] + '__' + m[2]
    events[k] = events[k] || { label: m[1], ts: m[2], files: {} }
    events[k].files[m[3]] = path.join(dir, f)
}
const read = (p) => PNG.sync.read(fs.readFileSync(p))
const diffCount = (a, b) => {
    if (a.width !== b.width || a.height !== b.height) return `size ${a.width}x${a.height}/${b.width}x${b.height}`
    return pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1, includeAA: false })
}
const count = {}
for (const k of Object.keys(events).sort((x, y) => events[x].ts.localeCompare(events[y].ts))) {
    const e = events[k]
    const cur = path.join(pics, e.label + '.png')
    let cls
    let capNow = '-'
    if (!fs.existsSync(cur)) {
        cls = 'obsolete'
    }
    else {
        const curPng = read(cur)
        const sameBase = !!e.files.baseline && fs.readFileSync(e.files.baseline).equals(fs.readFileSync(cur))
        cls = sameBase ? 'same-base' : 'rebaselined'
        if (e.files.capture) capNow = diffCount(read(e.files.capture), curPng)
    }
    count[cls] = (count[cls] || 0) + 1
    console.log([e.ts, e.label, cls, 'capNow=' + capNow, Object.keys(e.files).sort().join('+')].join(' | '))
}
console.log('events:', Object.keys(events).length, JSON.stringify(count))
