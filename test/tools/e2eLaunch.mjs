//e2e 啟動瀏覽器之唯一站點(排程第 442 項; 規則帳本 R-WPW-LAUNCH-01)與其取得點(排程第 632 項; R-WPW-INSTALL-01)。
//
//一律經自有套件 w-playwright 啟動(本套件不直接依賴 playwright／playwright-core): w-playwright 於每次啟動合併出恰一串 `--disable-features`
//(Playwright 預設清單＋守門功能 AutofillAiWalletPrivatePasses＋呼叫端自給者), 避免 Windows 上 Chromium 系瀏覽器每啟動一個新根行程即以
//錯誤密碼替目前使用者登入一次、累積而鎖住帳號。
//
//本站點不傳 headless／channel／executablePath: 與修前 `chromium.launch()` 同為無頭之 headless shell(不是真 Chrome／Edge／完整 Chromium),
//Playwright 版本與預設參數不變, 標準圖(test/pics)不受影響; 守門僅多停用一個與繪製無關之功能。
//
//安裝(R-WPW-INSTALL-01): 受管瀏覽器(Playwright 之 headless shell)缺檔時, 由 ensureE2eBrowser() 於開跑最前集中取得一次(時限為 INSTALL_BUDGET_MS),
//啟動(launchE2eBrowser)一律 autoInstall: false——缺檔即 E_BROWSER_MISSING, 不在每個 case 之啟動中隱式安裝(隱式安裝無明確時限, 且混在 case 之計時內)。
//凡啟動瀏覽器之入口(e2e-flow 之 run、e2eLaunchChild 之真路徑、e2eCdnChild 之 page 模式)須先 await ensureE2eBrowser()。
//
//CDN(R-CDN-01; 排程第 651 項): 路由由 e2eCdn.mjs 載入時以 wpw.onBrowserCreated 註冊之啟動後鉤子於 wpw.launchChromium 回傳前掛上(頁面不連 CDN),
//本函式不自行掛路由、只斷言 cdn.isRouted(漏接即關閉並拋); 回傳之 browser 一律已掛路由。import e2eCdn.mjs 之 cdn 即確保鉤子已註冊。
//
//接線測試見 unit-e2eLaunch(替身接住, 不啟動瀏覽器)與 api-e2eLaunch(真路徑, 啟動 headless shell 一次); 配套子行程 e2eLaunchChild.mjs。
import wpw from 'w-playwright'
import { cdn } from './e2eCdn.mjs'

/**
 * 首次取得 Playwright 受管瀏覽器(headless shell)之時限預算(毫秒), ensureE2eBrowser 之逾時取自本值
 *
 * 取自 w-playwright 之共用常數 wpw.INSTALL_BUDGET_MS(單次安裝之整體預算, 取值依據與推導見其 README〈安裝預算與建議之 before 時限〉), 本檔不自行定義數值,
 * w-playwright 改值時隨之改變。逾本預算即由 ensureChromium 結束安裝子行程樹並 reject, 測試明確失敗而不無限等待。
 * 已知取捨: 多行程並行首次安裝時, 等候者另受 Playwright 自身之安裝鎖等候上限約束(實測約 7.8 分鐘), 持鎖者之下載超過此時間(極慢網路)時, 等候者以安裝子行程離開碼 1 失敗
 */
const INSTALL_BUDGET_MS = wpw.INSTALL_BUDGET_MS

//同行程記憶(Promise); 失敗亦記住(取得失敗即該次執行失敗, 不於同一行程內重跑整個預算)
let pmEnsure = null

//Playwright 之 Downloading 行在標題與 from 之間帶淡色碼; 以 ESC 字元(27)組出, 不把控制字元寫進正則字面
const reAnsi = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')

async function doEnsure() {
    const t0 = Date.now()
    let downloads = 0
    let tail = '' //安裝子行程輸出之尾段, 失敗時印出供診斷
    console.log(`[e2e-browser] pid=${process.pid} 開始取得受管瀏覽器(預算${INSTALL_BUDGET_MS}ms)`)
    try {
        const r = await wpw.ensureChromium({
            timeout: INSTALL_BUDGET_MS,
            funLog: (label, safe, detail) => {
                if (label !== 'install-output') {
                    return
                }
                const s = String(detail).replace(reAnsi, '')
                tail = (tail + s).slice(-2000)
                for (const m of s.matchAll(/Downloading (.+?) from /g)) {
                    downloads++
                    console.log(`[e2e-browser] pid=${process.pid} 真下載: ${m[1]}`)
                }
            },
        })
        const ms = Date.now() - t0
        console.log(`[e2e-browser] pid=${process.pid} 瀏覽器已備妥(${r.kind}), 耗時${ms}ms, 本行程之安裝子行程真下載${downloads}項`)
        return { kind: r.kind, ms, downloads }
    }
    catch (err) {
        console.log(`[e2e-browser] pid=${process.pid} 取得失敗(code=${err && err.code}), 耗時${Date.now() - t0}ms, 安裝子行程輸出尾段:\n${tail}`)
        throw err
    }
}

/**
 * 集中取得 Playwright 受管瀏覽器(headless shell), 同一行程只執行一次(並行呼叫共用同一 Promise)
 *
 * 呼叫 w-playwright 之 ensureChromium({ timeout: INSTALL_BUDGET_MS }); 已安裝者 Playwright 不重複下載, 只做檢查; 跨行程之安裝鎖由 Playwright 負責, 至多一個行程真下載。
 * 輸出 `[e2e-browser]` 行: 開始、每項真下載(Playwright 輸出之 Downloading)、完成(含耗時與真下載項數)、失敗(含輸出尾段), 供事後以輸出點算真下載次數;
 * Playwright 於環境變數 npm_config_loglevel 為 silent、error、warn 時不印 Downloading, 此時項數恆為 0, 須改以瀏覽器目錄內產物核對。
 *
 * 失敗(含逾時)亦被記住: 同一行程再呼叫得到同一個 rejected Promise, 不重跑整個預算。
 *
 * @returns {Promise} 回傳 Promise, resolve 回傳 { kind, ms, downloads }, reject 回傳 w-playwright 之 E_INSTALL 錯誤(含逾時)
 */
function ensureE2eBrowser() {
    if (pmEnsure === null) {
        pmEnsure = doEnsure()
    }
    return pmEnsure
}

/**
 * 啟動 e2e 用之瀏覽器(Promise<Browser>); 每個 case 各呼叫一次, 由呼叫端負責 close; 回傳者已掛 CDN 本地副本路由; 啟動不安裝(見檔首說明)
 *
 * 路由由 e2eCdn.mjs 註冊之啟動後鉤子於 wpw.launchChromium 回傳前掛上(鉤子失敗時 w-playwright 先關閉瀏覽器再以 E_LAUNCH_HOOK 拒絕, 原錯誤由 funLog 印出);
 * 此處只斷言已掛(鉤子被還原或未註冊之漏接於此失敗閉鎖, 免 e2e 靜默改連外網)
 */
async function launchE2eBrowser() {
    const browser = await wpw.launchChromium({
        autoInstall: false,
        funLog: (label, safe, detail) => {
            if (label === 'hook-error') {
                console.log(`[e2e-browser] pid=${process.pid} 啟動後鉤子失敗(掛 CDN 本地副本路由): ${detail && detail.code ? `[${detail.code}] ` : ''}${detail && detail.message}`)
            }
        },
    })
    if (!cdn.isRouted(browser)) {
        await browser.close().catch(() => {})
        throw new Error('瀏覽器未掛 CDN 本地副本路由(漏接)')
    }
    return browser
}

export default launchE2eBrowser
export { INSTALL_BUDGET_MS, ensureE2eBrowser }
