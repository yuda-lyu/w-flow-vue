# 規則帳本

本檔為套件設計與開發階段之規則帳本,為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.

## 0. 體例

- 以**規則**為單位,不以缺陷站點為單位.每條含:規則本文 / 單一擁有者(唯一定義處)/ 盤點指令 / 站點全集與判準(已套 / 未套 / 刻意不套)/ 測試對應 / 理由或已知限制.
- 盤點一律用 `git grep`(只掃版控檔,與 `.gitignore` 一致,秒回);站點以「檔案 + 函式或模式」記,**不記行號**(行號會漂移,定位一律重跑盤點指令).
- 與規格之分工:行為契約(輸入空間表、每格應然)在 `spec/流程_互動契約.md`;e2e 案例、標準圖對照與斷言在 `spec/流程_圖台互動.md`.本檔只記「程式碼須長成什麼樣」與「怎麼盤點、怎麼驗」.
- 新增或修改規則時同步更新:盤點指令之站點全集、測試對應、§8 已知限制、§9 破壞性變更.

---

## 1. 輸入通道(滑鼠 / 觸控 / 觸控筆)

### R1.1 雙通道分流,判準只有一份

- **規則**:滑鼠一律走 mouse 事件路徑;觸控與觸控筆走 pointer 事件路徑.每個 pointer 監聽的第一件事是 `if (isFromMouse(e)) return`——滑鼠會同時送 pointer 與 mouse 兩套事件,兩邊都處理即同一次手勢被跑兩遍.
- **單一擁有者**:`src/js/domGesture.mjs` 之 `isFromMouse`(原生 `MouseEvent` 無 `pointerType`,視為滑鼠).
- **盤點**:`git grep -n "isFromMouse(" -- src`;`git grep -nE "addEventListener\('pointer|@pointer" -- src`
- **站點全集(已套)**:`WFlowVue` 之 `onDocPointerMove` / `onDocPointerUp` / `onDocPointerCancel`;`FlowCanvas` 之 `onPointerDown` / `onPointerMove` / `onPointerUp`;`mixins/pointerGesture` 之 `armPointer`;`domGesture` 之 `armPointerGesture` 與 `startDocumentGesture` 內三個 pointer 監聽.
- **判準**:不得自寫 `pointerType === 'mouse'` 判斷(第二份判準即補丁).
- **測試**:`test/unit-pointer-gesture.test.mjs` P1、P4~P6;e2e E2E-044~050.

### R1.2 pointer 通道只負責拖曳;接觸不啟動,跨門檻才啟動

- **規則**:元素入口一律 `@pointerdown="onXxxPointerDown"`,方法內 `this.armPointer(event, (down) => this.onXxxMouseDown(down))`.跨 `DRAG_THRESHOLD_PX` 才以**按下當下之事件**走既有滑鼠 handler(手勢邏輯不複製).點按語義(選取、popup、工具列、設定表單)交給瀏覽器於 tap 後補送之相容滑鼠事件,pointer 通道不重做.
- **理由**:①tap 會補送整組相容滑鼠事件,接觸即啟動會使同一次 tap 被兩條路各跑一遍;②點一下把手/四角/轉折點不應啟動建線/縮放/拖曳;③交出 down 事件(`button` 為 0)使既有主鍵守衛原樣適用(`pointermove` 之 `button` 為 −1).
- **單一擁有者**:`domGesture.armPointerGesture`(閘門)+ `src/components/mixins/pointerGesture.mjs`(接線).
- **盤點**:`git grep -n "@pointerdown" -- src`
- **站點全集(已套 9 處)**:`FlowCanvas`(畫布;另含雙指捏合)、`NodeWrapper`(節點拖曳)、`NodeBody` 四角 ×4(`.stop`)、`Handle`(`.stop`)、`EdgeWrapper` 轉折點(實繪圓與命中圓各一)、`EdgeWrapper` label.
- **測試**:`unit-pointer-gesture` P3、P6、P8;E2E-050(tap 不啟動手勢).

### R1.3 down 事件上不得 `preventDefault`,只能經 `preventNativeDefault`

- **規則**:阻止選字/原生拖曳一律呼叫 `preventNativeDefault(event)`(只在滑鼠通道生效).禁止在 `pointerdown` / `touchstart` 或經 pointer 通道進來之 down 事件上直接 `event.preventDefault()`.
- **理由(實測 2026-09-21)**:滑鼠在 `pointerdown` 上 preventDefault 會使 `mousedown`/`mouseup` 整組不送(上游 WPopup 之 window 層關閉協調因而失效);觸控在 down 上 preventDefault 會使 tap 只剩 `click`(node-click、canvas-click、popup 外部關閉全失效).
- **盤點**:`git grep -n "preventDefault()" -- src`;`git grep -n "preventNativeDefault(" -- src`
- **站點全集**:直接 `preventDefault()` 只有兩處——`preventNativeDefault` 本體,與 `NodeWrapper.onNativeDragStart`(`dragstart` 事件,原生 HTML5 拖曳只在滑鼠發生,刻意保留).`preventNativeDefault(` 呼叫 5 處:NodeWrapper 拖曳武裝、NodeWrapper 縮放啟動、Handle、EdgeWrapper label、EdgeWrapper 轉折點.
- **測試**:E2E-029/030(滑鼠拖曳不選字)、E2E-050(tap 之點按語義仍在).

### R1.4 圖台根宣告 `touch-action: none`

- **規則**:`FlowCanvas` 之 `.vue-flow` 宣告 `touch-action: none`;不以 down 事件之 preventDefault 取代.
- **對稱**:與 `@wheel.prevent` 同一語義——手指或滾輪落在圖台上由圖台處理,移出圖台才捲頁(實測 2026-09-21:滾輪於圖台上 scrollY 0→0、zoom 1→0.6;於圖台外 0→12;觸控於圖台外亦 0→12).故不設放行 opt.
- **盤點**:`git grep -n "touch-action" -- src`
- **測試**:E2E-044 斷言 computed `touchAction === 'none'`.

### R1.5 主鍵守衛

- **規則**:啟動手勢之 down 事件須 `button === 0`;document 層 move 時 `(buttons & 1) === 0` 視為主鍵已放開(buttons-lost)而收尾.共用守衛 `gestureBlockedReason({ button, multiSelectActive, activeGesture })` 於 `button` 為 undefined 時放行——只能傳 down 事件之 `button`.
- **盤點**:`git grep -nE "event\.button !== 0|event\.button === 0|\(e(vent)?\.buttons & 1\)|gestureBlockedReason\(\{" -- src`
- **站點全集**:WFlowVue `onCanvasMouseDown`(button)、`onDocMouseMove`(buttons);NodeWrapper `onMouseDown`;NodeBody `onResizeMouseDown`;EdgeWrapper `onLabelMouseDown`;FlowCanvas `onMouseUp`(canvas-click 閘門);domGesture `startDocumentGesture`(buttons).`gestureBlockedReason` 呼叫 3 處:Handle 與 EdgeWrapper 轉折點(傳 button)、NodeWrapper `onResizeStart`(不傳;主鍵在 NodeBody 判).
- **判準**:不得把 `pointermove` 之 `button`(−1)傳入 `gestureBlockedReason`.
- **測試**:`unit-dom-gesture` D4;`unit-gesture-lifecycle` G6.

### R1.6 座標只讀 `clientX/Y`;落點只用 `elementFromPoint`

- **規則**:手勢座標讀 `event.clientX/Y`(PointerEvent 繼承 MouseEvent,兩通道共用);建線落點以 `handleDom.findHandleElAt(clientX, clientY)` 判定,**不讀 move/up 事件之 `target`**(觸控有隱式 pointer capture,target 會釘在按下元素).`pointercancel` 之座標為 (0,0),不得做落點判定(走取消).
- **盤點**:`git grep -n "\.clientX" -- src`(皆在 down/move/up handler);`git grep -n "elementFromPoint" -- src`
- **測試**:`unit-connect-gesture`;E2E-047(觸控建線).

### R1.7 觸控命中區只向節點外側擴大,視覺尺寸不變

- **規則**:`@media (pointer: coarse)` 放大把手、四角、轉折點之命中區;把手與四角之 `::after` 一律向節點外推 8px(只留 4px 吃進節點面);轉折點另畫不繪製之命中圓 `.vue-flow__edge-waypoint-hit`(桌機 `pointer-events: none`).
- **理由(實測 2026-09-21)**:置中放大會讓瀏覽器觸控吸附把「按在節點中央」判給鄰近把手,`activeGesture` 變 `connect`、節點拖不動、tap 也不選取.
- **盤點**:`git grep -n "pointer: coarse" -- src`
- **站點全集**:`Handle.vue`、`NodeBody.vue`、`EdgeWrapper.vue`.
- **測試**:E2E-045(節點中央可拖)、E2E-046、E2E-048.

---

## 2. 手勢生命週期

### R2.1 一次一手勢

- **規則**:`activeGesture` 單值(`null | pan | drag | resize | connect | waypoint | boxselect`);啟動一律經 `beginGesture(type, ownerEl)`(已有手勢即拒),結束經 `endGesture(type)`(同型才清).啟動即 `closeAllPopups()`、根 class `vue-flow--gesturing`、擁有者標 `data-gesture-owner`.
- **單一擁有者**:`WFlowVue` 之 `beginGesture` / `endGesture`.
- **盤點**:`git grep -nE "beginGesture\(|endGesture\(" -- src`
- **測試**:`unit-gesture-lifecycle` G1~G4.

### R2.2 終止路徑與語義

- **規則**:終止原因為 `mouseup` / `pointerup`(提交)/ `blur` / `buttons-lost` / `cancel`(pointercancel:取消,不提交)/ `dispose` / 上鎖.WFlowVue 持有之 pan / drag / boxselect / connect 經 `endActiveGesture(reason)` 單一分派;子元件持有之 document 手勢一律以 `startDocumentGesture` 建立,`onEnd(reason)` 遇 `'cancel'` 走取消.
- **盤點**:`git grep -nE "startDocumentGesture\(|endActiveGesture\(" -- src`;`git grep -n "reason === 'cancel'" -- src`
- **站點全集**:`startDocumentGesture` 呼叫 4 處——NodeWrapper(拖曳門檻、縮放)、EdgeWrapper(label、轉折點).`'cancel'` 分支 2 處——NodeWrapper 縮放(發 `node-resize-cancel`)、EdgeWrapper 轉折點(發 `conn-waypoint-end{cancelled}`);label 與拖曳門檻無提交語義,刻意不分.
- **測試**:`unit-gesture-lifecycle` G10(六手勢 × 五終止原因);`unit-pointer-gesture` P4、P5、P8.

### R2.3 雙指捏合

- **規則**:FlowCanvas 以 Map 追蹤非滑鼠指標(新手勢第一指 `isPrimary` 時清空,避免殘影誤判為雙指);兩指時發 `canvas-pinch-start`(取消平移)與 `canvas-pinch`(距離比 + 中點);WFlowVue `onCanvasPinch` 以滾輪同一套 `zoomAroundPoint` + `clampZoom` 縮放;`opt.zoomOnPinch=false` 不縮放;有其他進行中手勢時不介入;三指以上不定義.
- **盤點**:`git grep -nE "canvas-pinch|zoomOnPinch" -- src`
- **測試**:`unit-pointer-gesture` P6、P7;E2E-049.

---

## 3. Popup 協調

### R3.1 元素之 mousedown 不 `.stop`;把手與四角為刻意例外

- **規則**:上游 WPopup 之互斥關閉掛在 window 之 `mousedown`/`mouseup`,元素之 mousedown 一律讓它冒泡到 window.唯 Handle 與四角為了不讓畫布同時武裝而 `.stop`(mouse 與 pointer 各一),其漏掉之 popup 關閉由手勢啟動時之 `closeAllPopups()` 補強.
- **盤點**:`git grep -nE "@mousedown\.stop|@pointerdown\.stop" -- src`
- **站點全集(刻意 `.stop`)**:Handle、NodeBody 四角.
- **測試**:`unit-gesture-lifecycle` G2.

### R3.2 設定 popup 之開啟方向由 popupDirection 決定(節點與連線同一規則);錨點在該側之角,開啟期間凍結

- **規則**:有效方向——節點 `node.popupDirection` → `defNode.popupDirection`(`opt.defNodePopupDirection`)→ `right`;連線 `conn.popupDirection` → `defConn.popupDirection`(`opt.defConnPopupDirection`)→ `right`;非四方位回退 `right`.方向 → 錨點角 + WPopup placement 只由 `popupPolicy.settingsPopupLayout` 決定(right / top → 右上角 + `right-start` / `top-end`;left → 左上角 + `left-start`;bottom → 右下角 + `bottom-end`);節點之角相對節點外框,連線之角相對 label.popup 開啟期間凍結於開啟當下之方向(mixin `elementPopups` 之 `settingsPopupOpenedDirection`),表單改方向於下次開啟生效.
- **理由**:WPopup(buildPopper)以觸發元素為定位參考,並以**觸發元素之矩形**判定點擊在外(`domIsClientXYIn`),故不能把參考框放大成整個元素(點元素本體會不再關閉 popup);改移動錨點.popper 只在開啟時以 placement 建立,開啟中移動錨點會使後續重新定位以舊 placement 對新錨點而疊到元素上,故凍結.
- **單一擁有者**:方向 → 版面:`src/js/popupPolicy.mjs` 之 `SETTINGS_POPUP_LAYOUTS` / `settingsPopupLayout`;套用與凍結:`src/components/mixins/elementPopups.mjs` 之 `popupLayout` computed 與 `settingsPopupShow` watcher(兩種 wrapper 共用一份,各自只提供 `settingsPopupDirection` computed).CSS 角位置在各 wrapper 之 `.vue-flow__{node|edge}-settings-anchor--{corner}`(兩份同值:wrapper 樣式為 `<style scoped>` 不跨元件共用,外凸 8px 於改版前即兩份;改值須兩處同改,盤點時兩檔各應有 top-right / top-left / bottom-right 三條).
- **盤點**:`git grep -nE "settingsPopupLayout|popupLayout|settingsPopupOpenedDirection|settingsPopupDirection|settings-anchor--(top|bottom)" -- src`;`git grep -n "placement=" -- src/components`(設定 popup 不得再寫死 placement;應只剩資訊 popup 之 `placement="bottom"` 與兩處 `:placement="popupLayout.placement"`)
- **站點全集**:NodeWrapper 與 EdgeWrapper(`settingsPopupDirection` computed、錨點 class、WPopup `:placement`);mixin `elementPopups`(`popupLayout`、凍結 watcher);預設 `NODE_DEFAULTS` / `CONN_DEFAULTS.popupDirection`;`resolveDefNode` / `resolveDefConn`;設定更新白名單 `NODE_SETTING_KEYS` / `CONN_SETTING_KEYS`;表單 `Advanced` 群(兩表單之 `popupDirectionItems`).資訊 popup 恆 `bottom`(**刻意不套**:與 popupDirection 無關,popupDirection 只管設定 popup).
- **已知限制**:該側空間不足時 popper 之 flip 翻到另一側,翻轉後可能與元素重疊(既有行為,right 亦然).
- **測試**:`unit-popup-policy` Q6;`unit-settings-trigger` G6(節點與連線同一組);`unit-resolve-opt` O2;`unit-direction-contract` R6;E2E-052(節點)、E2E-053(連線).

---

## 4. 設定表單

### R4.1 分群單一來源

- **規則**:群鍵、群成員與順序只定義於 `src/js/settingsGroups.mjs`(`NODE_SETTING_GROUPS` / `CONN_SETTING_GROUPS` / `DEFAULT_OPEN_GROUPS`);欄位鍵 ＝ 資料鍵 ＝ `opt.nodesSettingsExcludes` / `connsSettingsExcludes` 之鍵;整群被排除者不渲染.
- **測試**:`unit-settings-groups` G1~G11;E2E-041、E2E-042.

### R4.2 下拉值域單一來源

- **規則**:形狀(`nodeStyle.SHAPES`)、方位(`anchorPolicy.SIDES`)、邊型(`edgePath.EDGE_TYPES`)、箭頭(`edgeMarker.MARKER_TYPES`)之值域只在各自模組定義,表單只衍生,不另抄.選項一律**以值域迭代**(不以文字表之鍵迭代——否則值域新增之值會變成無文字之空白項);顯示文字見 R4.4.
- **盤點**:`git grep -nE "\b(SHAPES|SIDES|EDGE_TYPES|MARKER_TYPES)\b" -- src`
- **測試**:`unit-settings-text` T4、T5;`unit-settings-texts` X3、X4.

### R4.3 表單不用原生 select 與 text input

- **規則**:下拉一律 `ui/SettingsSelect.vue`(封裝 `WTextSelect`),文字一律 `ui/SettingsText.vue`(封裝 `WText`).
- **理由**:原生 `<select>` 之下拉開在 OS 層,會打亂 WPopup 之 mousedown/mouseup 配對而誤關設定 popup,且 Playwright/CDP 點不開(自動化測不到).
- **盤點**:`git grep -nE "<select|<input[^>]*type=\"text\"" -- src/components`(應為 0)
- **測試**:`unit-settings-controls` C1~C4;E2E-031、E2E-036.

### R4.4 設定彈窗文字:一句一個 opt 鍵(扁平),不內建語系;節點與連線各一組鍵

- **規則**(業主規範,見 CLAUDE.md〈opt 設計規範〉):
  - **對外一律扁平**:每句顯示文字一個 opt 鍵、一個字串,外部逐鍵個別傳入;**不得以物件包多鍵文字**(曾提 `opt.nodesSettingsLabels = { groups, fields, options, … }` 被否決).表單之同一句為一個 String prop(opt 鍵去前綴、首字小寫).宿主可見文字只有工具列 6 個 `opt.menu*Tooltip` 與本規則之 74 鍵,皆同一風格.**不內建語系包**,預設英文.
  - **命名**(參照 w-component-vue 之文字 prop 慣例):`{nodes|conns}Settings` + 群標題 `{群鍵}GroupTitle` / 欄位標籤 `TextLabel{欄位鍵}` / 選項 `{類別}TextFor{值}`(類別 = 欄位共同字根 `position` / `marker`;值 kebab → PascalCase,`''` 為 `None`)/ 按鈕 `DeleteText`、`ColorConfirmText` / 圖示鈕 `PointsAddBtnTooltip`、`PointsRemoveBtnTooltip` / 空狀態 `PointsTextEmpty` / 座標框 `PointsXTooltip`、`PointsYTooltip`.鍵數:節點 26、連線 48;節點與連線無共用鍵.
  - **鍵名與預設之單一來源** `src/js/settingsTexts.mjs`(內部):以 `settingsGroups`(群與欄位)與值域模組(SHAPES / SIDES / EDGE_TYPES / MARKER_TYPES)產生鍵;欄位標籤之英文手寫一次(共用語彙一個常數);選項預設 = 例外表(`smoothstep`、`arrowclosed`)→ Title Case,不得擴成完整對照表.OPT_SPEC(kind `text`)、表單 props、WFlowVue 之下傳物件皆由同一模組產生,不得另手寫鍵名清單.
  - **逐鍵回退**:非字串或空字串 → 該句預設;純空白照收(與工具列 tooltip 同規則).WFlowVue(OPT_SPEC kind `text`)與表單(`resolveSettingsTexts`)套同一規則,冪等.
  - **內部傳遞屬內部機制**:WFlowVue 由各文字 computed 組成 `nodeFormTexts` / `connFormTexts`(prop 名 → 文字)經 Renderer(`formTexts`)→ Wrapper(`formTexts`)→ 表單 `v-bind` 展開為各文字 prop.可依架構與效能調整,不影響對外鍵名.
  - **模板無字面可見文字**:label、群標題、`title`、`aria-label`、空狀態、按鈕文字一律取自 `txt` / `fieldLabel()` / `groupTitle()`;prop 名之組法(`groupTitleProp` / `fieldLabelProp` / `optionTextProp`)只在 settingsTexts 定義,模板不自行拼字.圖示鈕(＋ / ×)同一鍵同時綁 `title` 與 `aria-label`(HTML-AAM:按鈕可及名稱先取內容).
  - **誤用之可觀察性**(`resolveOpt.collectOptIssues`,WFlowVue 逐則 `console.warn` 一次):已移除之 `settingsColorConfirmText`(點名兩個新鍵,值不生效,非相容層);以 `nodesSettings` / `connsSettings` / `settings` 開頭而不在 OPT_SPEC 之鍵;文字鍵之值非字串.只讀文字鍵之值,不碰資料鍵.
- **單一擁有者**:`src/js/settingsTexts.mjs`(依賴單向 → settingsGroups 與值域模組;`settingsGroups.mjs` 維持零依賴;`resolveOpt` 依賴它產生 OPT_SPEC).
- **對標**:本套件既有扁平文字鍵(`menu*Tooltip`、`nodesSettingsDeleteText`)與 w-component-vue 之文字 prop(`uploadModeTitle`、`textLabelDataName`、`uploadModeTextForReplace`、`saveBtnTooltip`、`textEmpty`)——**必先對照這兩者**;draw.io 語系資源檔整包切換——不採.
- **盤點**(新檔提交前各指令加 `--untracked`):
  - 模板字面文字(應為 0):`git grep -nP ">[^<>{}]*(\p{Han}|[A-Za-z])[^<>{}]*<|<label[^>]*>\s*[^{<\s]|\s(title|aria-label)=\"" -- src/components/ui/NodeSettingsForm.vue src/components/ui/ConnSettingsForm.vue`
  - 物件型文字設定已清(應為 0):`git grep -nE "SettingsLabels|settingsLabels|:labels=|getSettingsText|resolveSettingsText\(" -- src`
  - 傳遞鏈:`git grep -nE "formTexts|form-texts|FormTexts|settingsTextProps\(" -- src/components`
  - 鍵名產生點只在一處:`git grep -nE "TextFor|GroupTitle'|'textLabel'" -- src/js`(應只有 `settingsTexts.mjs`)
  - 預設文字只在一處(應只有 `settingsTexts.mjs`;以物件值為錨,避開 `e.key === 'Delete'` 之鍵名):`git grep -nE "(:|\|\|)\s*'(Delete|Confirm|Face Color|Smooth Step|Arrow Closed|Add Waypoint)'" -- src`
  - 鍵數(應為 節點 26、連線 48、OPT_SPEC 124):`node --input-type=module -e "const t=await import('./src/js/settingsTexts.mjs');const r=await import('./src/js/resolveOpt.mjs');console.log(Object.keys(t.NODE_SETTINGS_TEXTS).length,Object.keys(t.CONN_SETTINGS_TEXTS).length,Object.keys(r.OPT_SPEC).length)"`
- **站點全集**:OPT_SPEC(`...settingsTextOptSpec()`)→ WFlowVue computed `nodeFormTexts` / `connFormTexts`(`pickSettingsTexts`)→ NodeRenderer / EdgeRenderer(`formTexts` prop + `:form-texts`)→ NodeWrapper / EdgeWrapper(`formTexts` prop + `v-bind`)→ NodeSettingsForm / ConnSettingsForm(`...settingsTextProps(kind)`;mixin `settingsForm` 之 `txt` / `groupTitle` / `fieldLabel` / `optItems`).選項文字:兩表單之 `*Items` computed(節點 `shapeItems` / `popupDirectionItems`,連線 `typeItems` / `sideItems` / `markerItems` / `popupDirectionItems`).
- **測試**:`unit-settings-texts` X1~X6(opt 層與文字模組);`unit-settings-text` T1~T7(表單與傳遞鏈);E2E-051(中文文字鍵實機顯示).

---

## 5. 資料語彙

### R5.1 連線兩端一律 from / to

- **規則**:`conn.from` / `to`、`fromPosition` / `toPosition`、`markerFrom*` / `markerTo*`;SVG 之 `marker-start` / `marker-end` 只是渲染屬性名,不外露為資料鍵.
- **盤點**:`git grep -nE "markerStart|markerEnd" -- src`(應只剩 SVG 屬性綁定與 `EdgeMarkerDefs` 內部)

### R5.2 箭頭可改矩陣

- **規則**:Face Color 只有 `arrowclosed` 可改(線式 fill 恆 none);Edge Color 有箭頭(`arrow` / `arrowclosed`)即可改;未給時框色跟隨線色、實心填色為線色加深 20%.
- **單一擁有者**:`edgeMarker.resolveMarker`.
- **測試**:`unit-edge-marker` M7、K5;E2E-043.

### R5.3 形狀值域

- **規則**:`SHAPES` 七種;三角形四向一律帶方向(`triangle-up/right/down/left`),不得有裸 `triangle`.
- **測試**:`unit-settings-text` T4.

---

## 6. opt 解析

### R6.1 純量 opt 一律登記於 `OPT_SPEC`

- **規則**:純量 opt 登記於 `src/js/resolveOpt.mjs` 之 `OPT_SPEC`(`kind`: `defined` / `truthy` / `enum` / `nonneg` / `padding` / `notFalse` / `nullable` / `fn` / `text`,依 kind 附 `def`),由 `optComputeds()` 各產一個同名 computed;群組型(defNode / defConn / menu)以具名解析函式提供.設定彈窗之 74 個文字鍵由 `settingsTexts.settingsTextOptSpec()` 展開進 OPT_SPEC(kind `text`,R4.4).元件內不逐鍵手寫 fallback.opt 之誤用(已移除鍵 `REMOVED_OPT_KEYS`、設定類鍵族之未知鍵、文字鍵非字串)由 `collectOptIssues` 單一判定.
- **盤點**:`node --input-type=module -e "const r=await import('./src/js/resolveOpt.mjs');console.log(Object.keys(r.OPT_SPEC).length)"`(2026-10-06 連線 popupDirection 實作後為 124 鍵 = 手寫 50 + 文字 74;`defNodePopupDirection` / `defConnPopupDirection` 屬群組型 defNode / defConn,不在 OPT_SPEC;OPT_SPEC 含展開項,故不再以 awk 數行)
- **測試**:`unit-resolve-opt` O1 起.

---

## 7. 測試對應與執行

### 7.1 單元測試(jest + jsdom)

- 指令:`npm test`(= `jest`);單檔 `npx jest test/<檔名>`.
- 基準(2026-10-06,連線 popupDirection 補齊後):48 suites / 2615 tests 全綠(設定彈窗文字扁平鍵 + 節點 popupDirection 時為 48 / 2604;更早為 47 / 2544).
- 樣式檔由 `jest.config.js` 之 `moduleNameMapper` 換成 `test/styleMock.cjs`.
- jsdom 20 無 `PointerEvent`:以 `MouseEvent` 補 `pointerType` / `pointerId` 模擬(見 `unit-pointer-gesture` 之 `ptr()`);監聽比對依事件型別字串,故等價.
- 規格對應:各單元測試檔頭列其對應之契約節(`spec/流程_互動契約.md` §x)與項目代號.

### 7.2 e2e 落地映射(對應全域技能 role-coder-for-test-e2e §3 契約)

#### 服務與 port

| 項目 | 值 |
|---|---|
| 後端 | 無(純前端套件) |
| 前端 | webpack dev server(`vue-cli-service serve --host 127.0.0.1 --port <實際埠>`),**由 e2e 自行起停**(2026-11-05 起,不再依賴手動 `npm run serve`);基準埠 `8650`,被占用時整組換埠(8750…),見 R-E2E-PORT-01(§7.4) |
| e2e 執行 | 全跑 `node test/e2e-flow.test.mjs`(單檔自帶 runner,非 mocha);單案 `--names E2E-NNN[,…]` |
| 標準圖 | `node test/e2e-flow.test.mjs --baseline --names E2E-NNN[,…]`(案例層閘門,截圖前即篩);`E2E_BASELINE_OUT_DIR=<目錄>` 導到隔離目錄(等價驗證用,不動 `test/pics`) |
| 共用實作 | `test/e2e-setup.mjs`(`baseUrl`、`captureStable`、`assertBaselineMatch`、`startServers`、`cleanup`、`createE2eServices`、`devServerArgs`);基準埠與埠保留 `test/tools/e2ePorts.mjs` |
| 基準(2026-10-06,含 E2E-053 之全跑) | 53 案例 / 363 項斷言全過 / 77 張標準圖(`test/pics/`)全數比對通過(E2E-052 時為 52 / 351 / 74) |

#### 契約映射

| 契約 | 本專案實名 / 模式 | 偏離與依據 |
|---|---|---|
| C1 launch wrapper | 單一入口 `w-package-tools-e2e` 之 `launchChromium()`(runner 之 per-case 迴圈;缺 Playwright 指定版本之瀏覽器時自動下載) | **缺口**:呼叫時未傳確定性渲染旗標(同套件另有 `chromiumLaunchArgs` / `launchBrowser`);現行 pixelmatch 容差下全數穩定,暫不動(動則全量重產) |
| C2 server lifecycle | `createServiceManager`(`e2e-setup.mjs` 之 `createE2eServices`):e2e 自行起停 dev server,埠經 `reserveE2ePorts` 保留(R-E2E-PORT-01);cleanup 兩條觸發來源(直跑主函式結束後顯式 `cleanup()`、`registerCleanupHooks` 之 exit／SIGINT／SIGTERM 備援),只殺自己 spawn 之行程樹 | 2026-11-05 前為「不自動起停」(舊:前置手動 `npm run serve`,最易撞之 8080 又無任何偵測);改為自動起停之依據:規格 `dspec/e2e埠與多套件同跑.md` §4 盤點「唯一依賴外部手動起服務者」。無 `restartBackend`(無後端) |
| C3 換設定重啟 | 不適用(無後端) | |
| C4 DB 重置 | 不適用(無資料庫);每案例 `openPage` 重新載入 demo 並以 setup 重設視口 | |
| C5 進站與語系 | 無登入;元件不內建語系包,標準圖一律以預設英文產製,不分語系 | 宿主設定文字(R4.4)由 E2E-051 以中文文字鍵單案驗證,不另跑全語系 |
| C6 截圖 | `captureStable(page, { clip, parkMouse, initialWaitMs })`;多數以 `getCanvasClip` 只拍圖台;E2E-041 / 042 拍全頁;E2E-051 以 `settingsPopupClip` 只拍 popup;E2E-052 / 053 拍 popup 與元素之聯集框(053 經 `shotInCanvas` 確認在圖台內) | 新案例以圖台或 popup 之 clip 為準:demo 右側 JSON 樹 deep-watch opt,改 opt 後拍全頁會把 demo 細節凍進標準圖(E2E-042 為既有之全頁例) |
| C7 紅框 | 無 | 刻意不套:本套件標準圖不作操作手冊用圖(無下游手冊) |
| C8 遮罩 | 無;動畫邊以 `animations:'disabled'` + 暫停 SVG SMIL 凍結 | 無不可固定之值 |
| C9 比對 | `assertBaselineMatch(buf, path, label)`;pixelmatch `includeAA:false`、`threshold 0.1`、`maxDiffPixels 100`;失敗三聯組落 `./testPending/`(測試程式不自動刪) | 已處理完之事件由 agent 清理(業主 2026-10-06 授權):全跑通過後以 `node test/tools/pendingAudit.mjs` 分類,`obsolete` / `rebaselined` 可清,`same-base` 須看 diff 找出成因才清,找不到成因者保留 |
| C10 輸入 | 色票 RGB 以 `insertText` 一次注入(`fillPanelRgb`) | |
| C11 偵測等待 | `waitForSelector` + 少量固定等待 | **缺口**:無 `waitUntilExist` 共用 helper |
| C12 settle 訊號 | 不適用 | |
| C13 regen 入口 | 同檔 `--baseline [--names]`;產製端與比對端共用同一案例函式與 `captureStable` | |
| C14 端點 | `baseUrl = http://127.0.0.1:${resolveE2ePort(8650)}`(基準埠寫死於 `test/tools/e2ePorts.mjs`,實際埠由保留與位移衍生;未位移時即 `http://127.0.0.1:8650`) | |

#### 專案特有機制

- 每案例全新 browser(`run()` 內 per-case `chromium.launch`);`openPage(browser, { touch })` 之 `touch` 開 `hasTouch` 情境.
- 觸控手勢一律以 CDP `Input.dispatchTouchEvent` 送出(走真實輸入管線;Playwright 無觸控拖曳 API),helper:`touchDrag` / `touchPinch`.
- 擺放轉折點等 setup 須以 `freeCanvasSpot(page)` 實地掃描空白點,不得寫死座標(寫死會落在節點上,測到的是拖節點).
- e2e 期間不得修改 `src`(dev server 熱更新會使前後案例跑在不同程式碼上);中途改了就整輪重跑.
- 工具列鈕一律經 `clickMenu` 點擊:先 `mouse.move` 到目標鈕再 click——上一顆鈕之 tooltip 開在其正下方、會蓋住下一顆鈕,`ElementHandle.click` 不移滑鼠即做命中檢查會被擋到逾時(E2E-022,2026-10-06).
- 驗「文字被換掉」之斷言不得以文字定位(E2E-051 以 `data-field-key` 與 class 定位,helper `settingsFormTexts`).
- 開在元素上 / 下方之 popup 截圖須整個落在圖台內:重開前以 `centerOnConnLabel(page, id, fy)` 依方向取景(setup,非 act),截圖經 `shotInCanvas` 守門——clip 超出圖台即拋錯,不把 demo 標籤列等頁面元素拍進標準圖(E2E-053;連線表單 6 群約 281px,label 置中時開在上方會超出圖台).
- 設定表單新增群或欄位,會改動「該 popup 開啟中」之所有截圖:盤點 `openEdgeSettings` / `openNodeSettings` 之後、關閉前即 `shot` 者(2026-10-06 連線多一群:E2E-012、037-edge、041 conn ×2、051-conn).
- 升級自有套件(`w-component-vue` / `wsemi` / `w-package-tools-e2e`)後須跑一次全套 e2e(2.5.26 升版後未跑,致 E2E-022 之壞未被即時發現).

#### 已知缺口

- C1:`launchChromium()` 未帶確定性渲染旗標(2026-10-06 盤點更正:原載「`chromium.launch` 散在 runner」不成立,runner 已經單一入口).
- C11:無 `waitUntilExist`.
- 共用層位置:`test/e2e-setup.mjs` 在 `test/` 一層而非 `test/tools/`(全域規範 §16.4).

### 7.3 規格與測試之對應

- `spec/流程_互動契約.md`:行為契約,各節之驗收欄指向單元測試代號.
- `spec/流程_圖台互動.md`:E2E-001~053;〈標準圖對照〉與〈斷言〉兩表為 e2e 之真理源,新增案例四處同步(spec bullet、標準圖表與合計、斷言表、`CASES` 陣列).
- 測試共用之 spec 抄本與配套工具放 `test/tools/`(不帶 `.test.`,jest `testMatch` 只收 `unit-*` / `api-*`):`settingsTextsSpec.mjs` 為互動契約 §12 之文字鍵與預設表;`pendingAudit.mjs` 為 `./testPending` 失敗證據之盤點(判斷哪些事件已處理完可清);`e2ePorts.mjs` 為 e2e 基準埠與埠保留(R-E2E-PORT-01);`e2ePortsChild.mjs`、`e2eServicesChild.mjs`、`e2eFakeDevServer.mjs`、`e2ePortsOccupier.mjs` 為 `unit-e2ePorts` 之真實子行程／假服務／占用者配套.

### 7.4 R-E2E-PORT-01 e2e 埠、前端服務起停與下殺(排程第 309 項,2026-11-05 fv309)

規格:`C:/opensrcOper/dspec/e2e埠與多套件同跑.md` E1～E8、§3、§5;套件 `w-package-tools-e2e` ≥ 1.0.22 README §2.12.

- **規則**:
  1. 基準埠 `8650` **只在** `test/tools/e2ePorts.mjs` 定義,該檔載入時一次 `reserveE2ePorts([FRONTEND_PORT], { avoid: OTHER_TEST_PORTS })`(須早於 `e2e-setup.mjs` 任何 `resolveE2ePort`／`createServiceManager`:ES 先評估被匯入者)。沒有占用 → 即基準埠、`E2E_PORT_OFFSET` 維持未設,埠、行為與標準圖同導入前;被占用(別的套件正在跑、開發者手動起的 dev server、Windows 的 TIME_WAIT 殘留)→ 整組位移(8750…)寫入 `E2E_PORT_OFFSET`,印 `[e2e-port] 基準埠 [8650] → 實際埠 [8750](位移 100)`。本套件只有單一 e2e 檔自帶 runner(無逐檔 runner),故匯入處只有 `e2e-setup.mjs`。
  2. 前端 dev server **由 e2e 自行起停**(`e2e-setup.mjs` 之 `createE2eServices` → 套件 `createServiceManager`;`e2e-flow.test.mjs` 之 `run()` 先 `startServers()`,結束後 `cleanup()`;`registerCleanupHooks` 備援 exit／SIGINT／SIGTERM):`node …/vue-cli-service.js serve --host 127.0.0.1 --port <實際埠>`(不經 npm／shell,隱藏視窗),`baseUrl = http://127.0.0.1:${resolveE2ePort(FRONTEND_PORT)}`.注意 `--port` 只是 vue-cli 之 portfinder 的**起點**(`@vue/cli-service` `serve.js`:`portfinder.basePort = args.port; getPortPromise()`):保留後、綁定前該埠被搶走時,vue-cli 仍會靜默改用 port+1 而 `baseUrl` 不變;故 `startServers()` 於就緒後以 dev server 輸出之 `Local: http://127.0.0.1:<埠>/` 核對實際綁定埠(`checkDevServerTail`),不符即拋錯(EP-7),看不到該行則印警告.
  3. **絕不依埠、依名稱下殺任何行程**。程式中唯一的「殺」是 `createServiceManager.cleanup` 殺**自己 spawn 之行程樹**(另有套件 `reserveE2ePorts` 之 stale-reservation 回收:只殺預約檔記有身分〔PID＋起始時間＋映像〕之殘留)。占用者一律不殺;自動換埠時也不沿用(`source=auto` 且埠於保留後被他人占用 → 拋錯寫明占用者,重跑即重選)。`killForeignOnRestart` 不開、不呼叫 `restart`.
  4. 逃生口:手動設 `E2E_PORT_OFFSET=0` ＝ 不換埠,基準埠上已有回應者即沿用(開發者已起 dev server 時用);被沿用者是否真為本套件之 dev server 由設定者負責,此情形仍絕不下殺.
- **單一擁有者**:`test/tools/e2ePorts.mjs`(基準埠、`OTHER_TEST_PORTS`、保留).
- **盤點**(新檔未追蹤時 `git grep` 加 `--untracked`):
  - 下殺站點:`git grep -nE "killPortListeners|taskkill|Stop-Process|process\.kill|\.kill\(|wmic|netstat" -- test spec toolg src` → 可執行碼 0(2026-11-05 實查:修前全 repo 0〔本套件無後端、無任何殺程序碼〕;修後仍 0;`unit-e2ePorts` EP-S3 守護,該檔自身為自建占用者之收尾而排除).
  - 寫死網址／埠:`git grep -nE "(localhost|127\.0\.0\.1):[0-9]" -- test` → 可執行碼 0(EP-S2);基準埠字面值只在 `e2ePorts.mjs`(EP-S1).
  - 寫死監聽埠:`git grep -nE "\.listen\(|createServer" -- test src` → 命中僅 `test/tools/` 配套(埠為參數)與 `unit-e2ePorts` 內之 net 探測(`listen(0)`／參數);`OTHER_TEST_PORTS` 為空陣列(2026-11-05 實查:本套件 unit-／api- 皆為 jsdom,不監聽;EP-S4 守護,日後新增寫死監聽埠須列入並維持綠).
- **站點全集**:服務啟動 1(`createE2eServices` 之 frontend);埠衍生 2(`baseUrl`、dev server `--port`);測試碼寫死網址／埠 0;下殺 0(只有 `cleanup` 殺自建行程樹).
- **畫面含埠之流程(E7)**:**無**。靜態:`src/` 無任何元件渲染 origin／host／port(`src/App.vue` 之 `location.href` 只供 `?cmp=` 解析,不顯示);動態:代表性 9 張(含全頁 E2E-009／011／041／042)於基準埠與位移埠各產圖,RGBA 逐像素比對,差異量級與同埠重複產圖之執行間雜訊相同(見 state／經驗 2026-11-05).日後新增含埠流程時須比對端覆蓋該處或改只能在基準埠跑(`reserveE2ePorts(…, { baseOnly: true })`),不得略過.
- **測試**:`unit-e2ePorts` 15 案——EP-1～EP-6b(真實子行程＋真實監聽,占用情境動態期望〔占得到就占、EADDRINUSE 視為已占用〕,子行程登錄目錄隔離到 `test/_tmp/e2ePorts/`,與本機埠占用無關)、EP-7／EP-8(dev server 實際綁定埠之核對:判定函數與 `startServers` 經假 dev server 走同一條追蹤路徑)、EP-S1～EP-S5(靜態守護);另有真實占用者驅動之實跑(fv309 報告 §三).單元測試的占用者／子行程之收尾只憑 `ChildProcess` 結束狀態(`isRunning`)下殺,不憑 PID 存在性(PID 可能已被回收).
- **變異測試**(修正處逐一暫時變異→跑 `unit-e2ePorts`→還原並以雜湊回驗):不保留、`baseUrl` 寫死、dev server `--port` 用基準埠／不帶、spawn 不傳實際埠、開 `killForeignOnRestart`、不帶 `reservation`、加依埠下殺站點、埠核對恆為 ok／不核對、新增寫死監聽埠未列 avoid、e2e 寫死網址／不 cleanup／不起服務,共 14 項,全數擊殺(M11「e2e 不再 cleanup」初版因 `cleanup()` 在 `.then`／`.catch` 各有一處、守護只比對有無該字串而存活,補強 EP-S5 為兩條路徑各自比對後擊殺;M6／M7〔開 `killForeignOnRestart`／不帶 `reservation`〕只由靜態守護 EP-S5 擊殺,因套件於未明確帶入時會退回行程內之保留,行為等價,故屬原始碼約束而非行為差異;結果見 fv309 報告 §三.4).
- **已知限制**:①基準埠之 `::` 試綁定失敗代表確有 socket 占著 `::`,會換埠(2026-11-05 實測,原載「TIME_WAIT 造成」不成立);②`E2E_PORT_OFFSET=0` 不驗被沿用者身分;③保留後被搶走時,管理器為判斷有無回應必探測 1 次 `GET /`(套件設計),無法做到對占用者 0 次請求;④8650 與 w-web-sso、w-pubsub、w-serv-broadcast 之基準埠相同(規格 §4 portGroups),本套件已能自動避開,測試閘之互斥表是否納入本套件由主控裁量.

---

## 8. 已知限制(設計限制,刻意不做)

| 項目 | 依據 |
|---|---|
| 觸控裝置不支援複選/框選(啟動條件是實體鍵盤之複選鍵) | 業主裁定 2026-09-21;註解在 `WFlowVue` 之 `isBoxSelectActive` |
| 色票面板內之文字不可覆寫:模式頁籤 `RGBA` / `HSVA`、通道標籤 `R` `G` `B` `A` / `H` `S` `V` `A`(確認鈕可,經 R4.4 之 `colorConfirm`) | 屬上游 `w-component-vue` 之 `WColorSelectInput`(寫死於 template 與 `methodSelect`);`WColorSelect` 之文字類 prop 只有 `btnText` |
| 下拉元件之 `Loading...` / `No results` / `Searching...` 不可覆寫 | 上游 `WTextSuggestCore` 之 prop 預設,`WTextSelect` 未透傳;本套件之選項為靜態清單且不過濾,實際不會出現 |
| 齒輪鈕與設定/資訊 popup 本身無可及名稱(無 `aria-label` / tooltip) | 補上即為可見 UI 變更(tooltip),未經裁示前不動;R4.4 只涵蓋表單內文字 |
| 長譯文使 popup 變寬或換行:欄位標籤為 label 之文字、群標題以 ellipsis 截斷、選項文字決定下拉寬 | 文字長度屬宿主責任;README 已註明 |
| `zoomOnScroll: false` 時滾輪仍被 `@wheel.prevent` 吃掉(既不縮放也不捲頁) | 既有行為,未經裁示前不改 |
| 圖台根為固定 px(`opt.width` / `opt.height`,預設 800×600),無 ResizeObserver | 宿主負責給尺寸;窄螢幕宿主須自行餵寬高 |
| 捏合只縮放、不同時平移 | 契約 §8 |

### 8.1 已知缺陷之處置紀錄

| 缺陷 | 處置 |
|---|---|
| `popupDirection` 為無效欄位(表單可改、`defNodePopupDirection` 可設,自初版起無任何消費端) | 2026-10-06 業主裁示實作 → R3.2;E2E-052 |
| `AppConnectivity.vue` 之 example / code 連結指向不存在之 `ex-AppExamConnectivity.html` | 2026-10-06 改為 `ex-AppConnectivity.html`(盤點:`git grep -n "ex-AppExam" -- src` 應為 0) |
| 連線設定 popup 無開啟方向欄位(節點有 popupDirection;不對稱) | 2026-10-06 業主裁示補齊 → R3.2(連線資料欄位 `conn.popupDirection`、`opt.defConnPopupDirection`、表單 `Advanced` 群、6 個文字鍵);E2E-053 |

---

## 9. 破壞性變更紀錄

| 首次進版之 commit(日期) | 變更 | 遷移 |
|---|---|---|
| `267426a`(2026-08-31) | `markerStart*` / `markerEnd*` → `markerFrom*` / `markerTo*`(含 `opt.defConnMarker*`) | 鍵名替換,無相容層 |
| `267426a`(2026-08-31) | `markerStartColor` / `markerEndColor` → `markerFromFaceColor` / `markerToFaceColor`;另增 `markerFromEdgeColor` / `markerToEdgeColor` | 鍵名替換,無相容層 |
| `267426a`(2026-08-31) | 形狀 `'triangle'` → `'triangle-up'` | 值替換,無相容層 |
| 未提交(2026-10-06 實作) | 移除 `opt.settingsColorConfirmText`(兩表單共用一句),改為 `opt.nodesSettingsColorConfirmText` / `opt.connsSettingsColorConfirmText`(節點與連線分開命名).`nodesSettingsDeleteText` / `connsSettingsDeleteText` 鍵名不變 | 鍵名替換;給了舊鍵會 `console.warn` 一次點名兩個新鍵,但值不生效(非相容層);README〈Migration〉 |
| 未提交(2026-10-06 實作) | 連線表單 3 句寫死中文改為英文預設:轉折點 ＋ 鈕 `新增轉折點` → `Add Waypoint`、× 鈕 `移除此轉折點` → `Remove Waypoint`、空狀態 `無(自動路由)` → `None (auto-routed)` | 可見 UI 變更;要中文者設 `connsSettingsPointsAddBtnTooltip` / `PointsRemoveBtnTooltip` / `PointsTextEmpty`.標準圖僅 `flow-E2E-041-settings-groups-conn-path` 重產 |
