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
export default {
    name: 'FlowCanvas',
    methods: {
        onMouseDown(event) {
            this._downPos = { x: event.clientX, y: event.clientY }
            this.$emit('canvas-mousedown', event)
        },
        onMouseMove(event) {
            this.$emit('canvas-mousemove', event)
        },
        onMouseUp(event) {
            this.$emit('canvas-mouseup', event)
            // Emit click only if mouse didn't move (distinguish from drag/pan/select)
            if (this._downPos) {
                let dx = event.clientX - this._downPos.x
                let dy = event.clientY - this._downPos.y
                if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
                    this.$emit('canvas-click', event)
                }
                this._downPos = null
            }
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
