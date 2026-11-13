# 套件現況(state)

本檔記當前已開發功能之最新狀態:各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本.只記現況,過程寫入 `sgud/exp/experience.md`.

- **最近一次驗證**:2026-11-13(e2e 啟動改經 `w-playwright`,排程第 442 項):全套 e2e 363 項全綠(其中 pixel 比對 77 張,於既有容差內全過),jest 51 檔 2644 案全綠,`test/pics` 無變動、`testPending` 無新增;錯誤密碼次數全程 0.前一次 2026-11-05(e2e 埠導入):363 項、jest 49 檔 2630 案全綠.

| 功能 | 規則 | 測試 | 現況與缺口 |
| --- | --- | --- | --- |
| e2e 埠(基準埠 8650 單一定義、被占用時整組位移、不沿用也不下殺非本實例) | R-E2E-PORT-01 | `unit-e2ePorts`、`e2e-flow` | 已做;e2e 自行起停 dev server,並納入 `npm test`(2026-11-05 起),發布與連動都會跑 |
| e2e 啟動瀏覽器一律經自有套件 `w-playwright`(唯一啟動點 `test/tools/e2eLaunch.mjs`;本套件不直接依賴 `playwright`／`playwright-core`) | R-WPW-LAUNCH-01 | `unit-e2eLaunch`、`api-e2eLaunch`、`e2e-flow` | 已做(排程第 442 項,2026-11-13);啟動 headless shell(不觸發登入紀錄),標準圖 0 張改變;README〈Testing (contributors)〉已寫安裝、離線與守門參數 |

其餘功能之規則與測試見 `sgud/rule/rulebook.md`.

## 已知缺口

- 無(原載「TIME_WAIT 使基準埠被判為占用」經共用層實測不成立,2026-11-05).
