# 建議 w-flow-vue 重構:既有結構債清單

## 本文性質

**這不是缺陷報告,也不是待辦清單.** 以下各項皆為 `w-flow-vue` 1.0.25 之既有結構性議題,與任何當前需求無關,**現階段一律不做**.

記錄目的:這些議題會在日後新增互動功能時反覆浮現(每加一個可互動元件,就要人工判斷它該歸哪一邊,該不該加按鍵守衛,該不該在失焦時收尾).先寫下來,避免每次都重新調研一遍,也避免在做別的需求時順手夾帶.

**依「真痛三條件」判定,以下絕大多數為「設計限制(文件化)」而非「必修 bug」**:皆未實機重現、未有 bug 紀錄,後果多屬「日後擴充時容易踩」而非「現在就會壞」.列於此即為文件化,不主動處理.

來源:2026-08-23 之互動矩陣複審(GPT-5.6 Sol).標「已驗證」者為本人獨立以 file:line 核對過;其餘為複審主張,採信但未逐一複核.

---

## 一, 目標分類器只回布林值,無法表達角色差異

**現況**:`isCanvasInteractiveTarget(event)` 回傳布林值,只能回答「是不是元素」([WFlowVue.vue:759-773](node_modules/w-flow-vue/src/components/WFlowVue.vue#L759-L773));而平移分支另有一份較窄的 `closest()` 清單([:784-798](node_modules/w-flow-vue/src/components/WFlowVue.vue#L784-L798)).

**問題**:

- 兩份清單的差集是連線(`.vue-flow__edge`),於是「按在連線上拖曳」會平移畫布,「按在節點上拖曳」不會——這是刻意保留的既有行為,但兩份清單分岔,日後易只改一邊.
- 「元素側」實際包含語義完全不同的角色:節點本體(切換選取)、連線(不改選取)、來源連接點(拉線)、目標連接點(無作用)、縮放把手(縮放)、齒輪(開設定)、轉折點(移動該點)、控制選單(執行命令).用一個布林值表達等於抹平差異.
- 連接點與縮放把手用 `@mousedown.stop`([Handle.vue:9](node_modules/w-flow-vue/src/components/nodes/Handle.vue#L9)、[NodeBody.vue:14-17](node_modules/w-flow-vue/src/components/nodes/NodeBody.vue#L14-L17)),根本到不了畫布層的分類器;轉折點與齒輪則刻意不 stop.同列「元素側」不代表冒泡契約相同.
- `viewport-overlay` slot 內若放入未帶既有 class 的可互動內容,分類器會判為空白.**「新增元件記得加進 class 清單」是易漏的人工作業,不是封閉邊界**.

**方向**:改為 `classifyTarget(event)` 回傳角色列舉(`canvas` / `node-body` / `edge-path` / `edge-label` / `source-handle` / `target-handle` / `resize` / `node-settings` / `edge-settings` / `waypoint` / `controls` / `popup-trigger` / `overlay`),再以政策表逐欄回答 `canStartPan`、`canStartBox`、`selectionIntent`、`viewIntent`、`primaryButtonOnly`.兩個手勢共用分類器但各讀各的政策欄,而非共用同一份排除結果.

### 附:`.vue-flow__popup` 兩處守衛是死碼(已驗證)

[WFlowVue.vue:725](node_modules/w-flow-vue/src/components/WFlowVue.vue#L725) 與 [:777](node_modules/w-flow-vue/src/components/WFlowVue.vue#L777) 皆有 `closest('.vue-flow__popup')` 早退,但**全套件沒有任何元素掛此 class**;popup 內容的 class 是 `WPopperFix` 且被 teleport 到 body.popup 內容之所以不會啟動畫布手勢,是因為它不在 canvas 的 DOM 子樹內,與這兩行無關.無害,但看起來像有防護其實沒有.

---

## 二, 四個手勢旗標不是互斥狀態機

**現況**:`isPanning` / `isDraggingNode` / `isConnecting` / `isSelecting` 為四個獨立布林值([WFlowVue.vue:311-359](node_modules/w-flow-vue/src/components/WFlowVue.vue#L311-L359)).

**問題**:`onDocMouseMove` 以 `if / else if` 只處理優先者,`onDocMouseUp` 卻逐一結束所有為真者([:828-880](node_modules/w-flow-vue/src/components/WFlowVue.vue#L828-L880)).兩者的假設不同——前者假設互斥,後者假設可並存.先前「框選與節點拖曳同時為真,放開時選取被覆寫」正是此結構的產物;1.0.25 是在入口把它們隔開,而非讓狀態互斥.

**方向**:改為單一 `activeGesture` 狀態(含 `idle`、`node-drag-candidate`、`panning`、`box-selecting`、`node-dragging`、`connecting`、`resizing`、`waypoint-dragging`),並把 `viewport-animating` 視為需仲裁的正交狀態.

---

## 三, 各手勢的終止契約不一致

**現況**(複審整理,方向已由本人抽樣核對):

| 手勢 | 視窗失焦 | 滑鼠移出視窗放開 | 元件銷毀 | 主鍵放開偵測 |
|---|---|---|---|---|
| 畫布平移 | 結束 | 由 `buttons` 守衛收尾 | — | 有 |
| 節點拖曳 | **提交**當下位置 | 由 `buttons` 守衛收尾 | 有 | 有 |
| 框選 | **取消** | 同上 | — | 有 |
| 節點縮放 | 提交 | **無 `buttons` 守衛** | 有 | **無** |
| 連線建立 | **未收尾** | 無 | **未清理**全域 cursor style | 無 |
| 轉折點拖曳 | **未收尾** | 無 | **EdgeWrapper 無 `beforeDestroy`** | 無 |

**問題**:同一類事件(手勢中斷)在六個地方有六種處理.其中連線建立與轉折點拖曳的缺口最實際——`onConnectStart` 會把 `* { cursor: ... }` 插入 `document.head`([WFlowVue.vue:1018-1020](node_modules/w-flow-vue/src/components/WFlowVue.vue#L1018-L1020)),`beforeDestroy` 未移除([:387-398](node_modules/w-flow-vue/src/components/WFlowVue.vue#L387-L398)),若在拉線途中切換路由,整頁游標會卡住直到重新整理.

**方向**:統一為 `cancel(reason)` / `commit()` 兩個終止路徑,由狀態機在 `mouseup` / `blur` / `buttons=0` / `destroy` / `lock-change` 五種來源呼叫,每種手勢只宣告「該來源要 commit 還是 cancel」.

---

## 四, `locked` 只在手勢起點判定,且 `opt.locked` 只讀一次

**現況**:

- 各 `start` handler 判 `locked`,但 `doDrag` / `doSelection` / resize 的 move 迴圈不再重判([WFlowVue.vue:963-1007](node_modules/w-flow-vue/src/components/WFlowVue.vue#L963-L1007) 等).手勢進行中上鎖不會取消,終點照樣提交.
- `opt.locked` 只在 `data()` 初始化時讀一次([:319](node_modules/w-flow-vue/src/components/WFlowVue.vue#L319)),之後只有控制選單的 `toggleInteractive()` 會改內部狀態([:1413-1415](node_modules/w-flow-vue/src/components/WFlowVue.vue#L1413-L1415)).**宿主從外部改 `opt.locked` 不會生效**.
- `toggleInteractive()` 不清既有選取,也不取消進行中手勢.

**方向**:`locked` 改為受控 prop 並定義 `enterLocked` / `leaveLocked` 兩個 transition,明列對選取、進行中手勢、設定 popup、hover UI、發出事件的處置.

### 附:存在未定義的第三態

控制選單的鎖頭鈕不檢查編輯權限,而框選只判 `!locked && elementsSelectable`,不判權限.故**無編輯權限者可解除鎖定後框選**——既非「一般狀態」也非「編輯狀態」.宿主是以 `opt.nodesDraggable / nodesConnectable / nodesResizable / nodesSettingsEnabled = hasEditPerm` 表達權限([LayoutContentAmfs.vue:1479-1483](src/components/LayoutContentAmfs.vue#L1479-L1483)),套件本身沒有權限概念.

現況無實害(該狀態下拖曳/建線/縮放/設定皆被個別旗標擋住,只是多了一個空的框選),但語義上是破口.

---

## 五, popup 缺完整狀態機,且 `editable` 語義過載

**現況**:資訊 popup 與設定 popup 各自為 `NodeWrapper` / `EdgeWrapper` 的區域狀態,兩者以 watcher 互斥;外部點擊關閉由 `buildPopper` 的全域 mousedown 堆疊處理.

**問題**:

- **`editable` 同時擋 `evShow`、`evHide` 與 `updateValue`**(已驗證:[buildPopper.mjs:504-509](node_modules/w-component-vue/src/js/buildPopper.mjs#L504-L509)、[:526-531](node_modules/w-component-vue/src/js/buildPopper.mjs#L526-L531)、[:462-468](node_modules/w-component-vue/src/js/buildPopper.mjs#L462-L468)).**它不能當作「只擋開啟」的開關**——popup 已開時把 `editable` 設為 false,會導致外部點擊也關不掉.節點拖曳途中以 `infoPopupEditable = false` 抑制 popup 之所以沒事,是因為當下 popup 已被設為關閉.
- 以下組合皆無明文規格:popup 開啟時點同一 trigger、點另一個節點/連線、點空白、點控制選單、滾輪縮放、上鎖.
- 滾輪不會觸發 popup 的外部關閉,故 popup 可保持開啟同時改變視口;而視口寫入不會呼叫 popper 的位置更新,popup 是否跟著節點移動需實測確認.

**方向**:popup 的開啟改為由 wrapper 依「已分類的語意點擊」統一決定(**`WPopup` 的 `isolated` 預設為 `false`,故 trigger 點擊只是向父層 `$emit` 請求,實際開啟權在 v-model 擁有者**——見 [buildPopper.mjs:478-502](node_modules/w-component-vue/src/js/buildPopper.mjs#L478-L502)),並補一份 popup 狀態轉移表.**不要再用 `editable` 當抑制開關**.

---

## 六, 事件契約不一致

**現況**:

- `selection-change` 只在部分路徑發出:節點/連線點擊與框選會發,但空白點擊清空、拖曳前置改選取、公開 API `setSelected*`、宿主 `focusNode` 都不發([WFlowVue.vue:666-675](node_modules/w-flow-vue/src/components/WFlowVue.vue#L666-L675) 等).若選取是規格狀態,觀察者無法看到每次轉移.
- `node-click` / `conn-click` 與選取政策綁在同一個 handler.**已驗證**:宿主 `ckNode` 是靠 `node-click` 同步左側樹的 active item([LayoutContentAmfs.vue:1742-1757](src/components/LayoutContentAmfs.vue#L1742-L1757)),這是檢視功能;若日後要為選取加守衛(如「鎖定態不產生選取」),不能在 handler 最前面早退,否則會連事件一起吞掉而破壞樹同步.**選取變更與語意事件發送必須拆開**.
- 群組拖曳的 `node-drag-start` / `node-drag-stop` payload 只帶被抓的那一顆,其餘成員只能從最後的全量 `update:nodes` 得知.

**方向**:選取變更集中到單一 transition 函式(所有入口共用,統一發事件),語意點擊事件獨立於選取政策之外.

---

## 七, 「連線」不是單一目標

**已驗證**:同一條連線至少有三個行為不同的 hit target:

| target | 點擊行為 |
|---|---|
| 120×36 透明 hover rect([EdgeWrapper.vue:9-17](node_modules/w-flow-vue/src/components/edges/EdgeWrapper.vue#L9-L17)) | 選取該連線 + 開 popup |
| interaction path([:19-25](node_modules/w-flow-vue/src/components/edges/EdgeWrapper.vue#L19-L25)) | 同上,另有雙擊與右鍵事件 |
| 名稱 label([:72](node_modules/w-flow-vue/src/components/edges/EdgeWrapper.vue#L72)) | **只開 popup,不選取該連線**,也不發 `conn-click` |

且可見的 path 設為 `pointer-events:none`,真正的命中區是那條較寬的 interaction path;hover rect 更把可點區擴成中點附近 120×36,**看起來是空白處也可能攔截畫布手勢**.

任何以「點連線」為單位的規格描述都不精確.

---

## 八, 附屬元件缺主鍵守衛

**已驗證**:全套件僅畫布層([WFlowVue.vue:777](node_modules/w-flow-vue/src/components/WFlowVue.vue#L777))與節點本體([NodeWrapper.vue:282](node_modules/w-flow-vue/src/components/nodes/NodeWrapper.vue#L282))判 `event.button`.以下三者皆無,故右鍵或中鍵按下即可啟動手勢:

- 來源連接點 → 進入連線建立([Handle.vue:43-50](node_modules/w-flow-vue/src/components/nodes/Handle.vue#L43-L50))
- 四角縮放把手 → 進入縮放([NodeBody.vue:14-17](node_modules/w-flow-vue/src/components/nodes/NodeBody.vue#L14-L17))
- 轉折點 → 進入轉折點拖曳([EdgeWrapper.vue:411-445](node_modules/w-flow-vue/src/components/edges/EdgeWrapper.vue#L411-L445))

---

## 九, 視口寫入無仲裁

**現況**:滾輪縮放綁在畫布根元素且不檢查目標與進行中手勢,故游標停在節點、連線、齒輪、控制選單上皆可縮放,平移/拖曳/框選/建線/縮放/轉折點進行中也可同時縮放.

`startPan` 與滾輪會取消程式視口動畫(`panToNode`),但節點拖曳、框選、建線、縮放、轉折點、控制選單的縮放與全圖顯示都不取消.

**尺度換算基準也不一致**:節點拖曳每步以「當下 zoom」換算累積的螢幕位移,縮放與轉折點則在 mousedown 時只快照一次 zoom.故手勢途中縮放,三者的幾何結果彼此不同.

**方向**:視口寫入集中到單一仲裁點,明定手勢進行中的視口變更是禁止、取消手勢、或以起始視口換算.

---

## 十, 輸入裝置與鍵盤契約未宣告

**現況**:全部只綁 `mousedown` / `mousemove` / `mouseup` / `wheel`,document 層亦然.**沒有 pointer events、沒有 pointer capture、沒有 touch events、沒有 `touch-action` 政策**.

**後果**:

- 觸控是否可用,取決於瀏覽器是否把 tap 合成 mouse 事件——屬瀏覽器相容行為,非套件契約.觸控筆與多指則完全未定義,也沒有 `pointercancel` 的處理.
- 鍵盤:popup 的 trigger 雖有 `tabindex="0"`,但只綁 click 與 mouseenter/leave,**沒有 Enter / Space / Escape 契約**.
- 全域 Delete 鍵監聽不排除 `input` / `textarea` / `contenteditable`([WFlowVue.vue:711-721](node_modules/w-flow-vue/src/components/WFlowVue.vue#L711-L721)).本專案因 `deleteKeyEnabled: false` 不受影響,但其他消費端若啟用,在設定表單內按 Delete 會刪掉選取的元素.
- 右鍵與中鍵未 `preventDefault`,故原生選單與中鍵自動捲動是否出現亦未定義;滾輪則一律 `.prevent` 並當作圖台縮放.

**方向**:先明文宣告「僅支援滑鼠主鍵」,或改用 pointer events 並處理 capture 與 cancel.**兩者擇一,不要維持現況的未定義狀態**.

---

## 十一, 雙擊不是獨立輸入

**現況**:一次雙擊之前必定先發生兩次完整的單擊——畫布會清空選取兩次並發兩次 `pane-click`,節點會選取兩次並發兩次 `node-click`(且第一次會開 popup),之後才發出雙擊事件.

任何把雙擊寫成「獨立一格」的規格都不精確;若日後要為雙擊定義行為,必須連帶定義前兩次單擊的副作用是否保留.

---

## 處置

**以上一律不做**,除非:

1. 某項被實機重現並造成具體損害(屆時以「必修 bug」單獨處理,取最小改動);
2. 或新需求恰好落在該項的範圍內(屆時連帶處理,並在該次改動中明確標示)。

新增任何可互動元件時,回頭檢查第一節(分類器清單)、第三節(終止契約)、第八節(主鍵守衛)三項,避免再擴大缺口.
