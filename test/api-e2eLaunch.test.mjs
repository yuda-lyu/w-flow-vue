/**
 * e2e 啟動點之真路徑(排程第 442 項; R-PW-WIRING「至少一案走真路徑」): 經 w-playwright 實際啟動 headless shell 一次並關閉。
 *
 * 只啟動 headless shell(無頭、不給通道與執行檔): 不啟動真 Chrome／Edge／完整 Chromium, 不觸發登入守門之讀取。
 * 替身只記錄 w-playwright 合併後之選項, 再以 next() 走真 Playwright, 故同時證明「替身確被呼叫」與「真路徑可啟動」。
 */
import path from 'path'
import { spawnSync } from 'child_process'
import { readE2eBudgets } from './tools/jestBudgets.mjs'

//時限(取自共用常數, 不自寫數字; 排程第 651 項): 真路徑之子行程先 ensureE2eBrowser(首次安裝, 預算 INSTALL_BUDGET_MS)再啟動(啟動逾時另計);
//  已安裝者只做檢查(約 1 秒)。此兩段串行之最壞時間即 w-playwright 之 LAUNCH_HOOK_TIMEOUT_MS(內含安裝預算、結束安裝子行程樹之等待、啟動逾時與餘裕)
//  (排程第 632 項: 啟動一律 autoInstall: false, 安裝不隱式發生在每案之啟動時限內)
const BUDGET = readE2eBudgets().launchHookTimeout

jest.setTimeout(BUDGET + 10000)

const projRoot = path.resolve(__dirname, '..')
const CHILD = path.join(__dirname, 'tools', 'e2eLaunchChild.mjs')

describe('EL-5 真路徑: 經 w-playwright 啟動 headless shell', () => {
    test('啟動點經 w-playwright(替身被呼叫 1 次, 含守門選項)並真的啟動、取得版本、關閉', () => {
        const r = spawnSync(process.execPath, [CHILD, 'real'], { cwd: projRoot, encoding: 'utf8', windowsHide: true, timeout: BUDGET })
        const line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
        if (!line) throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
        const out = JSON.parse(line.slice('RESULT:'.length))
        //子行程把啟動出口之拒絕記入 errCode／errMsg(不崩潰); 先斷言無拒絕, 失敗時才看得到原因(不只見版本為空)
        expect({ errCode: out.errCode, errMsg: out.errMsg }).toEqual({ errCode: null, errMsg: '' })
        //真 Browser 經啟動後鉤子掛上本地副本路由、恰 1 次(R-CDN-01; 排程第 651 項)
        expect(out.routed).toBe(true)
        expect(out.routeCalls).toBe(1)
        expect(out.calls).toBe(1)
        expect(out.seen[0].args[out.seen[0].args.length - 1]).toMatch(/^--disable-features=.*AutofillAiWalletPrivatePasses/)
        expect(out.seen[0].channelUndefined && out.seen[0].executablePathUndefined).toBe(true)
        expect(out.version).toMatch(/^\d+\.\d+/)
    })
})
