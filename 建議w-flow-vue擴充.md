# 建議 w-flow-vue 擴充：圖台加入觸控支援（目前手機或平板模式下完全無法操作）

> 提出日期：2026-09-21
> 對象套件：`w-flow-vue@1.0.50`（本專案自 `w-flow-vue/src/components/WFlowVue.vue` 引入）
> 性質：**契約軸缺漏**（互動契約之「輸入事件」軸只有滑鼠，觸控未列入亦未明文排除），非既有承諾未兌現

## 一、現象

以瀏覽器之手機或平板模式（即觸控事件取代滑鼠事件）開啟評估模式流程系統之圖台後：

1. 畫布**無法拖曳平移**；
2. 節點**無法拖曳移動**，四角縮放、轉折點拖曳、標籤位移同樣無效；
3. 雙指捏合**無法縮放**。

使用者以手指操作時圖台毫無反應，等同該系統在觸控裝置上不可用。

## 二、根因

套件 `src/` 內對 `touchstart`／`touchmove`／`pointerdown`／`touch-action` 之命中檔案數為 **0**，對照 `mousedown` 之命中檔案數為 **7**。全部互動只綁滑鼠：

| 手勢 | 監聽處 |
|---|---|
| 畫布平移、框選 | `src/components/canvas/FlowCanvas.vue:5`～`:10`（僅 `@mousedown`／`@mousemove`／`@mouseup`／`@wheel`／`@dblclick`／`@contextmenu`）；`src/components/WFlowVue.vue:585`～`:586`（`document.addEventListener('mousemove'／'mouseup')`，為平移位移量之唯一來源） |
| 節點拖曳、四角縮放、轉折點拖曳、標籤位移 | `src/js/domGesture.mjs:75`～`:77`（`document` 上只掛 `mousemove`／`mouseup`／`blur`）；`src/components/nodes/NodeWrapper.vue:7`～`:8` |

瀏覽器對觸控**拖曳**不會補送相容滑鼠事件（相容事件只在未被判為捲動手勢之點按結束時才補送），故整段拖曳期間 `mousedown`／`mousemove` 一個都收不到，平移與拖曳的起點函式從未被呼叫。

**另有三個次級障礙**，只補監聽仍不會動，修法須一併處理：

1. `doPan` 直接讀 `event.clientX`／`clientY`（`WFlowVue.vue:996`～`:998`），而 `TouchEvent` 之座標在 `touches[0]` 上。
2. 四道主鍵守衛會把觸控事件當成「主鍵未按下」而立刻收尾：`WFlowVue.vue:821` 之 `event.button !== 0`、`:851` 之 `(event.buttons & 1) === 0`、`domGesture.mjs:67` 之 `requirePrimary`、`domGesture.mjs:23` 之 `gestureBlockedReason`。`TouchEvent` 沒有 `button`／`buttons`。
3. `.vue-flow` 未宣告 `touch-action`（實測 computed 為 `auto`），補了監聽仍會被瀏覽器判給頁面捲動或縮放。

## 三、實測

Playwright Chromium，`hasTouch: true`、`isMobile: true`，以 Chromium 之完整手勢管線（`Input.synthesizeScrollGesture`、`Input.synthesizePinchGesture`，非低階事件注入）送手勢，量 `.vue-flow__viewport` 之 `style.transform`。headless 與有頭兩種模式結果一致。

| 測項 | 送出 | 圖台收到 | transform 變化 |
|---|---|---|---|
| 滑鼠拖曳（對照組） | 按下、14 段移動（-140,-110）、放開 | mousedown 1、mousemove 15、mouseup 1 | 精準平移 -140,-110 |
| 觸控拖曳畫布 | 同起點同距離之觸控手勢 | touchstart 1、pointermove 19、touchend 1，**滑鼠事件 0** | **完全未變** |
| 觸控拖曳節點 | 同上 | touchstart 1、pointermove 30、touchend 1 | 節點座標未變 |
| 雙指捏合 | 放大兩倍 | touchstart 2、touchmove 30、touchend 2 | `scale` 未變 |

最能說明問題的一句：觸控拖曳時瀏覽器確實把 19 至 34 個 `pointermove`（`pointerType=touch`）送到了視窗，圖台完全沒反應；同一段距離換成滑鼠只要 15 個 `mousemove` 就精準平移。

## 四、建議作法（依 CP 值排序）

1. **`src/js/domGesture.mjs:48`～`:82` 之 `startDocumentGesture`**：加掛 `touchmove`（`{ passive: false }`）／`touchend`／`touchcancel`，進 `onMove` 前把事件正規化為 `{ clientX, clientY, buttons: 1 }`（單指取 `touches[0]`，多指視為結束）；`:67` 之 `requirePrimary` 對觸控來源跳過。**此處一改，節點拖曳、四角縮放、轉折點拖曳、標籤位移四個手勢同時到位**（共用此工具）。
2. **畫布平移與框選**（`FlowCanvas.vue:5`～`:10`、`WFlowVue.vue:585`～`:586`、`:819`～`:875`）：此鏈不走 `domGesture`，需各自補觸控入口與 `document` 層之 `touchmove`／`touchend`；`:821` 與 `:851` 之主鍵守衛同樣要對觸控來源放行。
3. **`FlowCanvas.vue` 之 `.vue-flow` 樣式**補 `touch-action: none`，否則補了監聽仍被瀏覽器判為捲動。可一併考慮雙指捏合縮放（目前只認 `wheel`）。

建議比照貴方既有家規之寫法：`wsemi/src/domDragBarAndScroll.mjs:132`～`:226` 已是滑鼠與觸控成對之實作（`touchmove` 用 `{ passive: false }`、座標取 `touches[0].clientX`／`clientY`），`WDrawer`、`WSlider`、`WPanelDivide` 系列皆用它；集中一處處理可避免各元件散寫。另建議同步補上 `spec/流程_互動契約.md:31` 之「輸入事件」軸之觸控成員，否則契約仍停在滑鼠。

## 五、本專案之處置

宿主（`src/components/LayoutContentAmfs.vue:254`～`:285`）只是把 `opt` 傳給 `WFlowVue`，套件未提供任何觸控相關之 `opt`，故**不是宿主設定漏給**。

呼叫端理論上可在圖台容器掛一層觸控轉譯為滑鼠事件之墊片（座標取 `touches[0]`、補 `button: 0`／`buttons: 1`、容器加 `touch-action: none`），套件端沒有會擋下合成事件之檢查，技術上可行；但它只救這一個系統，且套件日後自行支援觸控時會與該層打架，故本專案暫不實作，等套件端決定。

## 附記

調查期間另觀察到：於 430×932 之手機尺寸視窗下，圖台 60 秒內未渲染出任何節點（等不到節點元素）。與觸控議題不同源，尚未調查，一併提供給貴方參考。
