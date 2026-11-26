//供 jest 測試取得 e2e 之時限常數(配套工具, 非測試檔; 排程第 651 項): 時限一律取自共用常數, 測試端不自寫數字。
//為何用子行程: 共用庫之 CDN_HOOK_TIMEOUT_MS 在 node_modules 內之 ESM, jest 不轉譯該套件; 且須在宣告 jest.setTimeout 之前取得, 故由 jest 端之 test/tools/jestBudgets.mjs 以同步子行程取得。
//用法: node test/tools/e2eBudgetsChild.mjs ; 輸出最後一行為 `RESULT:<json>`
//  installBudget:       e2eLaunch.mjs 匯出之 INSTALL_BUDGET_MS(須等於 wpwInstallBudget)
//  wpwInstallBudget:    w-playwright 之 INSTALL_BUDGET_MS(單次安裝之整體預算)
//  launchHookTimeout:   w-playwright 之 LAUNCH_HOOK_TIMEOUT_MS(內含可能遇首次安裝之啟動之建議時限, 已含安裝預算)
//  cdnHookTimeout:      共用庫 createCdnLocal 之 CDN_HOOK_TIMEOUT_MS(CDN 副本取得之最壞時限)
//  cdnInstanceHookTimeout: 本行程 cdn 實例之 hookTimeoutMs(未自給預算時須等於 cdnHookTimeout)
import wpw from 'w-playwright'
import { CDN_HOOK_TIMEOUT_MS } from 'w-package-tools-e2e/src/createCdnLocal.mjs'
import { INSTALL_BUDGET_MS } from './e2eLaunch.mjs'
import { cdn } from './e2eCdn.mjs'

console.log('RESULT:' + JSON.stringify({
    installBudget: INSTALL_BUDGET_MS,
    wpwInstallBudget: wpw.INSTALL_BUDGET_MS,
    launchHookTimeout: wpw.LAUNCH_HOOK_TIMEOUT_MS,
    cdnHookTimeout: CDN_HOOK_TIMEOUT_MS,
    cdnInstanceHookTimeout: cdn.hookTimeoutMs,
}))
