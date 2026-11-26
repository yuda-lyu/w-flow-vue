/**
 * e2e 測試不連 CDN(排程第 632 項; 規則帳本 R-CDN-01; 共用庫 w-package-tools-e2e 之 createCdnLocal)。
 *
 * 本檔不啟動瀏覽器(靜態盤點＋不啟動瀏覽器之子行程); 真頁面路徑見 api-e2eCdn。
 *
 * 項目(各項對應 R-CDN-01 之規則):
 *  CD-1  站點全集:   public/index.html 之全部外部網址(href／src 之 http(s))皆在有效清單內——不是產生器清單(兩個釘版 CSS 與其字型)就是空腳本清單(未釘版之兩個腳本); 清單與頁面無落差
 *  CD-2  清單檢核:   cdn.manifest.json 之 roots 與 cdn.roots.json 一致、根網址皆在 files、每項 sha256 與大小有效、含兩個 CSS 之字型閉包; 未釘版腳本不得在產生器清單內
 *  CD-3  空腳本項目: STUB_URLS 為 index.html 內之網址、有效清單中為 size 0 且 sha256 為空內容之雜湊
 *  CD-4  快取不入版控: .gitignore 含 test/_cache(包內亦不含: 本庫無 .npmignore, 依 .gitignore)
 *  CD-5  單一出口:   routeBrowser 之呼叫與 wpw.onBrowserCreated 之註冊(排程第 651 項: 啟動後鉤子)於非測試檔都只在 e2eCdn.mjs 一處(配套子行程 e2eLaunchChild.mjs 之觀察用探針鉤子除外, 恰 1 處), 且註冊於模組頂層;
 *                    啟動出口 e2eLaunch.mjs 不自行掛路由、只經 import e2eCdn 之 cdn 斷言 cdn.isRouted; 舊之 routeE2eBrowser 已移除
 *  CD-6  runner 接線: e2e-flow 於開跑最前取得(ensureE2eCdn 早於 startServers)、每個 case 前取標記、關閉瀏覽器後斷言無違規
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

jest.setTimeout(120000)

const projRoot = path.resolve(__dirname, '..')
const TOOLS = path.join(__dirname, 'tools')
const CHILD = path.join(TOOLS, 'e2eCdnChild.mjs')

//掃描範圍: test 內之 .mjs(不含 _tmp／_cache／pics／jsons)
const SKIP_DIRS = new Set(['_tmp', '_cache', 'pics', 'jsons', 'node_modules'])
function walk(dir, out) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.isDirectory()) {
            if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name), out)
        }
        else if (/\.mjs$/.test(ent.name)) {
            out.push(path.join(dir, ent.name))
        }
    }
    return out
}
const FILES = walk(__dirname, [])
const rel = (f) => path.relative(projRoot, f).replace(/\\/g, '/')

//去註解(行註解與區塊註解), 供原始碼之結構斷言; 字串內含 // 者(如 https://)以負向後瞻避開
function stripComments(src) {
    return String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
}

function runChild(mode) {
    const r = spawnSync(process.execPath, [CHILD, mode], { cwd: projRoot, encoding: 'utf8', windowsHide: true, timeout: 100000 })
    const line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
    if (!line) throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
    return JSON.parse(line.slice('RESULT:'.length))
}

const readJson = (fp) => JSON.parse(fs.readFileSync(fp, 'utf8'))

describe('CD-1／CD-3 站點全集: index.html 之外部網址皆在有效清單', () => {
    let r
    beforeAll(() => {
        r = runChild('manifest')
    })

    test('防空集合: 盤點抓得到 index.html 之外部網址(含兩個 CSS)', () => {
        expect(r.externalUrls.length).toBeGreaterThanOrEqual(4)
        expect(r.externalUrls.some((u) => /fontawesome-free@[\d.]+\/css\/all\.min\.css$/.test(u))).toBe(true)
        expect(r.externalUrls.some((u) => /@mdi\/font@[\d.]+\/css\/materialdesignicons\.min\.css$/.test(u))).toBe(true)
        //盤點用之正則(與 test/tools/e2eCdnChild.mjs 同形)對 href／src、雙引號／單引號／無引號、協定相對寫法皆命中; 被註解掉之標籤不計; 相對路徑不命中
        const scan = (html) => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/(?:href|src)\s*=\s*["']?((?:https?:)?\/\/[^"'\s>]+)/gi)].map((m) => m[1])
        expect(scan('<link href="https://a.example/x.css"><script src="https://b.example/y.js">').length).toBe(2)
        expect(scan('<script src=\'https://a.example/y.js\'></script><script src=https://b.example/z.js></script>').length).toBe(2)
        expect(scan('<script src="//a.example/y.js"></script>')).toEqual(['//a.example/y.js'])
        expect(scan('<!-- <script src="https://a.example/y.js"></script> --><link href="/x.css"><script src="y.js">').length).toBe(0)
    })

    test('index.html 之每個外部網址皆在有效清單(經 cdn.lookup 取得項目); 無漏列', () => {
        for (const u of r.externalUrls) {
            expect(r.lookups[u]).not.toBeNull()
            expect(r.effectiveUrls).toContain(u)
        }
    })

    test('清單與頁面無落差: 產生器清單之 roots 與空腳本網址合起來恰為 index.html 之外部網址集合(無多列、無漏列)', () => {
        const declared = [...Object.values(r.generatedRoots), ...r.stubUrls].sort()
        expect(declared).toEqual([...r.externalUrls].sort())
    })

    test('CD-3 未釘版之兩個腳本為空腳本項目: size 0、sha256 為空內容之雜湊、不在產生器清單內', () => {
        expect(r.stubUrls.length).toBe(2)
        for (const u of r.stubUrls) {
            expect(r.externalUrls).toContain(u)
            expect(r.generatedUrls).not.toContain(u)
            expect(r.lookups[u].size).toBe(0)
            expect(r.lookups[u].sha256).toBe(r.emptySha)
        }
        expect(r.emptySha).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
        //兩個 CSS 為釘版項目(size > 0)
        for (const u of r.externalUrls.filter((x) => !r.stubUrls.includes(x))) {
            expect(r.lookups[u].size).toBeGreaterThan(0)
        }
    })
})

describe('CD-2 清單檢核', () => {
    const manifest = readJson(path.join(TOOLS, 'cdn.manifest.json'))
    const roots = readJson(path.join(TOOLS, 'cdn.roots.json'))

    test('schema 為 1; roots 與 cdn.roots.json 一致; 每個根網址皆在 files', () => {
        expect(manifest.schema).toBe(1)
        expect(manifest.roots).toEqual(roots)
        expect(Object.keys(roots).length).toBe(2)
        for (const u of Object.values(roots)) expect(Object.keys(manifest.files)).toContain(u)
    })

    test('每項之 sha256 為 64 碼十六進位、大小為正整數; 網址皆為釘版(路徑含 @主.次.修訂版本)之 https 網址', () => {
        for (const [u, e] of Object.entries(manifest.files)) {
            expect(e.sha256).toMatch(/^[0-9a-f]{64}$/)
            expect(Number.isSafeInteger(e.size) && e.size > 0).toBe(true)
            expect(u).toMatch(/^https:\/\/[^/]+\/.*@\d+\.\d+\.\d+\//)
        }
    })

    test('字型閉包: 兩個 CSS 之相對字型(woff2)皆在 files(頁面用到圖示時不連外)', () => {
        const urls = Object.keys(manifest.files)
        expect(urls.some((u) => /fontawesome-free@[\d.]+\/webfonts\/fa-solid-900\.woff2$/.test(u))).toBe(true)
        expect(urls.some((u) => /@mdi\/font@[\d.]+\/fonts\/materialdesignicons-webfont\.woff2/.test(u))).toBe(true)
        expect(urls.length).toBeGreaterThanOrEqual(10)
    })

    test('未釘版腳本(lodash、wsemi)不在產生器清單: 其內容可變, 以 sha256 釘選會於上游變動時拒收', () => {
        for (const u of Object.keys(manifest.files)) {
            expect(u).not.toMatch(/\/lodash\/lodash\.min\.js$/)
            expect(u).not.toMatch(/github\.io\/wsemi\//)
        }
    })
})

describe('CD-4 快取不入版控', () => {
    test('.gitignore 含 test/_cache(快取為下載產物, 不入版控; 發布包無 .npmignore 時依 .gitignore 排除, 有 .npmignore 時亦須含之)', () => {
        const lines = (f) => fs.readFileSync(path.join(projRoot, f), 'utf8').split(/\r?\n/).map((s) => s.trim())
        //發布包(npm pack)不含 .gitignore: 於發布包解開之目錄執行時無此檔可驗, 以發布包內容之核對替代(npm pack --dry-run 之清單不含 test/_cache)
        if (!fs.existsSync(path.join(projRoot, '.gitignore'))) return
        expect(lines('.gitignore')).toContain('test/_cache')
        if (fs.existsSync(path.join(projRoot, '.npmignore'))) {
            expect(lines('.npmignore')).toContain('test/_cache')
        }
    })
})

describe('CD-5 單一出口', () => {
    const code = (f) => stripComments(fs.readFileSync(f, 'utf8'))

    test('防空集合: 去註解函數保留程式碼、去掉註解', () => {
        expect(stripComments('a // x\nb /* y */ c')).not.toMatch(/x|y/)
        expect(stripComments('const u = "https://a.example/x"')).toContain('https://a.example/x')
    })

    test('.routeBrowser( 呼叫於 test 之非測試檔只在 e2eCdn.mjs 一處(含測試檔以外之全部 .mjs; 測試檔只在文字中提及)', () => {
        const hits = []
        for (const f of FILES) {
            if (/\.test\.mjs$/.test(f)) continue
            code(f).split(/\r?\n/).forEach((ln, i) => {
                if (/\.routeBrowser\(/.test(ln)) hits.push(`${rel(f)}:${i + 1}`)
            })
        }
        expect(hits.length).toBe(1)
        expect(hits[0].startsWith('test/tools/e2eCdn.mjs:')).toBe(true)
    })

    test('.onBrowserCreated( 之註冊於 test 之非測試檔只在 e2eCdn.mjs 一處, 且於模組頂層(行首)、處理器內掛路由(failOnClose: false)並預置空腳本(seedStubs)', () => {
        const hits = []
        const probe = []
        for (const f of FILES) {
            if (/\.test\.mjs$/.test(f)) continue
            code(f).split(/\r?\n/).forEach((ln, i) => {
                if (/\.onBrowserCreated\(/.test(ln)) (rel(f) === 'test/tools/e2eLaunchChild.mjs' ? probe : hits).push(`${rel(f)}:${i + 1}`)
            })
        }
        //e2eLaunchChild.mjs 內恰 1 處為驗「路由於鉤子階段已掛上」而註冊之觀察用探針鉤子(不掛路由), 另計; 其餘一切非測試檔(含其他配套子行程)皆計入註冊
        expect(probe.length).toBe(1)
        expect(hits.length).toBe(1)
        expect(hits[0].startsWith('test/tools/e2eCdn.mjs:')).toBe(true)
        const src = code(path.join(TOOLS, 'e2eCdn.mjs'))
        //模組頂層(行首無縮排)之呼叫, 不在函數或條件內(否則 import 本檔不保證註冊)
        expect(/^wpw\.onBrowserCreated\(\w+\)\s*$/m.test(src)).toBe(true)
        //處理器: 以 failOnClose: false 掛路由並預置空腳本
        const m = /function\s+(\w+)\s*\(\s*target\s*\)\s*\{([\s\S]*?)\n\}/.exec(src)
        expect(m).not.toBeNull()
        expect(m[2]).toMatch(/\bseedStubs\(\)/)
        //空腳本之快取檔須先於掛路由預置(掛路由後才預置則首個請求可能先觸發下載而被拒收)
        expect(m[2].indexOf('seedStubs()')).toBeLessThan(m[2].indexOf('cdn.routeBrowser('))
        expect(m[2]).toMatch(/\bcdn\.routeBrowser\(\s*target\s*,\s*\{\s*failOnClose:\s*false\s*\}\s*\)/)
        //須回傳(或 await)routeBrowser 之 Promise: 否則掛失敗成為未處理之 rejection, w-playwright 看不到失敗而啟動照常成功
        expect(m[2]).toMatch(/\b(return|await)\s+cdn\.routeBrowser\(/)
        expect(src).toMatch(new RegExp('^wpw\\.onBrowserCreated\\(' + m[1] + '\\)\\s*$', 'm'))
        //正例防空集合: 行首註冊命中; 縮排在函數內者不命中
        expect(/^wpw\.onBrowserCreated\(\w+\)\s*$/m.test('wpw.onBrowserCreated(routeCreatedBrowser)')).toBe(true)
        expect(/^wpw\.onBrowserCreated\(\w+\)\s*$/m.test('function f() {\n    wpw.onBrowserCreated(routeCreatedBrowser)\n}')).toBe(false)
    })

    test('舊之 routeE2eBrowser 已移除: 非測試檔全無此識別字(啟動出口不再自行掛路由, 免重複)', () => {
        const hits = []
        for (const f of FILES) {
            if (/\.test\.mjs$/.test(f)) continue
            code(f).split(/\r?\n/).forEach((ln, i) => {
                if (/\brouteE2eBrowser\b/.test(ln)) hits.push(`${rel(f)}:${i + 1}`)
            })
        }
        expect(hits).toEqual([])
    })

    test('啟動出口 e2eLaunch.mjs: 以 import e2eCdn 之 cdn 確保鉤子已註冊並斷言 cdn.isRouted; 不呼叫 routeBrowser、不註冊鉤子', () => {
        const src = code(path.join(TOOLS, 'e2eLaunch.mjs'))
        expect(/^import\s*\{\s*cdn\s*\}\s*from\s*'\.\/e2eCdn\.mjs'/m.test(src)).toBe(true)
        expect(src).toMatch(/\bcdn\.isRouted\(\s*browser\s*\)/)
        expect(/\brouteBrowser\b/.test(src)).toBe(false)
        expect(/\bonBrowserCreated\b/.test(src)).toBe(false)
        //漏接時關閉瀏覽器再拋(失敗閉鎖): isRouted 判斷之區塊內有 browser.close 與 throw
        const m = /if\s*\(\s*!cdn\.isRouted\(browser\)\s*\)\s*\{([\s\S]*?)\n {4}\}/.exec(src)
        expect(m).not.toBeNull()
        expect(m[1]).toMatch(/\bawait\s+browser\.close\(\)/)
        expect(m[1]).toMatch(/\bthrow\b/)
    })

    test('e2e 主檔不繞過啟動出口: 無 .launch( 呼叫、不自行掛路由或註冊鉤子', () => {
        const main = code(path.join(__dirname, 'e2e-flow.test.mjs'))
        expect(/\.launch\w*\(/.test(main)).toBe(false)
        expect(/routeE2eBrowser|\.routeBrowser\(|\.onBrowserCreated\(/.test(main)).toBe(false)
    })

    test('不匯入共用庫之 launchBrowser／launchChromium(其內部直接經 w-playwright 啟動, 繞過本地副本路由); 正例防空集合', () => {
        const re = /w-package-tools-e2e\/src\/launch(Browser|Chromium)/
        expect(re.test('import launchBrowser from \'w-package-tools-e2e/src/launchBrowser.mjs\'')).toBe(true)
        expect(re.test('import launchE2eBrowser from \'./tools/e2eLaunch.mjs\'')).toBe(false)
        const hits = []
        for (const f of FILES) {
            if (/test\/(unit|api)-[^/]+\.test\.mjs$/.test(rel(f))) continue //測試檔之說明與正例不計
            code(f).split(/\r?\n/).forEach((ln, i) => {
                if (re.test(ln)) hits.push(`${rel(f)}:${i + 1}`)
            })
        }
        expect(hits).toEqual([])
    })
})

describe('CD-6 runner 接線(e2e-flow 之 run)', () => {
    const main = stripComments(fs.readFileSync(path.join(__dirname, 'e2e-flow.test.mjs'), 'utf8'))
    const body = main.slice(main.indexOf('async function run()'))
    const at = (s) => body.indexOf(s)

    test('取得先於啟動伺服器: await ensureE2eCdn() 在 await startServers() 之前', () => {
        expect(at('await ensureE2eCdn()')).toBeGreaterThan(-1)
        expect(at('await startServers()')).toBeGreaterThan(-1)
        expect(at('await ensureE2eCdn()')).toBeLessThan(at('await startServers()'))
    })

    test('每個 case: 先取標記、再啟動瀏覽器、關閉瀏覽器之後才斷言無違規(標記早於啟動, 啟動之違規亦涵蓋)', () => {
        const iMark = at('cdn.violationMark()')
        const iLaunch = at('await launchE2eBrowser()')
        const iClose = at('await browser.close()')
        const iAssert = at('cdn.assertNoViolation(')
        expect(iMark).toBeGreaterThan(-1)
        expect(iMark).toBeLessThan(iLaunch)
        expect(iLaunch).toBeLessThan(iClose)
        expect(iClose).toBeLessThan(iAssert)
    })

    test('違規使該 case 失敗而不中斷其後各 case: 斷言之 catch 內 record(false, …)', () => {
        const i = at('cdn.assertNoViolation(')
        expect(body.slice(i, i + 400)).toMatch(/catch\s*\(err\)\s*\{\s*record\(false,/)
    })
})
