<template>
  <svg v-if="active" class="vue-flow__connection-line">
    <path class="vue-flow__connection-path" :d="pathD" :style="computedLineStyle" />
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
        state: { type: Object, required: true }, // { active, fromX, fromY, fromPosition, toX, toY }
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
                targetPosition: 'top',
            })
            return result.path
        },
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
</style>
