# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.

## 1. 設計與送審

- **設計對外介面前,第一個對標對象是本套件既有慣例與業主自有元件庫(w-component-vue),不是外部產品**(2026-10-06,最重之教訓):設定彈窗文字我照需求稿與 React Flow 設計成 `opt.nodesSettingsLabels = { groups, fields, options, … }` 物件,還把既有扁平鍵 `nodesSettingsDeleteText` 當舊物移除;雙審也在同一框內優化.業主否決:opt 之顯示文字一律一鍵一字串(`menuLockTooltip` 即慣例),外部逐鍵個別傳入,已說過多次——規範已寫入 CLAUDE.md.根因:①沒把「扁平 vs 物件」列為待決定事項(框從需求稿抄來);②對標清單漏了本套件自己與 w-component-vue;③任務書把框帶給審查者,審查找不到框外的洞.做法:任何新 opt / prop,先 `grep` 既有同類鍵(`git grep -n "@prop" -- src/components/WFlowVue.vue`)與 w-component-vue 之 `@vue-prop` 同類命名,寫下對照再設計.
- **對外介面須展開,內部機制自由**:對外(opt 鍵、元件 prop)逐字展開;內部(`resolveOpt`、WFlowVue → Renderer → Wrapper 之物件下傳再 `v-bind` 展開)依架構與效能決定.兩者不要混為一談——不能因內部方便就把物件推給外部,也不必為了對外扁平而在內部逐層手寫 74 個 prop(2026-10-06 連線補 popupDirection 後之鍵數).
- **寫死之顯示文字是規劃缺陷,要以類別盤點**:被指出「其餘文字寫死」時,範疇是「全套件之顯示文字」,不是那幾句.盤點指令:模板文字節點 `git grep -nP ">[^<>{}]*(\p{Han}|[A-Za-z]{2,})[^<>{}]*<"`、屬性 `title=` / `aria-label=` / `placeholder=`、JS 內英文字串字面值;本輪結果為工具列 6 句(已是 opt)+ 設定彈窗 68 句.
- **送審任務書內每個「數字」與「會怎樣」都要附證據**(2026-10-06,設定彈窗文字):任務書寫了「新增邊型時下拉文字變 `undefined`」,實為 `LABELS[v] || v` 回傳原值;鍵數寫成 27/43/70(實為 26/42/68);工具列 tooltip 漏算 `menuLockTooltipLocked`.三處都被雙審抓到,都是能用一行讀碼或 jest 探針確認、卻憑印象寫的.送審前逐句標 `file:line` 或探針輸出,講不出來的改成推測語氣.
- **下拉選項之文字鍵由值域產生,不手寫完整對照表**:值域在 `SHAPES` / `SIDES` / `EDGE_TYPES` / `MARKER_TYPES`,`settingsTexts` 以之產生 `{類別}TextFor{值}` 鍵與預設(例外表只收 `smoothstep`、`arrowclosed`,其餘 Title Case);表單以值域迭代.鍵集與 spec 表之一致交給單元測試,值域新增值時測試會要求同步 spec 與 README.
- **鍵名組法只寫一處**:`groupTitleProp` / `fieldLabelProp` / `optionTextProp` 在 `settingsTexts`,模板經 `groupTitle()` / `fieldLabel()` / `optItems()` 取用,不在模板拼 `'textLabel' + …`.
- **注入方式依頻率選**:文字、預設值、excludes 屬低頻配置,走 props;getter inject 只給高頻手勢狀態(spec 互動契約 §10).舊的 `getSettingsText` inject 是未登記之例外,本輪已收回.
- **opt 命名族**:依元素區分之設定一律 `nodesSettings*` / `connsSettings*`;文字鍵為 `{nodes|conns}Settings` + w-component-vue 樣式之 prop 名(`…GroupTitle`、`…TextLabel{欄位}`、`…{類別}TextFor{值}`、`…BtnTooltip`、`…TextEmpty`),既有 `nodesSettingsDeleteText` 不改名.
- **移除 opt 不做相容層,但不能無聲**:給了舊鍵(`settingsColorConfirmText`)就 `console.warn` 一次並點名新鍵(不讀值、不生效);`nodesSettings` / `connsSettings` / `settings` 開頭之未知鍵、文字鍵非字串亦警告一次——七十多個扁平鍵拼錯的機率不低,無聲退回英文宿主很難察覺.
- **圖示鈕(＋ / ×)只給 `title` 不夠**:按鈕之可及名稱先取內容,讀屏會念符號;同一文字同時綁 `aria-label`.
- **示範頁掛進 `App.vue` 分頁會改動全頁標準圖**(標籤列多一項):須業主授權後重產.受影響者 = 無 `clip` 之截圖(`grep -nE "await shot\(page, '" test/e2e-flow.test.mjs | grep -v "clip:"`,2026-10-06 為 11 張),**不能靠比對模式找**——短標籤之差異在容差內會全綠(見下條).重產前先備份,重產後逐張算新舊差異之外接框,確認只在標籤列(2026-10-06 業主授權掛 `texts` 分頁,11 張差異皆為同一框).`toolg/gExtractHtml.mjs` 會把 `src/` 下所有檔名含 `App` 者(`App.vue` 除外)自動抽成範例頁,掛不掛分頁都會被發布.
- **表單欄位改了卻沒效果,先 grep 消費端**:`popupDirection` 自初版起只有表單、預設與分群三處,沒有任何消費端(`git log -S` 可證),是「有 prop 卻無效」之半吊子承諾.碰到表單欄位時以 `git grep -n "<欄位鍵>" -- src` 確認有讀取者.
- **補一個元素層欄位要同時盤點的站點**(2026-10-06,連線 popupDirection):`CONN_DEFAULTS` 與 `CONN_SETTING_KEYS`(白名單漏加 → 表單改了被拒並 warn,畫面看似沒反應)、`resolveDefConn`(`opt.defConn*`)、`settingsGroups`、表單模板與 `*Items`、`settingsTexts` 之標籤與選項類別、spec §12 表與其測試抄本 `test/tools/settingsTextsSpec.mjs`、README 表、WFlowVue JSDoc、示範頁 AppSettingsTexts.行為邏輯先前已收進 mixin `elementPopups`(兩種 wrapper 共用),故連線只多一個 `settingsPopupDirection` computed——**對稱能力先收斂到共用層,補另一種元素才便宜**.
- **WPopup 以觸發元素之矩形判定「點在外面」**(`buildPopper` 之 `domIsClientXYIn`),且 popper 只在開啟時以 `placement` 建立、`[placementDistX, placementDistY]` 實為 `[skidding, distance]`、啟用 flip:要改 popup 相對節點之位置,不能把觸發元素放大成整個節點(點節點本體會不再關閉),要移動錨點(本輪:錨點移到方向那一側之角);開啟中不得移動錨點(會以舊 placement 對新錨點定位而疊到節點上),故方向於開啟時凍結.

## 2. 測試

- **單元測試首輪全綠時做突變確認**:本輪先後做了「label 改回字面文字」「拿掉 × 鈕之 `aria-label`」「方位下拉用錯選項類別」三種突變,`unit-settings-text` 皆紅燈後才採信.
- **spec 表格抄進 `test/tools/` 共用**:§12 之文字鍵與預設表抄在 `test/tools/settingsTextsSpec.mjs`,兩個測試檔共用;不由被測模組推導預期值(否則改錯預設也全綠).
- **驗「文字被換掉」的 e2e 不能拿文字定位**:改用 `data-field-key`、class;並刻意留幾個鍵不給,同案驗逐鍵回退(`Advanced`、`Text`、`Bottom` 維持英文).
- **demo 頁右側 JSON 樹 deep-watch opt**:會改 opt 之新案例截圖一律 clip 到圖台或 popup(`settingsPopupClip`),免得 demo 細節被凍進標準圖.
- **手術式重產標準圖之流程**:`--names` 是案例層閘門,一案多圖會全部重寫.先跑比對模式,確認只有預期那張失敗、`./testPending` 之 diff 只落在預期區域;再 `--baseline --names`;再 `git status test/pics/` 確認只有那張變動(本輪其餘 4 張重寫後 byte 相同),不放心就 `git checkout` 還原後以比對模式回驗.
- **比對全綠不等於畫面沒變:小區域之真變更可落在 `maxDiffPixels` 容差內**(2026-10-06):demo 標籤列新增 `texts` 分頁後,全頁截圖之比對仍 351/0 全過——新分頁文字只差 67 個非反鋸齒像素,小於容差 100.改動 UI 後,受影響之圖要以探針自行計算新舊差異(含反鋸齒)與外接框,不能只看比對結果;確認差異只在預期區域後再重產,使標準圖與實際畫面一致.
- **開在元素上 / 下方之 popup 截圖會超出圖台**(2026-10-06,E2E-053 初版):連線表單 6 群約 281px,label 置中時開在上方,聯集框拍進 demo 標籤列——標準圖從此綁上 demo 頁首.做法:重開前依方向取景(`centerOnConnLabel(page, id, fy)`,setup 非 act),截圖經 `shotInCanvas` 守門(clip 超出圖台即拋錯).新案例產圖後逐張目視,看框內有沒有圖台以外的東西.
- **表單多一群,受影響之圖不只「多一列」**:Basic + Path 展開之連線表單因此達 400px 上限而改為內捲動,popper 為維持貼齊把整個 popup 上移 10px,差異外接框是整個 popup(E2E-041 conn-path),E2E-051 之 popup 截圖尺寸也變了.重產前以探針算差異外接框並看圖找出原因,不是看到「預期會變的那幾張紅了」就重產.
- **`--names` 重產會連同案之無關圖一起重寫**:重寫後與備份逐張比對,逐像素相同者不影響;只帶雜訊者(E2E-051-node 邊緣 10 像素)以備份還原,不讓無關之標準圖跟著變動.
- **產圖前先寫預期清單**(依 spec 寫下每張該看到什麼,落 `./tmp/`),產出後逐張對照,不吻合即修系統,不改圖將就.
- **`./testPending` 中已處理完之事件由 agent 清理**(業主 2026-10-06 授權;全域規範之「不自動刪」指測試程式不得自動刪,不是證據永遠不清):事件 = 同一「標籤__時間戳」之 capture / baseline / diff 三聯組.流程:①先全跑 e2e 且全數通過(已處理完之第一個條件是該圖現在通過);②`node test/tools/pendingAudit.mjs` 逐事件比對當時之 baseline 與現行 `test/pics/<標籤>.png` 並分類——`obsolete`(案例已改名或移除)與 `rebaselined`(事後已重產,理由應已記於 spec〈標準圖對照〉或本檔)可清;`same-base`(baseline 未變而現已通過,即靠修程式或為偶發)須先看 diff 圖找出成因才可清,**找不到成因者保留**——那正是偶發 flake 隔天才分析時要的證據;③清後再跑一次工具確認只剩保留者.dump 函式會自建目錄,不必刻意留空目錄.檔名時間戳為 UTC(`toISOString`),與 git 之本地時間(UTC+8)比先後時要換算.
  - 首次清理(2026-10-06):85 事件 / 238 檔全清——`rebaselined` 60、`obsolete` 1(`E2E-040-fit-avoid-menu`,案例已改為 fit-padding)、`same-base` 24,成因逐一看 diff 確認:2026-08-27 E2E-013 為動畫虛線未凍結(後以 `animations:'disabled'` + 暫停 SMIL 解決);2026-08-28 同一輪 21 件為初始化 fit 之 zoom 未重設(diff 是兩個縮放比例之圖疊合、clip 尺寸縮為約 0.84 倍;後於 `openPage` 重設視口為原點);同日 E2E-019 為縮放重構中途之視口錨點差;2026-08-29 E2E-036-edited 為 fit 留白實作期間之 zoom 差(E2E-040 定案後回到原值).
- **全跑中出現的失敗,先單跑三次再定性,不要先寫「flake」**(2026-10-06):E2E-022 於全跑中逾時,我先判為 tooltip 時序 flake,單跑 3/3 失敗才確定是確定性的.成因(探針實測):上一顆工具列鈕(Fit View)之 tooltip 開在其正下方、`pointer-events:auto`,恰蓋住下一顆鈕(鎖頭)中心;`ElementHandle.click` 先做命中檢查、不移動滑鼠,遮擋永不消失而重試到 30 秒.真滑鼠移過去 tooltip 即收起(使用者無感).修法是 `clickMenu` 先 `mouse.move` 到目標鈕再點(真實使用者路徑),最終滑鼠位置不變故標準圖不必重產.觸發點是 2026-10-02 之 `w-component-vue` 2.5.21 → 2.5.26 升版後未跑全套 e2e——**升自有套件後要跑一次全套 e2e**.
- **e2e 期間不得改 `src`**:dev server 熱更新會使前後案例跑在不同程式碼上;改了就整輪重跑(觸控輪曾因此重跑).新增未被 import 之 `src` 檔理論上不觸發重編,仍一律等跑完再寫.
- **觸控相關**(2026-09-21 觸控輪):擺轉折點等 setup 不可寫死畫布座標(曾落在節點上,測到的是拖節點),一律 `freeCanvasSpot` 實地掃描;先產圖再修行為等於把壞行為凍進標準圖(曾因此重產 3 張).

## 3. 工具與環境

- **e2e 自行起停 dev server,不必也不要手動起**(2026-11-05 起,排程第 309 項):`node test/e2e-flow.test.mjs` 自行以 `vue-cli-service serve --host 127.0.0.1 --port <實際埠>` 起 dev server;8650 被占用(含你手動起的 dev server)就整組換到 8750…並印 `[e2e-port]`,**不殺、不沿用**占用者.要沿用手動起的 dev server 於 8650:設 `E2E_PORT_OFFSET=0`.舊做法(手動起 + `curl`／`netstat` 驗 PID)已移除:修前只要 8650 被別的套件占著,e2e 就打到別人的服務(實測 1 次 `GET /` 後 20 秒逾時紅),沒人起則連線被拒.
- **「全綠」不能證明沒打到別人**(2026-11-05):驗收占用情境時看三件事——占用者 PID 仍在、仍回應、被測碼打到 0 次(占用者以請求標頭區分自己的探測與被測碼),不是只看 passing.本套件修前沒有任何殺程序碼,但仍會「打到」占用者,所以「0 次被打到」才是這次的判準,不是「沒被殺」.
- **Windows 上緊接上一輪之 TIME_WAIT 會讓套件把 8650 判為占用**:上一輪 dev server 結束後,8650 留有 TIME_WAIT 連線,`::`(雙棧)試綁定遇 EADDRINUSE 而 `127.0.0.1`／`0.0.0.0`／`::1` 可綁(`tmp` 內 `bindcheck` 實測).結果是約 2 分鐘內再跑一輪會改用 8750——無害(不殺、不影響標準圖),但「沒有占用時一定是 8650」不成立;單元測試因此以「前後兩次實際綁定檢查皆空閒才斷言必為基準埠」為條件,其餘一致性斷言無條件.
- **基準埠不要用多套件共用之埠**(2026-11-05):原用 8080 時 `unit-e2ePorts` 會在真實 8080 起占用者,Windows 上可與 w-web-sso 等並存綁定而搶走對方連線.改 8650 後不再共用,標準圖不含埠故不受影響.
- **位元組比對不等於埠有影響,要先量執行間雜訊**:基準埠與位移埠各產圖,9 張中 2 張(E2E-001、042)逐位元組不同,但同一埠重複產圖亦如此(E2E-001 同組內 16 對有 11 對不同、跨組 20 對有 14 對不同,最大 33 px／通道差 20,同量級);改以 RGBA 逐像素、同組內／跨組兩組並列比較,才能把「埠造成」與「執行間雜訊(@mdi 齒輪 SVG 邊緣)」分開.
- **jest 測試檔不可含 `import.meta`**(babel-jest 轉 CJS):要驗 ESM 專用模組(`w-package-tools-e2e` 內有 `import.meta.url`)就以真實子行程執行配套腳本(`test/tools/e2ePortsChild.mjs`、`e2eServicesChild.mjs`),測試檔只用 Node 內建模組;子行程環境要清掉 `E2E_PORT_OFFSET`／`E2E_PORT_HOLD`、把 `E2E_PORT_REG_DIR` 指到專屬暫存夾,才與本機其他套件之預約無關.
- **只綁 `::1` 之占用者要用 `::1` 探測**:用 `127.0.0.1` 探測會誤判「占用者不再回應」.情境標籤不可含 `:`(Windows 資料夾名).
- **eslint 對 `test/` 會報大量 `no-undef`**(專案 config 未設 jest globals,既有測試檔亦然):濾掉 `no-undef` 再看真問題.`import/no-duplicates` 不允許同模組分兩行 import;`comma-dangle` 不允許 import 清單結尾逗號.
- **示範頁要以「發布形態」驗收,且不動版控之 `dist/`**:發布管線為 `toolg/gDistRollupComps.mjs`(→ `dist/`,版控中)、`toolg/gExtractHtml.mjs`(→ `test-html/`,已 ignore,頁內引用 `../dist/w-flow-vue.umd.js`)、`toolg/gDocExams.mjs`(→ `docs/examples/`,換 CDN).驗收法:以同一支 `w-package-tools/src/rollupFiles.mjs` 把 UMD 打到 `./tmp/<案名>/dist`,跑 `gExtractHtml` 後把該頁複製到 `./tmp/<案名>/verify/`(其 `../dist` 即指向暫存打包),以 Playwright 開 `file://` 實際操作並收 console 警告.順帶驗到新模組進得了 rollup 打包、沒有新增循環依賴(既有之 `nodeStyle ↔ geometry` 循環為舊有).
- **`git grep` 只掃已追蹤之檔**:新檔提交前需加 `--untracked`.盤點指令寫好後對 `HEAD` 跑一次,確認能抓到舊站點(證明指令有鑑別力),再對工作目錄跑出 0.
- **觸控命中區**(2026-09-21):置中放大會被瀏覽器觸控吸附把「按在節點中央」判給鄰近把手,一律向節點外推(帳本 R1.7).
