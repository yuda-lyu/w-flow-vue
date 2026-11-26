# 套件現況(state)

本檔記當前已開發功能之最新狀態:各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本.只記現況,過程寫入 `sgud/exp/experience.md`.

- **最近一次驗證**:2026-11-26(排程第 651 項:e2e 掛路由改經 `w-playwright` 1.0.6 之啟動後鉤子、安裝預算與 jest 時限改引共用常數;只改測試端,`src/`、`package.json` 未動):`npm test` 一次全綠——jest 53 suites／2685 案(前次 2675,新增 10 案)、e2e 363 項(77 張標準圖比對全過,`test/pics` 無變動、`testPending` 無新增);發布包(`npm pack` 解開、複製 `node_modules` 與 CDN 快取,皆無目錄連結)同為 53／2685、363;受影響之 5 個 jest 檔(`unit-e2eCdn`、`unit-e2eLaunch`、`api-e2eCdn`、`api-e2eLaunch`、`unit-e2ePorts`)連跑 5 次全綠(各 70 案);變異 23 項(含修前版)全數擊殺;eslint 0 新增(改動檔於 `--env jest` 下 0 問題);private-guard CLEAN.前一次 2026-11-25(排程第 632 項:受管瀏覽器集中取得、測試不連 CDN;`w-package-tools-e2e` 升 1.0.51):`npm test` 一次全綠——jest 53 suites／2675 案、e2e 363 項(77 張標準圖比對全過,`test/pics` 無變動、`testPending` 無新增);發布包(`npm pack` 解開、複製 `node_modules` 不建連結)同為 53／2675、363;斷網情境(`W_CDN_OFFLINE=1`＋Chromium `--host-resolver-rules` 使外部主機無法解析)363 項全綠、212 筆外部請求全由本地副本回應;清空快取首跑 363 項全綠、快取 14 個內容各下載恰 1 次;空夾模擬未安裝:安裝恰 1 次(3 項,另一並行入口 0 項);eslint 0 新增;private-guard CLEAN.前一次 2026-11-13(e2e 啟動改經 `w-playwright`,排程第 442 項):全套 e2e 363 項全綠(其中 pixel 比對 77 張,於既有容差內全過),jest 51 檔 2644 案全綠,`test/pics` 無變動、`testPending` 無新增;錯誤密碼次數全程 0.前一次 2026-11-05(e2e 埠導入):363 項、jest 49 檔 2630 案全綠.

| 功能 | 規則 | 測試 | 現況與缺口 |
| --- | --- | --- | --- |
| e2e 埠(基準埠 8650 單一定義、被占用時整組位移、不沿用也不下殺非本實例) | R-E2E-PORT-01 | `unit-e2ePorts`、`e2e-flow` | 已做;e2e 自行起停 dev server,並納入 `npm test`(2026-11-05 起),發布與連動都會跑 |
| e2e 啟動瀏覽器一律經自有套件 `w-playwright`(唯一啟動點 `test/tools/e2eLaunch.mjs`;本套件不直接依賴 `playwright`／`playwright-core`) | R-WPW-LAUNCH-01 | `unit-e2eLaunch`、`api-e2eLaunch`、`e2e-flow` | 已做(排程第 442 項,2026-11-13);啟動 headless shell(不觸發登入紀錄),標準圖 0 張改變;README〈Testing (contributors)〉已寫安裝、離線與守門參數 |
| e2e 受管瀏覽器集中取得、啟動不安裝(`ensureE2eBrowser()` 於開跑最前,預算取自 `wpw.INSTALL_BUDGET_MS`〔目前 900000 ms〕;啟動 `autoInstall: false`);jest 真路徑測試之時限取自共用常數 | R-WPW-INSTALL-01(§7.6) | `unit-e2eLaunch` EL-6、`api-e2eLaunch` EL-5 | 已做(排程第 632 項,2026-11-25);2026-11-26(排程第 651 項)預算改引共用常數(原自刻 `PW_INSTALL_BUDGET_MS = 900000` 已移除)、jest 時限經 `jestBudgets.mjs` 取共用常數(不自寫數字);修前隱式安裝站點 2 處(e2e-flow 首案之啟動——無時限;api-e2eLaunch 真路徑——150 秒);已知取捨:等候安裝鎖者受 Playwright 自身重試上限(約 7.8 分鐘)約束 |
| e2e 頁面不連 CDN(`createCdnLocal`:清單 15 網址〔2 釘版 CSS＋字型〕＋2 個未釘版腳本以空腳本供應;快取 `test/_cache/cdn` 不入版控) | R-CDN-01(§7.7) | `unit-e2eCdn` CD-1～CD-6、`api-e2eCdn` CD-7／CD-8、`unit-e2eLaunch` EL-4／EL-7 | 已做(排程第 632 項,2026-11-25);2026-11-26(排程第 651 項)掛路由改經 `w-playwright` 1.0.6 之啟動後鉤子(`e2eCdn.mjs` 頂層註冊 `wpw.onBrowserCreated`,啟動出口只斷言 `cdn.isRouted`;`routeE2eBrowser` 已移除);首次須連網下載副本(之後離線可跑,`W_CDN_OFFLINE=1` 強制離線);回送位址預設放行(收斂為只放自己 dev server 埠為可選,見 §7.7 已知限制④);修前測試於斷網不會轉紅(不偵測外部載入失敗),故「修前紅」以新測試對 HEAD 版程式計 17 案轉紅 |

其餘功能之規則與測試見 `sgud/rule/rulebook.md`.

## 已知缺口

- 無(原載「TIME_WAIT 使基準埠被判為占用」經共用層實測不成立,2026-11-05).
- 可選(非缺陷):e2e 頁面之回送位址放行範圍為任何回送位址之任何埠(共用庫預設),未收斂為只放行自己之 dev server 埠(§7.7 已知限制④).
