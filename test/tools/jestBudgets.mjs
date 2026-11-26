//jest 專用: 取得 e2e 之時限常數(排程第 651 項; 配套工具, 非測試檔, 不供 node 直跑——使用 jest(babel 轉成 CJS)才有之 __dirname)。
//時限取自共用常數(w-playwright 之 INSTALL_BUDGET_MS／LAUNCH_HOOK_TIMEOUT_MS、共用庫之 CDN_HOOK_TIMEOUT_MS), 由子行程 e2eBudgetsChild.mjs 同步回報;
//jest 測試檔於頂層呼叫(早於 jest.setTimeout), 同一 helper 只在此定義一次。
import path from 'path'
import { spawnSync } from 'child_process'

const projRoot = path.resolve(__dirname, '..', '..')
const CHILD = path.join(__dirname, 'e2eBudgetsChild.mjs')

/**
 * 取得 e2e 之時限常數(毫秒)
 *
 * @returns {Object} 回傳 { installBudget, wpwInstallBudget, launchHookTimeout, cdnHookTimeout, cdnInstanceHookTimeout }, 各欄意義見 e2eBudgetsChild.mjs; 子行程未回報即拋錯
 */
function readE2eBudgets() {
    const r = spawnSync(process.execPath, [CHILD], { cwd: projRoot, encoding: 'utf8', windowsHide: true, timeout: 60000 })
    const line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
    if (!line) throw new Error(`時限子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
    const out = JSON.parse(line.slice('RESULT:'.length))
    for (const k of ['installBudget', 'wpwInstallBudget', 'launchHookTimeout', 'cdnHookTimeout', 'cdnInstanceHookTimeout']) {
        if (!Number.isSafeInteger(out[k]) || out[k] <= 0) throw new Error(`時限常數 ${k} 無效: ${out[k]}`)
    }
    return out
}

export { readE2eBudgets }
