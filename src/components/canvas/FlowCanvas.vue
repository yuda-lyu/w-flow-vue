<template>
  <div
    class="vue-flow"
    ref="container"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @wheel.prevent="onWheel"
    @dblclick="onDoubleClick"
    @contextmenu="onContextMenu"
  >
    <slot />
  </div>
</template>

<script>
import { crossedThreshold } from '../../js/domGesture.mjs'

export default {
    name: 'FlowCanvas',
    methods: {
        onMouseDown(event) {
            this._downPos = { x: event.clientX, y: event.clientY }
            this._didMove = false
            this.$emit('canvas-mousedown', event)
        },
        onMouseMove(event) {
            //曾跨門檻即鎖住: 只比對mouseup當下與mousedown之距離無法辨識「拖出去又移回原點放開」,
            //該情形實為拖曳(平移/框選)卻會被判為click
            if (this._downPos && !this._didMove && crossedThreshold(this._downPos.x, this._downPos.y, event.clientX, event.clientY)) {
                this._didMove = true
            }
        },
        onMouseUp(event) {
            // Emit click only if mouse didn't move (distinguish from drag/pan/select)
            //且僅主鍵: 原生click事件本就只由主鍵觸發, 此處合成之canvas-click不應由右鍵/中鍵產生
            //(否則右鍵點空白處會經onCanvasClick清空選取)
            if (this._downPos && !this._didMove && event.button === 0) {
                this.$emit('canvas-click', event)
            }
            this._downPos = null
            this._didMove = false
        },
        onWheel(event) {
            this.$emit('canvas-wheel', event)
        },
        onDoubleClick(event) {
            this.$emit('canvas-dblclick', event)
        },
        onContextMenu(event) {
            this.$emit('canvas-contextmenu', event)
        },
        getContainerRect() {
            return this.$refs.container ? this.$refs.container.getBoundingClientRect() : null
        },
    },
}
</script>

<style scoped>
.vue-flow {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
