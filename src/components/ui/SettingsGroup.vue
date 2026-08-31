<template>
  <div class="vue-flow__settings-group">
    <!-- APG accordion 要求標題按鈕包在 heading 內並帶 aria-level; 用 role="heading" 而非 <h3>,
         避免設定表單之標題進入宿主頁面的文件大綱(層級由 headingLevel 交給宿主決定) -->
    <div role="heading" :aria-level="headingLevel" class="vue-flow__settings-group-heading">
      <button
        type="button"
        class="vue-flow__settings-group-head"
        :id="headId"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="panelId"
        @click="$emit('update:open', !open)"
      >
        <svg class="vue-flow__settings-group-caret" :class="{ 'vue-flow__settings-group-caret--open': open }" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          <path :d="caretPath" fill="currentColor"/>
        </svg>
        <span class="vue-flow__settings-group-title">{{ title }}</span>
      </button>
    </div>
    <div
      :id="panelId"
      class="vue-flow__settings-group-panel"
      :class="{ 'vue-flow__settings-group-panel--closed': !open }"
      :data-group-key="groupKey"
      role="region"
      :aria-labelledby="headId"
    >
      <slot/>
    </div>
  </div>
</template>

<script>
import { CARET_PATH } from '../../js/icons.mjs'

/**
 * 設定表單之可顯隱群組(節點/連線設定 popup 共用)。
 *
 * 互動契約(同類產品之通用作法, 見 https://en.wikipedia.org/wiki/Disclosure_widget):
 *   三角形朝右 = 收合、朝下 = 展開 —— 符號表示「目前狀態」而非「按下去會怎樣」(macOS / Finder / Xcode 一路的
 *   disclosure triangle 語義); 展開時以 rotate(90deg) 由朝右轉為朝下, 狀態切換有連續性。
 *   整條標題列(三角形 + 標題)皆為可點區, 非只有三角形。
 *
 * 無障礙結構依 W3C ARIA APG accordion pattern(https://www.w3.org/WAI/ARIA/apg/patterns/accordion/):
 *   標題按鈕包在 role="heading"(aria-level 由 headingLevel 指定)內, 按鈕帶 aria-expanded / aria-controls,
 *   內容區帶 role="region" 與 aria-labelledby。button 原生即可被 Tab 聚焦、Enter/Space 觸發, 不需另掛鍵盤處理。
 *
 * 收合以「height:0 + visibility:hidden」而非 display:none: 內容仍參與寬度計算, popup 寬度不隨展開/收合跳動;
 * visibility:hidden 同時使收合內容不可被 Tab 聚焦。刻意不做高度過場動畫 —— popup 由 popper 定位,
 * 高度逐幀變動會讓整個 popup 在動畫期間持續位移; 狀態連續性改由三角形旋轉表達。
 *
 * 展開態由呼叫端持有(:open + @update:open, 即 :open.sync), 使宿主可決定預設展開哪幾群、是否記憶。
 */
export default {
    name: 'SettingsGroup',
    props: {
        title: { type: String, required: true },
        open: { type: Boolean, default: false },
        //標題之 aria-level(APG accordion 要求); 宿主可依自身標題層級調整
        headingLevel: { type: Number, default: 3 },
        //群鍵: 僅輸出為 data-group-key, 供測試自 DOM 反查「欄位實際落在哪一群」(欄位歸屬之驗證錨點)
        groupKey: { type: String, default: '' },
    },
    computed: {
        caretPath() {
            return CARET_PATH
        },
        headId() {
            return `vue-flow-settings-group-head-${this._uid}`
        },
        panelId() {
            return `vue-flow-settings-group-panel-${this._uid}`
        },
    },
}
</script>

<style>
/* 全域(非 scoped)之理由: 與 .vue-flow__settings-form 同一政策 —— vue-flow__ 前綴之 class 為對外公開之
   樣式覆寫點, scoped 之 data-v 會使宿主無法覆寫。(與 Teleport 無關: data-v 為編譯期屬性, 元素被搬到
   body 仍帶著, scoped 一樣生效。) */
.vue-flow__settings-group {
  display: flex;
  flex-direction: column;
}
/* heading wrapper 僅供無障礙語意: 於 flex column 中本即 stretch, 其內 button 為 width:100%, 故版面不變。
   刻意不用 display:contents —— 部分瀏覽器會將其移出無障礙樹, 反而使 role="heading" 失效 */

/* 標題列: 整列可點之按鈕, 底色 full-bleed 貼齊 popup 左右邊緣。
   ── full-bleed 之作法與理由 ────────────────────────────────────────────────
   表單水平內距 12px 為對齊基準線; 本列以 margin:0 -12px 突破之而貼齊 popup 邊緣, 再以 padding 補回同樣的
   12px, 故標題文字與欄位標籤落在同一條垂直線上(實測兩者 x 相同)。分區用的 section header 本就該橫貫容器
   ——若左右各留白邊, 底色會變成「浮在中間的色塊」而非分區帶(Ant Design Collapse 之 header 亦貼齊容器邊緣)。
   貼齊邊緣者不留圓角(圓角是浮起元素的語彙, 與 full-bleed 相斥)。
   ── 數值依據 ──────────────────────────────────────────────────────────────
   padding 6px 12px: 左右 12px 對齊 Ant Design Collapse small size 之 header padding(8px 12px);
   上下 6px 使列高 27px, 對比欄位列 18px 有 9px 落差 —— 群標題與欄位若僅差字重字級且等高, 視覺上分不出分區。
   底色 #f0f0f0 與 hover 之 #ddd 皆為專案既有色票, 且語義同族: #f0f0f0 是本專案「可點元素的淺灰底」
   (工具列按鈕之 hover/focus 底、節點/連線齒輪底), 而本列正是整列可點之按鈕。 */
.vue-flow__settings-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  /* full-bleed: 100% 為表單內容寬(已扣掉左右各一份 inline padding), 補回兩份即回到 popup 全寬;
     負 margin 讓左緣對齊 popup 左緣, 同值 padding 再把文字推回表單的對齊基準線。
     實測不可只寫 width:auto —— 該狀態下灰帶只撐到文字寬(量得右緣距 popup 右緣 170.8px), 未填滿可用寬。 */
  width: calc(100% + var(--vf-settings-inline-padding) * 2);
  margin: 0 calc(-1 * var(--vf-settings-inline-padding));
  padding: 6px var(--vf-settings-inline-padding);
  /* 高度為契約而非內容偶然撐出: 27px 對欄位列 18px 有 9px 落差, 兩者等高就讀不出分區 */
  min-height: 27px;
  border: 0;
  /* 貼齊 popup 邊緣者不留圓角(圓角是浮起元素的語彙, 與 full-bleed 相斥); 明寫以免依賴 UA 預設 */
  border-radius: 0;
  appearance: none;
  background: var(--vf-settings-surface);
  /* 文字色繼承 popup 之 textColor(opt.settingsPopupTextColor), 不硬寫 —— 否則宿主換深色主題即崩 */
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}
.vue-flow__settings-group-head:hover {
  background: var(--vf-settings-surface-hover);
}
/* 鍵盤焦點: 明寫內縮式 focus ring —— UA 預設 outline 畫在元素外緣, 於 full-bleed 標題列上會被
   捲動容器(表單 overflow)的邊界裁掉而看不見 */
.vue-flow__settings-group-head:focus-visible {
  outline: 2px solid var(--vf-settings-caret-hover);
  outline-offset: -2px;
}
/* 相鄰之收合群緊貼成一片灰, 以 1px 底色線區隔成清單(前一群若為展開態, 其內容即為底色, 此線自然隱形) */
.vue-flow__settings-group + .vue-flow__settings-group .vue-flow__settings-group-head {
  border-top: 1px solid var(--vf-settings-divider);
}
/* 三角形: 收合朝右, 展開轉 90 度朝下(0.15s 與元素 affordance 之淡入淡出同時長)。
   色階取 #888(專案既有色票, 見 resolveOpt 之 inforPopupDescriptionTextColor): 三角形是狀態指示圖示,
   WCAG 2.2 之 1.4.11 non-text contrast 要求對背景 ≥3:1 —— #888 對白底為 3.55:1, 而 #999 僅 2.85:1 不合格 */
/* 三角形色階以「相鄰色」為準: 它坐在標題底色上而非白底。#666 對預設底色 rgba(0,0,0,0.06)(白底上等同
   #f0f0f0)為 5.04:1; 先前的 #888 只有 3.11:1 —— 雖仍過 WCAG 2.2 §1.4.11 的 3:1, 餘裕過小, 換主題即不成立
   (誤以白底計算會得到 3.55:1 的高估值)。 */
.vue-flow__settings-group-caret {
  flex-shrink: 0;
  color: var(--vf-settings-caret);
  transition: transform 0.15s ease, color 0.15s ease;
}
.vue-flow__settings-group-caret--open {
  transform: rotate(90deg);
}
.vue-flow__settings-group-head:hover .vue-flow__settings-group-caret {
  color: var(--vf-settings-caret-hover);
}
/* 標題: 字級以 em 相對表單 root, 使 opt.settingsPopupTextFontSize 能同步縮放(硬寫 px 會讓標題與欄位比例失衡);
   0.92em 於預設 12px 下為 11.04px。長標題不換行, 以 ellipsis 截斷以維持 27px 之列高契約。 */
.vue-flow__settings-group-title {
  font-size: 0.92em;
  font-weight: 600;
  letter-spacing: 0.3px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 內容區: 左縮排 16px(三角 10 + 間隙 6) —— 標題列之 12px 已由表單水平內距提供, 故此處只需補三角形佔的寬度,
   即可讓欄位標籤左緣對齊群標題文字左緣。與標題列距 6px(群內親密性, 小於群與群之間的 8px) */
.vue-flow__settings-group-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* 上 6px: 與自身標題列較近(群內親密性)。
     下 10px: 展開內容之下緣呼吸 —— 這是表單內**唯一**的縱向間距來源, 且收合時歸零。
     群與群之間、末群與刪除區分隔線之間一律緊貼(邊界間距 0), 間距只屬於「展開的內容」;
     否則會出現「群標題之間貼齊、但刪除線卻浮開一段」這種兩套規則。 */
  padding: 6px 0 10px 16px;
}
.vue-flow__settings-group-panel--closed {
  height: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
  visibility: hidden;
}
</style>
