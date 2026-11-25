//供 unit-e2eCdn／api-e2eCdn 以真實子行程載入 e2eCdn.mjs 並回報(配套工具, 非測試檔)。
//用法: node test/tools/e2eCdnChild.mjs <manifest|page>
//  manifest: 不啟動瀏覽器, 回報有效清單之內容(產生器清單之網址、空腳本網址、各網址於實例之 lookup 結果)
//  page:     真路徑——取得瀏覽器與 CDN 副本(首次連網下載, 其後離線), 以本機 HTTP 伺服器提供真實之 public/index.html(加兩個圖示元素),
//            經單一啟動出口 launchE2eBrowser 開頁, 回報各外部網址之回應、字型載入、全域 _／wsemi、違規數;
//            另對清單外網址發一次請求作負向對照(違規須被記錄)
//輸出最後一行為 `RESULT:<json>`。
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import loadCdnManifest from 'w-package-tools-e2e/src/loadCdnManifest.mjs'
import launchE2eBrowser, { ensureE2eBrowser } from './e2eLaunch.mjs'
import { cdn, ensureE2eCdn, buildManifest, MANIFEST_PATH, STUB_URLS, EMPTY_SHA256 } from './e2eCdn.mjs'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const mode = process.argv[2] === 'page' ? 'page' : 'manifest'
const indexHtml = fs.readFileSync(path.resolve(__dir, '..', '..', 'public', 'index.html'), 'utf8')

//index.html 內 href／src 之外部網址(依出現順序): 先去 HTML 註解(被註解掉之標籤不載入); 引號為雙引號、單引號或無引號; 含協定相對(//host/…)者,
//此類網址無法對應清單之鍵, 會使「清單與頁面無落差」之斷言失敗而被發現(不靜默漏列)
const noComments = indexHtml.replace(/<!--[\s\S]*?-->/g, '')
const externalUrls = [...noComments.matchAll(/(?:href|src)\s*=\s*["']?((?:https?:)?\/\/[^"'\s>]+)/gi)].map((m) => m[1])

async function runManifest() {
    const generated = loadCdnManifest(MANIFEST_PATH)
    const effective = buildManifest()
    return {
        externalUrls,
        generatedUrls: Object.keys(generated.files),
        generatedRoots: generated.roots,
        effectiveUrls: Object.keys(effective.files),
        stubUrls: STUB_URLS,
        emptySha: EMPTY_SHA256,
        lookups: Object.fromEntries(externalUrls.map((u) => [u, cdn.lookup(u)])),
    }
}

async function runPage() {
    //首次取得(瀏覽器與 CDN 副本): 已備妥者只做檢查; 缺檔且離線(W_CDN_OFFLINE=1)時 ensureE2eCdn 拋 E_CDN_OFFLINE_MISSING
    await ensureE2eBrowser()
    await ensureE2eCdn()
    const html = indexHtml.replace('<div id="app"></div>', '<div id="app"><i class="mdi mdi-home"></i> <i class="fa-solid fa-house"></i></div>')
    const srv = http.createServer((req, res) => {
        res.setHeader('content-type', 'text/html; charset=utf-8')
        res.end(html)
    })
    //作業系統配發埠(不寫死); 以物件形式呼叫 listen, 不被 unit-e2ePorts 之 EP-S4(盤點寫死之監聽埠)誤判
    await new Promise((resolve) => srv.listen({ port: 0, host: '127.0.0.1' }, resolve))
    const port = srv.address().port
    const mark = cdn.violationMark()
    const browser = await launchE2eBrowser()
    let out = null
    try {
        const page = await browser.newPage()
        const responses = []
        page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }))
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
        const fontsLoaded = await page.evaluate(async () => {
            await document.fonts.ready
            return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''))
        })
        const globals = await page.evaluate(() => ({ underscore: typeof window._, wsemi: typeof window.wsemi }))
        const byUrl = Object.fromEntries(externalUrls.map((u) => [u, (responses.find((r) => r.url === u) || {}).status || 0]))
        const violationsOnPage = cdn.getViolations().length - mark.n
        //負向對照: 清單外之外部網址(.invalid 不可解析, 路由於解析前攔截)須被記為違規, assertNoViolation 須拋 E_CDN_EXTERNAL
        await page.evaluate(() => fetch('https://cdn-neg.example.invalid/neg.js', { mode: 'no-cors' }).catch(() => null))
        let negCode = null
        try {
            cdn.assertNoViolation(mark)
        }
        catch (err) {
            negCode = err && err.code
        }
        out = {
            routed: cdn.isRouted(browser),
            port,
            byUrl,
            fontsLoaded,
            globals,
            violationsOnPage,
            negCode,
            negViolations: cdn.getViolations().slice(mark.n).map((v) => ({ kind: v.kind, url: v.url })),
            served: cdn.stats().served,
        }
    }
    finally {
        await browser.close()
        srv.close()
    }
    return { externalUrls, ...out }
}

const out = mode === 'page' ? await runPage() : await runManifest()
console.log('RESULT:' + JSON.stringify({ mode, ...out }))
