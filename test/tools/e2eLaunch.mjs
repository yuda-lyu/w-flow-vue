//e2e 啟動瀏覽器之唯一站點(排程第 442 項; 規則帳本 R-WPW-LAUNCH-01)與其取得點(排程第 632 項; R-WPW-INSTALL-01)。
//
//一律經自有套件 w-playwright 啟動(本套件不直接依賴 playwright／playwright-core): w-playwright 於每次啟動合併出恰一串 `--disable-features`
//(Playwright 預設清單＋守門功能 AutofillAiWalletPrivatePasses＋呼叫端自給者), 避免 Windows 上 Chromium 系瀏覽器每啟動一個新根行程即以
//錯誤密碼替目前使用者登入一次、累積而鎖住帳號。
//
//本站點不傳 headless／channel／executablePath: 與修前 `chromium.launch()` 同為無頭之 headless shell(不是真 Chrome／Edge／完整 Chromium),
//Playwright 版本與預設參數不變, 標準圖(test/pics)不受影響; 守門僅多停用一個與繪製無關之功能。
//
//安裝(R-WPW-INSTALL-01): 受管瀏覽器(Playwright 之 headless shell)缺檔時, 由 ensureE2eBrowser() 於開跑最前集中取得一次(時限對齊 PW_INSTALL_BUDGET_MS),
//啟動(launchE2eBrowser)一律 autoInstall: false——缺檔即 E_BROWSER_MISSING, 不在每個 case 之啟動中隱式安裝(隱式安裝無明確時限, 且混在 case 之計時內)。
//凡啟動瀏覽器之入口(e2e-flow 之 run、e2eLaunchChild 之真路徑、e2eCdnChild 之 page 模式)須先 await ensureE2eBrowser()。
//
//CDN(R-CDN-01): 啟動後經 e2eCdn.routeE2eBrowser 導向本地副本(頁面不連 CDN); 本函式為單一啟動出口, 回傳之 browser 一律已掛路由。
//
//接線測試見 unit-e2eLaunch(替身接住, 不啟動瀏覽器)與 api-e2eLaunch(真路徑, 啟動 headless shell 一次); 配套子行程 e2eLaunchChild.mjs。
import wpw from 'w-playwright'
import { routeE2eBrowser } from './e2eCdn.mjs'

/**
 * 首次取得 Playwright 受管瀏覽器(headless shell)之時限預算(毫秒), ensureE2eBrowser 之逾時取自本值
 *
 * 取值依據:
 * 1. 取得內容: Windows 上為 headless shell 加 ffmpeg 加 winldd 三項, 解開後約 300 MB; 本機(網路快)實測持鎖者約 15 秒、等候安裝鎖者約 17 至 38 秒, 慢網路下可數分鐘
 * 2. w-playwright 自身測試(api-autoInstall)對同一操作(空目錄真下載)給 600000 毫秒, 為單一行程自己下載之時限
 * 3. 多個行程同時首次啟動時, Playwright 之安裝鎖使只有一個行程下載, 其餘等候者須先等持鎖者下載完再各做一次已安裝之檢查, 故取單次下載時限之 1.5 倍: 900000(15 分鐘)
 * 4. 逾本預算即由 ensureChromium 結束安裝子行程樹並 reject, 測試明確失敗而不無限等待(w-playwright 預設不限時)
 * 已知取捨: 等候者另受 Playwright 自身之安裝鎖重試上限約束(約 8 分鐘), 持鎖者之下載超過此時間(極慢網路)時, 等候者以安裝子行程離開碼 1 失敗
 */
const PW_INSTALL_BUDGET_MS = 900000

//同行程記憶(Promise); 失敗亦記住(取得失敗即該次執行失敗, 不於同一行程內重跑整個預算)
let pmEnsure = null

//Playwright 之 Downloading 行在標題與 from 之間帶淡色碼; 以 ESC 字元(27)組出, 不把控制字元寫進正則字面
const reAnsi = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')

async function doEnsure() {
    const t0 = Date.now()
    let downloads = 0
    let tail = '' //安裝子行程輸出之尾段, 失敗時印出供診斷
    console.log(`[e2e-browser] pid=${process.pid} 開始取得受管瀏覽器(預算${PW_INSTALL_BUDGET_MS}ms)`)
    try {
        const r = await wpw.ensureChromium({
            timeout: PW_INSTALL_BUDGET_MS,
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
 * 呼叫 w-playwright 之 ensureChromium({ timeout: PW_INSTALL_BUDGET_MS }); 已安裝者 Playwright 不重複下載, 只做檢查; 跨行程之安裝鎖由 Playwright 負責, 至多一個行程真下載。
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

/** 啟動 e2e 用之瀏覽器(Promise<Browser>); 每個 case 各呼叫一次, 由呼叫端負責 close; 回傳者已掛 CDN 本地副本路由; 啟動不安裝(見檔首說明) */
async function launchE2eBrowser() {
    const browser = await wpw.launchChromium({ autoInstall: false })
    return routeE2eBrowser(browser)
}

export default launchE2eBrowser
export { PW_INSTALL_BUDGET_MS, ensureE2eBrowser }
