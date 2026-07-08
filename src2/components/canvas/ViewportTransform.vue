<template>
  <div class="vue-flow__viewport" :style="transformStyle">
    <slot />
  </div>
</template>

<script>
export default {
    name: 'ViewportTransform',
    props: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        zoom: { type: Number, default: 1 },
    },
    computed: {
        transformStyle() {
            return {
                transform: `translate(${this.x}px, ${this.y}px) scale(${this.zoom})`,
                transformOrigin: '0 0',
            }
        },
    },
}
</script>

<style scoped>
.vue-flow__viewport {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}
</style>
