<template>
  <svg v-if="active" class="vue-flow__connection-line">
    <path :class="pathClasses" :d="pathD" :style="computedLineStyle" />
  </svg>
</template>

<script>
import { getPathFunction } from '../../js/edgePath'

export default {
    name: 'ConnectionLine',
    props: {
        //建線視覺狀態容器(WFlowVue之connectionVisual, 容器identity穩定): 本元件自行依賴其欄位,
        //拉線每步只有本元件重渲染, WFlowVue主模板不因每幀更新而重渲染(細粒度模式, 同SelectionBox)
        //出發把手即邊之 from 端(方向 = 出發 → 落點), 故 from*/to* 直接對應 source/target 參數
        state: { type: Object, required: true }, // { active, fromX, fromY, fromPosition, toX, toY, toPosition, dropStatus }
        type: { type: String, default: 'bezier' },
        lineStyle: { type: Object, default: null },
        //step/smoothstep 之法線 stub 長(與正式邊同一 defConn.defOffset, 否則放開後路徑跳動)
        offset: { type: Number, default: undefined },
    },
    computed: {
        active() {
            return this.state.active
        },
        pathD() {
            const fn = getPathFunction(this.type)
            const s = this.state
            return fn({
                sourceX: s.fromX,
                sourceY: s.fromY,
                sourcePosition: s.fromPosition,
                targetX: s.toX,
                targetY: s.toY,
                targetPosition: s.toPosition,
                offset: this.offset,
            }).path
        },
        //落點判定狀態(dropStatus: 'none'|'valid'|'invalid')→ BEM status class;
        //顏色循色票(valid=把手主題藍, invalid=danger), 並輔以線型差異(valid轉實線)兼顧色弱辨識
        pathClasses() {
            const s = this.state.dropStatus
            return [
                'vue-flow__connection-path',
                {
                    'vue-flow__connection-path--valid': s === 'valid',
                    'vue-flow__connection-path--invalid': s === 'invalid',
                },
            ]
        },
        //宿主自訂 lineStyle 為 inline style, 天然優先於 status class(自訂 stroke 永遠最高優先)
        computedLineStyle() {
            return this.lineStyle || {}
        },
    },
}
</script>

<style scoped>
.vue-flow__connection-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.vue-flow__connection-path {
  stroke: #b1b1b1;
  stroke-width: 1;
  stroke-dasharray: 5 5;
  fill: none;
}
.vue-flow__connection-path--valid {
  stroke: var(--wfv-connect-valid-color, #0041d0);
  stroke-width: 2;
  stroke-dasharray: none;
}
.vue-flow__connection-path--invalid {
  stroke: var(--wfv-connect-invalid-color, #d14343);
  stroke-width: 1.5;
}
</style>
