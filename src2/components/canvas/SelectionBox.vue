<template>
  <div
    v-if="box"
    class="vue-flow__selection-box"
    :style="boxStyle"
  />
</template>

<script>
export default {
    name: 'SelectionBox',
    props: {
        box: { type: Object, default: null }, // { x, y, width, height }
    },
    computed: {
        boxStyle() {
            if (!this.box) return {}
            return {
                left: `${this.box.x}px`,
                top: `${this.box.y}px`,
                width: `${this.box.width}px`,
                height: `${this.box.height}px`,
            }
        },
    },
}
</script>

<style scoped>
.vue-flow__selection-box {
  position: absolute;
  background: rgba(0, 65, 208, 0.08);
  border: 1px solid rgba(0, 65, 208, 0.4);
  pointer-events: none;
}
</style>
