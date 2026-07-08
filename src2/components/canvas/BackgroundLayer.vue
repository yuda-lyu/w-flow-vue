<template>
  <svg class="vue-flow__background">
    <pattern
      :id="patternId"
      :x="transformedX"
      :y="transformedY"
      :width="scaledGap"
      :height="scaledGap"
      patternUnits="userSpaceOnUse"
    >
      <template v-if="variant === 'dots'">
        <circle
          :cx="scaledSize"
          :cy="scaledSize"
          :r="scaledSize"
          :fill="patternColor"
        />
      </template>
      <template v-else>
        <path
          :d="`M ${scaledGap} 0 L 0 0 0 ${scaledGap}`"
          fill="none"
          :stroke="patternColor"
          :stroke-width="scaledSize"
        />
      </template>
    </pattern>
    <rect
      x="0" y="0"
      width="100%" height="100%"
      :fill="`url(#${patternId})`"
    />
  </svg>
</template>

<script>
export default {
    name: 'BackgroundLayer',
    props: {
        variant: { type: String, default: 'dots' },
        gap: { type: Number, default: 20 },
        size: { type: Number, default: 1 },
        patternColor: { type: String, default: '#81818a' },
        bgColor: { type: String, default: null },
        viewportX: { type: Number, default: 0 },
        viewportY: { type: Number, default: 0 },
        viewportZoom: { type: Number, default: 1 },
    },
    computed: {
        patternId() {
            return 'vue-flow-bg-pattern'
        },
        scaledGap() {
            return this.gap * this.viewportZoom
        },
        scaledSize() {
            return this.size * this.viewportZoom
        },
        transformedX() {
            return (this.viewportX % this.scaledGap)
        },
        transformedY() {
            return (this.viewportY % this.scaledGap)
        },
    },
}
</script>

<style scoped>
.vue-flow__background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
