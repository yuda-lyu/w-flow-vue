//供 unit-e2eLaunch 以真實子行程驗 ensureE2eBrowser 之取得點(配套工具, 非測試檔): 以替身取代 wpw.ensureChromium(不下載、不啟動瀏覽器),
//回報 ensureE2eBrowser 傳給它之選項(時限須為安裝預算)、同行程只取一次、真下載項數之計算(只計 install-output 且去終端機控制碼)。
//用法: node test/tools/e2eEnsureChild.mjs <ok|fail> ; 輸出最後一行為 `RESULT:<json>`
//  ok:   替身成功; 驗時限、只呼叫 1 次、真下載項數
//  fail: 替身拋 E_INSTALL(逾時); 驗失敗被記住(同行程再呼叫得到同一個 rejected Promise, 不重跑整個預算)、錯誤原樣傳出
import wpw from 'w-playwright'
import { PW_INSTALL_BUDGET_MS, ensureE2eBrowser } from './e2eLaunch.mjs'

const mode = process.argv[2] === 'fail' ? 'fail' : 'ok'
const ESC = String.fromCharCode(27)
const calls = []

//替身(若 w-playwright 之匯出物件不可改, 此處之賦值會拋錯使測試轉紅, 不靜默略過)
wpw.ensureChromium = async (opt) => {
    calls.push({ timeout: opt && opt.timeout, hasFunLog: !!opt && typeof opt.funLog === 'function' })
    if (mode === 'fail') {
        const err = new Error('install timed out')
        err.code = 'E_INSTALL'
        throw err
    }
    //Playwright 之 Downloading 行於標題與 from 之間帶淡色碼; 另給「非 install-output 標籤之 Downloading」與「非 Downloading 行」, 兩者皆不得計入
    opt.funLog('install-output', true, `${ESC}[2mDownloading Chrome Headless Shell 1.2.3 (v1255)${ESC}[22m from https://example.invalid/a\n`)
    opt.funLog('install-output', true, 'Extracting Chrome Headless Shell\n')
    opt.funLog('other-label', true, 'Downloading Should Not Count from https://example.invalid/b\n')
    opt.funLog('install-output', true, 'Downloading FFmpeg (v1013) from https://example.invalid/c\n')
    return { kind: 'headless-shell' }
}

const p1 = ensureE2eBrowser()
const p2 = ensureE2eBrowser()
let r1 = null
let r2 = null
let err1 = null
let err2 = null
try {
    r1 = await p1
}
catch (err) {
    err1 = err
}
try {
    r2 = await p2
}
catch (err) {
    err2 = err
}
const p3 = ensureE2eBrowser()
let err3 = null
try {
    await p3
}
catch (err) {
    err3 = err
}
console.log('RESULT:' + JSON.stringify({
    mode,
    budget: PW_INSTALL_BUDGET_MS,
    calls,
    samePromise: p1 === p2 && p2 === p3,
    sameResult: r1 === r2,
    kind: r1 && r1.kind,
    downloads: r1 && r1.downloads,
    errCodes: [err1, err2, err3].map((e) => (e ? e.code : null)),
}))
