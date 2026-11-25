/**
 * e2e 測試不連 CDN 之真路徑(排程第 632 項; R-CDN-01): 真瀏覽器、真本機 HTTP 伺服器、真實之 public/index.html。
 *
 * 經單一啟動出口 launchE2eBrowser 開頁: index.html 之四個外部網址(兩個 CSS、兩個腳本)皆由本地副本回應 200, 圖示字型自本地載入,
 * 未釘版之兩個腳本以空腳本供應(全域 _／wsemi 不存在), 頁面連線 0 違規; 負向對照: 對清單外網址發請求, 違規被記錄且 assertNoViolation 拋 E_CDN_EXTERNAL。
 * 首次執行須能連 CDN 下載副本(之後離線可跑; W_CDN_OFFLINE=1 且快取已備妥時不連網)。
 *
 * 項目:
 *  CD-7  四個外部網址皆 200(經本地副本)、字型自本地載入、空腳本供應、頁面 0 違規、啟動出口已掛路由
 *  CD-8  負向對照: 清單外之外部請求被記錄為違規, assertNoViolation 拋 E_CDN_EXTERNAL(守門確實有效, 非只在共用庫內有效)
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const projRoot = path.resolve(__dirname, '..')
const CHILD = path.join(__dirname, 'tools', 'e2eCdnChild.mjs')

//時限: 首次取得瀏覽器(安裝預算)與 CDN 副本皆可能發生; 安裝預算自原始碼取(單一來源); CDN 副本取得之最壞時限為共用庫建議之取得點時限
//(cdn.hookTimeoutMs, 等候他行程至多 17.5 分、再接手下載 15 分加單檔上限 2 分、餘裕 1 分, 合計 35.5 分; 見共用庫 createCdnLocal 之 CDN_HOOK_TIMEOUT_MS)
const BUDGET_PW = Number(/PW_INSTALL_BUDGET_MS = (\d+)/.exec(fs.readFileSync(path.join(__dirname, 'tools', 'e2eLaunch.mjs'), 'utf8'))[1])
const HOOK_CDN = (17.5 + 15 + 2 + 1) * 60 * 1000
const LIMIT = BUDGET_PW + HOOK_CDN + 120000

jest.setTimeout(LIMIT + 30000)

describe('CD-7／CD-8 真路徑: 頁面不連 CDN', () => {
    let out
    beforeAll(() => {
        const r = spawnSync(process.execPath, [CHILD, 'page'], { cwd: projRoot, encoding: 'utf8', windowsHide: true, timeout: LIMIT })
        const line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
        if (!line) throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)} stdout=${String(r.stdout || '').slice(-800)}`)
        out = JSON.parse(line.slice('RESULT:'.length))
    })

    test('CD-7 啟動出口回傳之瀏覽器已掛本地副本路由', () => {
        expect(out.routed).toBe(true)
    })

    test('CD-7 index.html 之四個外部網址皆由本地副本回應 200(含兩個空腳本)', () => {
        expect(out.externalUrls.length).toBeGreaterThanOrEqual(4)
        for (const u of out.externalUrls) expect(out.byUrl[u]).toBe(200)
    })

    test('CD-7 圖示字型自本地副本載入(mdi 與 fontawesome 各至少一個字型為 loaded)', () => {
        expect(out.fontsLoaded.some((f) => /Material Design Icons/i.test(f))).toBe(true)
        expect(out.fontsLoaded.some((f) => /Font Awesome/i.test(f))).toBe(true)
    })

    test('CD-7 未釘版之兩個腳本以空腳本供應: 全域 _ 與 wsemi 不存在(頁面不依賴上游可變內容)', () => {
        expect(out.globals.underscore).toBe('undefined')
        expect(out.globals.wsemi).toBe('undefined')
    })

    test('CD-7 頁面載入期間 0 筆違規; 本地副本供應次數涵蓋 CSS、腳本與字型(≥ 6)', () => {
        expect(out.violationsOnPage).toBe(0)
        expect(out.served.browser).toBeGreaterThanOrEqual(6)
    })

    test('CD-8 負向對照: 清單外之外部請求被記錄為違規, assertNoViolation 拋 E_CDN_EXTERNAL', () => {
        expect(out.negCode).toBe('E_CDN_EXTERNAL')
        expect(out.negViolations.length).toBe(1)
        expect(out.negViolations[0].kind).toBe('browser')
        expect(out.negViolations[0].url).toContain('cdn-neg.example.invalid')
    })
})
