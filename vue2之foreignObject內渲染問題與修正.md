# Vue 2 SVG foreignObject Namespace 問題修正

## 問題現象

在 SVG `<foreignObject>` 內使用 Vue 組件（如 WPopup）時，組件的 slot content 完全不渲染 — 元素尺寸為 0×0，視覺上不可見。但直接在 foreignObject 內渲染的 HTML 元素（不經過組件）則正常。

## 根本原因

**Vue 2 已知 bug（#7330 / #11315）：組件在 SVG foreignObject 內使用時，namespace 繼承不會跨越組件邊界重置。**

### Vue 2 的 namespace 機制

`src/core/vdom/create-element.ts` L93：
```javascript
ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
```

每個組件的 `_createElement` 在 render 時，會從 `context.$vnode.ns` 繼承 namespace。如果組件在 SVG 環境中（`$vnode.ns === 'svg'`），組件內部渲染的**所有元素**都會用 `document.createElementNS('http://www.w3.org/2000/svg', tag)` 建立。

### foreignObject 的修復不完整

Vue 2.6.13 的 #11576 修復了 `applyNS` 函數，讓 `foreignObject` 的**靜態子元素**能正確重置為 HTML namespace：

```javascript
function applyNS(vnode, ns, force) {
    vnode.ns = ns
    if (vnode.tag === 'foreignObject') {
        ns = undefined  // 重置為 HTML
        force = true
    }
    // 遍歷 children...
}
```

但 `applyNS` 只遍歷 VNode 的靜態 children，**不會跨越組件邊界**。組件 VNode 是 `createComponent` 建立的，沒有 `children`（而是有 `componentOptions`），不會被 `applyNS` 遍歷。

### 事件鏈

```
SVG <g> (ns='svg')
  → foreignObject (applyNS 重置 ns=undefined)
    → <div xmlns="xhtml"> (ns=undefined → HTML ✓)
      → <span> (HTML ✓)
        → WPopup 組件 (context.$vnode.ns = 'svg' ← 從 EdgeWrapper 繼承！)
          → WPopup 內部 <div> (ns='svg' → SVGElement → 0×0 ✗)
            → <div ref="divTrigger"> (ns='svg' → 0×0 ✗)
              → slot content <span> (ns='svg' → SVGElement → 0×0 ✗)
```

**slot content 的 VNode 在 EdgeWrapper 的 render context 裡建立**，EdgeWrapper 的 `$vnode.ns` 是 `'svg'`（從 SVG `<g>` 繼承），所以 slot 內的所有元素都被建立為 SVGElement。

### 驗證

用 Playwright 確認：
```
直接渲染的 icon:   tag="SPAN", ns="http://www.w3.org/1999/xhtml", w=22, h=22 ✓
WPopup 內的 icon:  tag="span", ns="http://www.w3.org/2000/svg",   w=0,  h=0  ✗
```

SVG namespace 的 `<span>` 不是 HTML 元素，瀏覽器不會套用 CSS layout（width/height/display 等都無效）。

## 修正方案

### fixSvgNs Mixin（3 行核心程式碼）

```javascript
const fixSvgNs = {
    beforeCreate() {
        if (this.$vnode) this.$vnode.ns = undefined
    },
    beforeMount() {
        if (this.$vnode) this.$vnode.ns = undefined
    },
    beforeUpdate() {
        if (this.$vnode) this.$vnode.ns = undefined
    },
}
```

在 `beforeCreate`、`beforeMount`、`beforeUpdate` 三個生命週期清除 `$vnode.ns`。這樣 `_createElement` 在 render 時讀到 `context.$vnode.ns` 為 `undefined`，就會用 `document.createElement(tag)`（HTML namespace）而非 `document.createElementNS('svg', tag)`。

### 全域套用（最終方案）

在專案入口 `main.js` 加一次 `Vue.mixin`，所有組件自動生效：

```javascript
// src/main.js
import Vue from 'vue'

Vue.mixin({
    beforeCreate() {
        if (this.$vnode && this.$vnode.ns === 'svg') this.$vnode.ns = undefined
    },
    beforeMount() {
        if (this.$vnode && this.$vnode.ns === 'svg') this.$vnode.ns = undefined
    },
    beforeUpdate() {
        if (this.$vnode && this.$vnode.ns === 'svg') this.$vnode.ns = undefined
    },
})
```

不需要在個別組件注入 mixin，不需要修改第三方組件（WPopup/WTooltip）。

### 為什麼全域 mixin 是安全的

`fixSvgNs` 只在 `$vnode.ns === 'svg'` 時清除 ns。清除後，`_createElement` fallback 到 `config.getTagNamespace(tag)`：

- `getTagNamespace('svg')` → `'svg'` ✓（SVG 元素仍正確用 SVG namespace）
- `getTagNamespace('circle')` → `'svg'` ✓（所有 SVG 子元素都在 `isSVG` map 中）
- `getTagNamespace('div')` → `undefined` ✓（HTML 元素用 HTML namespace）

所有 SVG tag（svg、path、circle、rect、g、line 等）都在 Vue 2 的 `isSVG` map 中，`getTagNamespace` 會正確回傳 `'svg'`。**全域 mixin 不會影響正常的 SVG 渲染。**

### 備註

此 mixin 也可在個別組件內使用（`mixins: [fixSvgNs]`），但建議使用全域 `Vue.mixin` 一次套用，避免在每個 foreignObject 內的組件都手動注入。

## 為什麼三個生命週期都需要

| 生命週期 | 作用 |
|---------|------|
| `beforeCreate` | 首次建立組件時，在第一次 render 前清除 ns |
| `beforeMount` | 組件即將掛載到 DOM 前，確保 patch 階段用正確 namespace 建立元素 |
| `beforeUpdate` | 資料變更觸發重新 render 前清除 ns（否則只有第一次有效，之後恢復 SVG namespace） |

只用 `beforeCreate` 的話，第一次開 popup 正常，關閉後重開就會恢復 SVG namespace。

## 調查過程中排除的方案

| 方案 | 問題 |
|------|------|
| inline style 取代 CSS class | foreignObject 裡的 SVGElement 即使有正確的 inline style，`getBoundingClientRect` 仍然回傳 0 |
| 非 scoped CSS | CSS 有套用（computed style 正確），但 DOM 元素是 SVGElement 所以瀏覽器不做 layout |
| `display: inline-block !important` 強制 | 同上，CSS 算出正確值但元素不 layout |
| post-mount DOM 替換（`replaceChild`） | 能修正 namespace 和渲染，但**破壞 Vue 事件綁定和 reactivity** |
| render function 清除 children VNode ns | 只能清自己的 children，**無法跨組件邊界**影響子組件的 render context |
| HtmlNsWrapper 組件 | 同上，子組件的 `_createElement` 仍讀自己的 `$vnode.ns` |

## 影響範圍

全域 mixin 對每個 Vue 組件都會執行 `if (this.$vnode && this.$vnode.ns === 'svg')` 判斷。
- **不在 SVG 環境中的組件**：`$vnode.ns` 不是 `'svg'`，條件不成立，零影響
- **SVG 環境中的組件**：`$vnode.ns` 被清為 `undefined`，fallback 到 `getTagNamespace(tag)` — SVG 元素仍正確取得 SVG namespace，HTML 元素取得 HTML namespace
- **效能影響**：每個組件 3 個生命週期各一次 `if` 判斷 + 一次賦值，可忽略

## 相關 Vue 2 Issue

- [vuejs/vue#7330](https://github.com/vuejs/vue/issues/7330) — Components inside foreignObject rendered in SVG namespace
- [vuejs/vue#11315](https://github.com/vuejs/vue/issues/11315) — Components slots not rendered inside svg foreignObject
- [vuejs/vue#11576](https://github.com/vuejs/vue/issues/11576) — Give correct namespace in foreignObject（2.6.13 部分修復）