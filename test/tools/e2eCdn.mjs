//e2e 測試不連 CDN 之橋接檔(規則帳本 R-CDN-01; 排程第 632 項)。
//
//問題: 頁面(public/index.html)載入時自 CDN／github.io 取 CSS 與腳本, 使 e2e 受外網穩定度影響, 且測到之內容隨上游改版而飄。
//作法(不改 public/index.html 與 src, 產品行為不變): 以共用庫 w-package-tools-e2e 之 createCdnLocal 建立本行程唯一之實例 cdn,
//  - 清單 test/tools/cdn.manifest.json(入版控): 兩個釘版之 CSS(fontawesome@6.4.2、@mdi/font@7.4.47)及其相對引用之字型, 含網址、sha256、大小;
//    由 test/tools/cdn.roots.json 經 w-package-tools-e2e 之 tools/genCdnManifest.mjs 產生(命令見規則帳本 R-CDN-01);
//  - 快取 test/_cache/cdn(內容定址, 不入版控、不入包): 首次須能連 CDN 下載並以 sha256 校驗, 之後離線可跑; 環境變數 W_CDN_OFFLINE=1 強制離線(缺檔即拋錯);
//  - 未釘版之兩個腳本(lodash 與 github.io 之 wsemi)內容可變, 以 sha256 釘選會於上游變動時拒收; e2e 之頁面不使用其全域(App 與元件皆以 ESM 匯入並打包),
//    故以空腳本供應(STUB_URLS: 清單項目 size 0、sha256 為空內容之雜湊, 載入時預置快取), 頁面不連外、不依賴可變內容, 也不放行;
//  - 清單外之外部請求一律中止並記錄違規, 由 runner 於每個 case 前後以 violationMark／assertNoViolation 使該 case 失敗;
//    回送位址(dev server 本身、webpack HMR 之 WebSocket)由共用庫預設放行。
//單一啟動出口 test/tools/e2eLaunch.mjs 之 launchE2eBrowser 於啟動後呼叫 routeE2eBrowser(本檔), 全 repo 之 routeBrowser 呼叫只在本檔一處。
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import createCdnLocal from 'w-package-tools-e2e/src/createCdnLocal.mjs'
import loadCdnManifest from 'w-package-tools-e2e/src/loadCdnManifest.mjs'

const __dir = path.dirname(fileURLToPath(import.meta.url))

//清單與快取之位置以檔案位置定位(不隨 process.cwd()), 使各行程共用同一快取與鎖
const MANIFEST_PATH = path.resolve(__dir, 'cdn.manifest.json')
const CACHE_DIR = path.resolve(__dir, '..', '_cache', 'cdn')

//以空腳本供應之網址(內容可變、未釘版, 且 e2e 之頁面不使用其全域); 不得列入 cdn.manifest.json(清單由產生器依實際下載內容釘選, 空腳本項目由本檔補入)
const STUB_URLS = [
    'https://cdn.jsdelivr.net/npm/lodash/lodash.min.js',
    'https://yuda-lyu.github.io/wsemi/dist/wsemi.umd.js',
]

const EMPTY_SHA256 = crypto.createHash('sha256').update('').digest('hex')

//有效清單 = 產生器所產之清單 + 空腳本項目(size 0)
function buildManifest() {
    const m = loadCdnManifest(MANIFEST_PATH)
    const files = { ...m.files }
    for (const u of STUB_URLS) {
        files[u] = { sha256: EMPTY_SHA256, size: 0 }
    }
    return { schema: 1, note: m.note, roots: m.roots, files }
}

//本行程唯一之實例; allowLoopback 用預設(true): 頁面由本機 dev server 提供, webpack HMR 之 WebSocket 亦走回送位址
const cdn = createCdnLocal({ manifest: buildManifest(), cacheDir: CACHE_DIR })

//預置空腳本之快取檔(內容定址: 檔名即空內容之 sha256, 大小 0); 否則取得時會嘗試自網址下載而與空雜湊不符被拒收
function seedStubs() {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    const fp = path.join(CACHE_DIR, EMPTY_SHA256)
    let ok = false
    try {
        ok = fs.statSync(fp).size === 0
    }
    catch (err) {}
    if (!ok) {
        fs.writeFileSync(fp, '')
    }
}

/**
 * 取得清單內之全部檔案(已備妥且校驗相符者不連網; 離線缺檔即拋 E_CDN_OFFLINE_MISSING); 本行程只做一次
 * e2e 為單檔直跑(非 mocha), 無 hook 時限; 取得之時限由共用庫之下載預算約束(cdn.timeouts)
 */
async function ensureE2eCdn() {
    seedStubs()
    await cdn.ensure()
}

//備註: 路由處理器於清單內網址首次被請求時亦會自行 cdn.ensure(); 空腳本之快取檔須先備妥, 故 routeE2eBrowser 亦呼叫 seedStubs(冪等),
//使「啟動瀏覽器之入口未先呼叫 ensureE2eCdn」時不致因空腳本被當成缺檔下載(雜湊不符被拒收, 且失敗被記住而使其後全部本地副本請求連鎖記為違規)

/**
 * 把 browser 導向本地副本(本檔為全 repo 唯一之 routeBrowser 呼叫處); 掛失敗即關閉該 browser 再拋(免瀏覽器子行程使 node 不結束)
 * failOnClose 為 false: 違規不於 browser.close() 時拋出(會中斷 runner 之 finally 與其後各 case), 改由 runner 於每個 case 前後以 cdn.violationMark／cdn.assertNoViolation 斷言
 */
async function routeE2eBrowser(browser) {
    try {
        seedStubs()
        await cdn.routeBrowser(browser, { failOnClose: false })
        if (!cdn.isRouted(browser)) {
            throw new Error('瀏覽器未掛 CDN 本地副本路由(漏接)')
        }
    }
    catch (err) {
        await browser.close().catch(() => {})
        throw err
    }
    return browser
}

export { cdn, ensureE2eCdn, routeE2eBrowser, buildManifest, MANIFEST_PATH, CACHE_DIR, STUB_URLS, EMPTY_SHA256 }
