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
        active: { type: Boolean, default: false },
        sourceX: { type: Number, default: 0 },
        sourceY: { type: Number, default: 0 },
        sourcePosition: { type: String, default: 'bottom' },
        targetX: { type: Number, default: 0 },
        targetY: { type: Number, default: 0 },
        type: { type: String, default: 'bezier' },
        lineStyle: { type: Object, default: null },
    },
    computed: {
        pathD() {
            const fn = pathFunctions[this.type] || pathFunctions.bezier
            const result = fn({
                sourceX: this.sourceX,
                sourceY: this.sourceY,
                sourcePosition: this.sourcePosition,
                targetX: this.targetX,
                targetY: this.targetY,
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
