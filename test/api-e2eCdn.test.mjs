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
import path from 'path'
import { spawnSync } from 'child_process'
import { readE2eBudgets } from './tools/jestBudgets.mjs'

const projRoot = path.resolve(__dirname, '..')
const CHILD = path.join(__dirname, 'tools', 'e2eCdnChild.mjs')

//時限(排程第 651 項: 取自共用常數, 不自寫數字): 子行程先取得瀏覽器(首次安裝)再取得 CDN 副本, 兩段於同一子行程內串行, 最壞時間相加:
//  瀏覽器段 = w-playwright 之 LAUNCH_HOOK_TIMEOUT_MS(內含可能遇首次安裝之啟動之建議時限, 已含安裝預算)
//  CDN 副本段 = 共用庫 createCdnLocal 之 CDN_HOOK_TIMEOUT_MS(取得點之最壞時限, 含等候他行程與接手下載)
//  另加載入頁面與負向對照之餘裕 120 秒
const B = readE2eBudgets()
const LIMIT = B.cdnHookTimeout + B.launchHookTimeout + 120000

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
