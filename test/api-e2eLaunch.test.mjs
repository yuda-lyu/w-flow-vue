/**
 * e2e 啟動點之真路徑(排程第 442 項; R-PW-WIRING「至少一案走真路徑」): 經 w-playwright 實際啟動 headless shell 一次並關閉。
 *
 * 只啟動 headless shell(無頭、不給通道與執行檔): 不啟動真 Chrome／Edge／完整 Chromium, 不觸發登入守門之讀取。
 * 替身只記錄 w-playwright 合併後之選項, 再以 next() 走真 Playwright, 故同時證明「替身確被呼叫」與「真路徑可啟動」。
 */
import path from 'path'
import { spawnSync } from 'child_process'

jest.setTimeout(150000)

const projRoot = path.resolve(__dirname, '..')
const CHILD = path.join(__dirname, 'tools', 'e2eLaunchChild.mjs')

describe('EL-5 真路徑: 經 w-playwright 啟動 headless shell', () => {
    test('啟動點經 w-playwright(替身被呼叫 1 次, 含守門選項)並真的啟動、取得版本、關閉', () => {
        const r = spawnSync(process.execPath, [CHILD, 'real'], { cwd: projRoot, encoding: 'utf8', windowsHide: true, timeout: 140000 })
        const line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
        if (!line) throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
        const out = JSON.parse(line.slice('RESULT:'.length))
        expect(out.calls).toBe(1)
        expect(out.seen[0].args[out.seen[0].args.length - 1]).toMatch(/^--disable-features=.*AutofillAiWalletPrivatePasses/)
        expect(out.seen[0].channelUndefined && out.seen[0].executablePathUndefined).toBe(true)
        expect(out.version).toMatch(/^\d+\.\d+/)
    })
})
