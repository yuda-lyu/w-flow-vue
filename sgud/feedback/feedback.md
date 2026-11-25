# 回饋(feedback)

任務中發現之自有套件、全域技能、全域設定之調整與抽提提案.只增不改:處置結果(已通報、已修、不採納)另記一列並寫明承接哪一列.回饋是紀錄與提案,實際修改走各自之通報管道.

| 日期 | 類別 | 對象 | 內容 | 依據 |
| --- | --- | --- | --- | --- |
| 2026-11-13 | 全域技能 | role-coder-for-test-e2e §3 契約 C1(launch wrapper) | 建議補一句:launch wrapper 須是獨立可被替換之模組(測試接縫),不得只寫在「載入即執行」之 e2e 主檔內;否則「單一包裝套到 N 個呼叫點須逐點接線測試」(role-coder-for-test §1 第 6 條)無從做起.本套件即因主檔 `run()` 於匯入時執行,不得不先抽出 `test/tools/e2eLaunch.mjs` 才能以 `setBrowserTypeForTest` 斷言啟動選項 | `test/e2e-flow.test.mjs` 末段 `run().then(...)`;`test/tools/e2eLaunch.mjs`;`test/unit-e2eLaunch.test.mjs` EL-4 |
| 2026-11-13 | 全域設定 | 遷移派工任務書(一列多包之遷移表) | 設計表將 4 個 Vue 套件併成一列,列出之啟動點檔案(12 檔)多數屬姊妹套件;本套件實際只有 1 個啟動站點,且 `package.json` 本無 `playwright`／`playwright-core` 宣告(「移除兩者」不適用).建議派工時註明「以各套件實際 `git grep` 站點全集為準」,或依套件拆列,免主責 agent 逐項比對才發現不適用 | 本次任務書所引之表列;`git grep -nEi "playwright" HEAD -- package.json src toolg` 命中 0;`git grep -nE "launchChromium" HEAD -- src test toolg package.json` 僅 `test/e2e-flow.test.mjs` 3 行(匯入、說明、呼叫) |
| 2026-11-25 | 全域技能 | role-coder-for-test §5.3／role-coder-for-test-e2e | 其一:非 mocha(單檔直跑)之 e2e 其隱式安裝站點無 hook 時限(`w-playwright` 之 `ensureChromium` 預設 `timeout: 0` 即不限時),且 jest 內之 `api-` 真路徑子行程為另一站點——「隱式安裝先查實際 hook 與時限」宜補「非 mocha runner 無 hook 時限,站點含 jest 子行程」;其二:修前於斷網下不轉紅(HEAD 流程 363 項全綠、212 筆外部請求被吞),宜補「修前不紅時以請求日誌(`response.serverAddr()` 之 real=yes／no、`requestfailed`)量化,並以新測試對 HEAD 版程式之紅替代」;其三:`routeBrowser` 與 `setBrowserTypeForTest` 不可並用(後者替換非疊放),已有替身之啟動出口宜於出口內直接掛路由 | `test/tools/e2eLaunch.mjs`、`test/tools/e2eCdn.mjs`;`sgud/exp/experience.md` §4 |
| 2026-11-25 | 自有套件 | w-package-tools-e2e `createCdnLocal` | 建議:①提供「依網址指定本機檔」之選項(如 `opt.sources`)或「空腳本」之一級支援(目前須預置快取檔 `<cacheDir>/<空內容 sha256>` 並把網址手補進有效清單,而產生器清單與之矛盾);②提供只放行指定回送埠之設定(目前 `allowLoopback` 為全有或全無,收斂須自寫 `allow` 函數,且埠於 `startServers` 後才知道);③共用庫之 `launchBrowser` 直接經 `w-playwright` 啟動、不掛本地副本路由,宜於文件警示 | `test/tools/e2eCdn.mjs`(`STUB_URLS`、`seedStubs`);`sgud/rule/rulebook.md` §7.7 已知限制④ |
| 2026-11-25 | 全域設定 | 派工任務書(逐套件盤查表) | 盤查稱「隱式安裝發生在 `before`」於本庫不適用(單檔直跑,實際在首案之啟動);建議任務書註明「以各套件實際 `git grep` 站點與 runner 型別為準」;另「修前同情境之紅」於測試不偵測外部載入失敗之套件不成立,宜允許以「新測試對修前程式之紅」替代 | 斷網全跑 363 項全綠(見 `sgud/state/state.md`) |
