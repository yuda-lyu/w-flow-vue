<template>
  <svg v-if="active" class="vue-flow__connection-line">
    <path :class="pathClasses" :d="pathD" :style="computedLineStyle" />
  </svg>
</template>

<script>
import { getBezierPath, getStraightPath, getStepPath, getSmoothStepPath } from '../../js/edgePath'

const pathFunctions = {
    bezier: getBezierPath,
    straight: getStraightPath,
    step: getStepPath,
    smoothstep: getSmoothStepPath,
}

export default {
    name: 'ConnectionLine',
    props: {
        //建線視覺狀態容器(WFlowVue之connectionVisual, 容器identity穩定): 本元件自行依賴其欄位,
        //拉線每步只有本元件重渲染, WFlowVue主模板不因每幀更新而重渲染(細粒度模式, 同SelectionBox)
        state: { type: Object, required: true }, // { active, fromX, fromY, fromPosition, toX, toY, toPosition, dropStatus }
        type: { type: String, default: 'bezier' },
        lineStyle: { type: Object, default: null },
    },
    computed: {
        active() {
            return this.state.active
        },
        pathD() {
            const fn = pathFunctions[this.type] || pathFunctions.bezier
            const result = fn({
                sourceX: this.state.fromX,
                sourceY: this.state.fromY,
                sourcePosition: this.state.fromPosition,
                targetX: this.state.toX,
                targetY: this.state.toY,
                //游標懸於把手時以該把手方位決定曲線進入方向(原寫死'top': right/left/bottom之把手預覽線明顯錯向)
                targetPosition: this.state.toPosition || 'top',
            })
            return result.path
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
        //宿主自訂 lineStyle 為 inline style, 天然優先於 status class(相容契約: 自訂 stroke 永遠最高優先)
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
  stroke: #b1b1b7;
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
