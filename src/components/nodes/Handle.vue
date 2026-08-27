<template>
  <div
    v-if="!locked"
    :class="classes"
    :style="handleStyle"
    :data-handle-id="id || type"
    :data-handle-type="type"
    :data-handle-position="position"
    @mousedown.stop="onMouseDown"
    @click.stop
  />
</template>

<script>
import { handleStyleVars } from '../../js/nodeStyle.mjs'

/**
 * 把手幾何契約: 圓心落在節點「外框盒」邊上(與 geometry.getHandlePosition 之連線端點同一基準)。
 * 定位以 CSS 變數計算: 邊距 = -(尺寸/2 + 節點外框寬)——舊寫法固定 -4px 是以 padding box 為基準,
 * 圓心會落在外框內側(偏入 1px + 邊框寬, 實測 border 2px 時偏入 3px)。
 * 樣式(面色/框線色/框線寬/尺寸)由 opt.defHandleSource* 與 defHandleTarget* 經 defNode 解析注入。
 * 互動契約(spec/流程_互動契約.md §3-§4): source 與 target 把手皆可作為建線出發點(雙向出發、嚴格配對),
 * 故兩者 hover 放大與 crosshair 皆為真實承諾; 建線期間之三態視覺由根/節點/把手之 data-connect-* 標記驅動。
 * @click.stop: 把手為建線手勢之出發/落點, 點擊(按下放開不拖)不得冒泡至 NodeWrapper 之 WPopup trigger
 * 誤開節點資訊 popup(實測已重現); mousedown 早已 .stop 故節點亦不發 node-click, 與之對稱
 */
export default {
    name: 'FlowHandle',
    inject: {
        //複選模式(縱深最早邊界): 模式中把手已隱藏(CSS pointer-events:none, 真實點擊到不了這裡),
        //此守衛擋synthetic/程式化mousedown不啟動建線(模板@mousedown.stop仍生效, 僅阻手勢不改傳播語義)
        getMultiSelectActive: { default: () => () => false },
        //進行中手勢(一次一手勢): 已有手勢時不啟動建線
        getActiveGesture: { default: () => () => null },
        getDefNode: { default: () => () => ({}) },
    },
    props: {
        type: { type: String, default: 'source' }, // 'source' | 'target'
        position: { type: String, default: 'bottom' }, // 'top' | 'right' | 'bottom' | 'left'
        id: { type: String, default: null },
        connectable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
        offset: { type: String, default: null },
        customStyle: { type: Object, default: null },
        //所屬節點之外框寬(px): 定位扣除量, 由節點元件以 nodeBorderWidth 解析後傳入
        nodeEdgeWidth: { type: Number, default: 1 },
    },
    computed: {
        offsetStyle() {
            if (this.customStyle) return this.customStyle
            if (!this.offset) return null
            const isHorizontal = this.position === 'top' || this.position === 'bottom'
            if (isHorizontal) return { left: this.offset, transform: 'translateX(-50%)' }
            return { top: this.offset, transform: 'translateY(-50%)' }
        },
        handleStyle() {
            return { ...handleStyleVars(this.type, this.getDefNode(), this.nodeEdgeWidth), ...(this.offsetStyle || {}) }
        },
        classes() {
            return [
                'vue-flow__handle',
                `vue-flow__handle--${this.position}`,
                `vue-flow__handle--${this.type}`,
                { 'vue-flow__handle--not-connectable': !this.connectable },
            ]
        },
    },
    methods: {
        onMouseDown(event) {
            if (!this.connectable) return
            //複選模式中不啟動建線(守衛先於preventDefault, 不吞事件語義)
            if (this.getMultiSelectActive()) return
            //一次一手勢: 進行中(拖曳/縮放/轉折點/框選/平移/建線)不再啟動
            if (this.getActiveGesture()) return
            //僅主鍵可啟動建線: 右鍵/中鍵不 emit(WFlowVue 之重入守衛為第二層縱深)
            if (event.button !== 0) return
            //阻止文字選取隨拖線啟動(把手上按下拖曳屬建線手勢, 非選字)
            event.preventDefault()
            this.$emit('connect-start', {
                event,
                handleId: this.id || this.type,
                handleType: this.type,
                handlePosition: this.position,
            })
        },
    },
}
</script>

<style scoped>
/* 幾何/配色全由 CSS 變數驅動(Handle 之 inline style 注入; 無變數時之 fallback 即預設):
   --vf-hs 外徑(border-box, 含框線), --vf-hface 面色, --vf-hedge 框線色, --vf-hew 框線寬, --vf-hb 節點外框寬 */
.vue-flow__handle {
  position: absolute;
  width: var(--vf-hs, 10px);
  height: var(--vf-hs, 10px);
  border-radius: 50%;
  background: var(--vf-hface, #555);
  border: var(--vf-hew, 1px) solid var(--vf-hedge, #fff);
  box-sizing: border-box;
  pointer-events: all;
  cursor: crosshair;
  z-index: 3;
}
/* 圓心 = 節點外框盒邊: 位移 -(尺寸/2 + 外框寬) */
.vue-flow__handle--top {
  top: calc(var(--vf-hs, 10px) / -2 - var(--vf-hb, 1px));
  left: 50%;
  transform: translateX(-50%);
}
.vue-flow__handle--bottom {
  bottom: calc(var(--vf-hs, 10px) / -2 - var(--vf-hb, 1px));
  left: 50%;
  transform: translateX(-50%);
}
.vue-flow__handle--left {
  top: 50%;
  left: calc(var(--vf-hs, 10px) / -2 - var(--vf-hb, 1px));
  transform: translateY(-50%);
}
.vue-flow__handle--right {
  top: 50%;
  right: calc(var(--vf-hs, 10px) / -2 - var(--vf-hb, 1px));
  transform: translateY(-50%);
}
/* 不可連把手: 無 affordance 亦不可 hit(設計限制, spec §8) */
.vue-flow__handle--not-connectable {
  cursor: default;
  pointer-events: none;
}
/* hover 放大 2px, 圓心不動(source/target 皆可出發建線, 承諾真實) */
.vue-flow__handle:hover {
  background: #0041d0;
  width: calc(var(--vf-hs, 10px) + 2px);
  height: calc(var(--vf-hs, 10px) + 2px);
}
.vue-flow__handle--top:hover { top: calc((var(--vf-hs, 10px) + 2px) / -2 - var(--vf-hb, 1px)); }
.vue-flow__handle--bottom:hover { bottom: calc((var(--vf-hs, 10px) + 2px) / -2 - var(--vf-hb, 1px)); }
.vue-flow__handle--left:hover { left: calc((var(--vf-hs, 10px) + 2px) / -2 - var(--vf-hb, 1px)); }
.vue-flow__handle--right:hover { right: calc((var(--vf-hs, 10px) + 2px) / -2 - var(--vf-hb, 1px)); }

/* ─── 手勢進行中(祖先 .vue-flow--connecting 或 .vue-flow--gesturing)通用 hover 抑制 ───
   建線: 可連性只由精確判定之 data-connect-* 標記指示; 其他手勢(拖曳/縮放/轉折點/框選/平移): 途經之把手不反應 */
.vue-flow--connecting .vue-flow__handle:hover,
.vue-flow--gesturing .vue-flow__handle:hover {
  background: var(--vf-hface, #555);
  width: var(--vf-hs, 10px);
  height: var(--vf-hs, 10px);
}
.vue-flow--connecting .vue-flow__handle--top:hover, .vue-flow--gesturing .vue-flow__handle--top:hover { top: calc(var(--vf-hs, 10px) / -2 - var(--vf-hb, 1px)); }
.vue-flow--connecting .vue-flow__handle--bottom:hover, .vue-flow--gesturing .vue-flow__handle--bottom:hover { bottom: calc(var(--vf-hs, 10px) / -2 - var(--vf-hb, 1px)); }
.vue-flow--connecting .vue-flow__handle--left:hover, .vue-flow--gesturing .vue-flow__handle--left:hover { left: calc(var(--vf-hs, 10px) / -2 - var(--vf-hb, 1px)); }
.vue-flow--connecting .vue-flow__handle--right:hover, .vue-flow--gesturing .vue-flow__handle--right:hover { right: calc(var(--vf-hs, 10px) / -2 - var(--vf-hb, 1px)); }
/* 建線期間永不可為落點者一律淡化(不需 hover 判定即刻正確, spec §4):
   出發節點之其他把手(自我連線)、他節點之同類把手(根元素 data-connect-from 標示出發類型) */
.vue-flow--connecting .vue-flow__node[data-connect-origin-node] .vue-flow__handle:not([data-connect-role="origin"]),
.vue-flow--connecting[data-connect-from="source"] .vue-flow__handle--source:not([data-connect-role="origin"]),
.vue-flow--connecting[data-connect-from="target"] .vue-flow__handle--target:not([data-connect-role="origin"]) {
  opacity: 0.4;
}
/* 出發把手(origin): 保持強調, 標示線之來源 */
.vue-flow__handle[data-connect-role="origin"] {
  box-shadow: 0 0 0 3px rgba(0, 65, 208, 0.35);
}
/* 游標下之精確判定(僅建線期間由 adapter 標記): 合法=主題藍 ring, 不合法=danger ring
   採 ring(box-shadow)不改 width/height, 避免尺寸變更造成 hit box 幾何抖動
   (帶祖先選擇器使權重與淡化/hover 抑制規則平手, 依源碼順序後者勝出) */
.vue-flow--connecting .vue-flow__handle[data-connect-status="valid"] {
  background: #0041d0;
  box-shadow: 0 0 0 4px rgba(0, 65, 208, 0.45);
}
.vue-flow--connecting .vue-flow__handle[data-connect-status="invalid"] {
  background: #d14343;
  box-shadow: 0 0 0 4px rgba(209, 67, 67, 0.45);
  opacity: 1;
}
</style>
