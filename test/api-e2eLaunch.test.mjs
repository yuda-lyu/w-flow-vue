/**
 * e2e 啟動點之真路徑(排程第 442 項; R-PW-WIRING「至少一案走真路徑」): 經 w-playwright 實際啟動 headless shell 一次並關閉。
 *
 * 只啟動 headless shell(無頭、不給通道與執行檔): 不啟動真 Chrome／Edge／完整 Chromium, 不觸發登入守門之讀取。
 * 替身只記錄 w-playwright 合併後之選項, 再以 next() 走真 Playwright, 故同時證明「替身確被呼叫」與「真路徑可啟動」。
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

//時限: 真路徑之子行程先 ensureE2eBrowser(首次安裝之預算 PW_INSTALL_BUDGET_MS, 自原始碼取, 單一來源)再啟動; 已安裝者只做檢查(約 1 秒)
//  (排程第 632 項: 啟動一律 autoInstall: false, 安裝不隱式發生在 150 秒之測試時限內)
const BUDGET = Number(/PW_INSTALL_BUDGET_MS = (\d+)/.exec(fs.readFileSync(path.join(__dirname, 'tools', 'e2eLaunch.mjs'), 'utf8'))[1])

jest.setTimeout(BUDGET + 150000)

const projRoot = path.resolve(__dirname, '..')
const CHILD = path.join(__dirname, 'tools', 'e2eLaunchChild.mjs')

describe('EL-5 真路徑: 經 w-playwright 啟動 headless shell', () => {
    test('啟動點經 w-playwright(替身被呼叫 1 次, 含守門選項)並真的啟動、取得版本、關閉', () => {
        const r = spawnSync(process.execPath, [CHILD, 'real'], { cwd: projRoot, encoding: 'utf8', windowsHide: true, timeout: BUDGET + 140000 })
        const line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
        if (!line) throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
        const out = JSON.parse(line.slice('RESULT:'.length))
        expect(out.calls).toBe(1)
        expect(out.seen[0].args[out.seen[0].args.length - 1]).toMatch(/^--disable-features=.*AutofillAiWalletPrivatePasses/)
        expect(out.seen[0].channelUndefined && out.seen[0].executablePathUndefined).toBe(true)
        expect(out.version).toMatch(/^\d+\.\d+/)
    })
})
