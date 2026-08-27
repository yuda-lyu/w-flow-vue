<template>
  <div
    v-if="!locked"
    :class="classes"
    :style="handleStyle"
    :data-handle-position="position"
    @mousedown.stop="onMouseDown"
    @click.stop
  />
</template>

<script>
import { handleStyleVars, handlePlacementStyle } from '../../js/nodeStyle.mjs'

/**
 * 連接點(把手): 節點四邊各一, 無連出/連入之分——任一把手皆可作為建線出發點與落點(spec/流程_互動契約.md §3-§4)。
 * 幾何契約: 圓心落在節點外框盒上該邊之連接點(nodeStyle.handlePlacementStyle 與 geometry.getHandlePosition 同一 fraction);
 * 定位含節點外框寬之外推, translate(-50%,-50%) 置中, hover 放大時圓心不動。
 * 樣式(面色/框線色/框線寬/尺寸)由 opt.defHandle* 經 defNode 解析注入(單一組, 四把手相同)。
 * 建線期間之三態視覺由節點/把手之 data-connect-* 標記驅動。
 * @click.stop: 把手為建線手勢之出發/落點, 點擊(按下放開不拖)不得冒泡至 NodeWrapper 之 WPopup trigger
 * 誤開節點資訊 popup; mousedown 早已 .stop 故節點亦不發 node-click, 與之對稱
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
        position: { type: String, required: true }, // 'top' | 'right' | 'bottom' | 'left'
        shape: { type: String, default: 'rectangle' },
        connectable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
        //所屬節點之外框寬(px): 定位外推量, 由節點元件以 nodeBorderWidth 解析後傳入
        nodeEdgeWidth: { type: Number, default: 1 },
    },
    computed: {
        handleStyle() {
            return { ...handleStyleVars(this.getDefNode()), ...handlePlacementStyle(this.shape, this.position, this.nodeEdgeWidth) }
        },
        classes() {
            return [
                'vue-flow__handle',
                `vue-flow__handle--${this.position}`,
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
            this.$emit('connect-start', { event, handlePosition: this.position })
        },
    },
}
</script>

<style scoped>
/* 配色/尺寸全由 CSS 變數驅動(Handle 之 inline style 注入; 無變數時之 fallback 即預設):
   --vf-hs 外徑(border-box, 含框線), --vf-hface 面色, --vf-hedge 框線色, --vf-hew 框線寬
   定位(left/top/transform)由 inline style 給定(nodeStyle.handlePlacementStyle) */
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
/* 不可連把手: 無 affordance 亦不可 hit(設計限制, spec §8) */
.vue-flow__handle--not-connectable {
  cursor: default;
  pointer-events: none;
}
/* hover 放大 2px, 圓心不動(translate 置中) */
.vue-flow__handle:hover {
  background: #0041d0;
  width: calc(var(--vf-hs, 10px) + 2px);
  height: calc(var(--vf-hs, 10px) + 2px);
}

/* ─── 手勢進行中(祖先 .vue-flow--connecting 或 .vue-flow--gesturing)通用 hover 抑制 ───
   建線: 可連性只由精確判定之 data-connect-* 標記指示; 其他手勢(拖曳/縮放/轉折點/框選/平移): 途經之把手不反應 */
.vue-flow--connecting .vue-flow__handle:hover,
.vue-flow--gesturing .vue-flow__handle:hover {
  background: var(--vf-hface, #555);
  width: var(--vf-hs, 10px);
  height: var(--vf-hs, 10px);
}
/* 建線期間永不可為落點者一律淡化(不需 hover 判定即刻正確, spec §4): 出發節點之其他把手(自我連線) */
.vue-flow--connecting .vue-flow__node[data-connect-origin-node] .vue-flow__handle:not([data-connect-role="origin"]) {
  opacity: 0.4;
}
/* 出發把手(origin): 保持強調, 標示線之來源 */
.vue-flow__handle[data-connect-role="origin"] {
  box-shadow: 0 0 0 3px rgba(0, 65, 208, 0.35);
}
/* 游標下之精確判定(僅建線期間由 adapter 標記): 合法=主題藍 ring, 不合法=danger ring
   採 ring(box-shadow)不改 width/height, 避免尺寸變更造成 hit box 幾何抖動 */
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
