# 回饋(feedback)

任務中發現之自有套件、全域技能、全域設定之調整與抽提提案.只增不改:處置結果(已通報、已修、不採納)另記一列並寫明承接哪一列.回饋是紀錄與提案,實際修改走各自之通報管道.

| 日期 | 類別 | 對象 | 內容 | 依據 |
| --- | --- | --- | --- | --- |
| 2026-11-13 | 全域技能 | role-coder-for-test-e2e §3 契約 C1(launch wrapper) | 建議補一句:launch wrapper 須是獨立可被替換之模組(測試接縫),不得只寫在「載入即執行」之 e2e 主檔內;否則「單一包裝套到 N 個呼叫點須逐點接線測試」(role-coder-for-test §1 第 6 條)無從做起.本套件即因主檔 `run()` 於匯入時執行,不得不先抽出 `test/tools/e2eLaunch.mjs` 才能以 `setBrowserTypeForTest` 斷言啟動選項 | `test/e2e-flow.test.mjs` 末段 `run().then(...)`;`test/tools/e2eLaunch.mjs`;`test/unit-e2eLaunch.test.mjs` EL-4 |
| 2026-11-13 | 全域設定 | 遷移派工任務書(一列多包之遷移表) | 設計表將 4 個 Vue 套件併成一列,列出之啟動點檔案(12 檔)多數屬姊妹套件;本套件實際只有 1 個啟動站點,且 `package.json` 本無 `playwright`／`playwright-core` 宣告(「移除兩者」不適用).建議派工時註明「以各套件實際 `git grep` 站點全集為準」,或依套件拆列,免主責 agent 逐項比對才發現不適用 | 本次任務書所引之表列;`git grep -nEi "playwright" HEAD -- package.json src toolg` 命中 0;`git grep -nE "launchChromium" HEAD -- src test toolg package.json` 僅 `test/e2e-flow.test.mjs` 3 行(匯入、說明、呼叫) |
