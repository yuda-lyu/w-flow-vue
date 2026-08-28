<template>
  <svg class="vue-flow__background">
    <!-- 底色(opt.platformBackgroundColor): 未設定時不繪, 露出畫布預設白底 -->
    <rect
      v-if="bgColor"
      x="0" y="0"
      width="100%" height="100%"
      :fill="bgColor"
    />
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
        //pattern id 每實例唯一(同頁多個 flow 之 <pattern> 同名時會互相引用)
        patternId: { type: String, required: true },
        //改收整個viewport物件(而非x/y/zoom三個純量): 令宿主WFlowVue之render僅讀取穩定物件參考,
        //平移時mutate viewport.x/y不再觸發WFlowVue重渲染, 僅本組件之computed重評估更新pattern偏移
        viewport: { type: Object, default: () => ({ x: 0, y: 0, zoom: 1 }) },
    },
    computed: {
        vpX() {
            return (this.viewport && this.viewport.x) || 0
        },
        vpY() {
            return (this.viewport && this.viewport.y) || 0
        },
        vpZoom() {
            let z = this.viewport && this.viewport.zoom
            return (z === undefined || z === null) ? 1 : z
        },
        scaledGap() {
            return this.gap * this.vpZoom
        },
        scaledSize() {
            return this.size * this.vpZoom
        },
        transformedX() {
            return (this.vpX % this.scaledGap)
        },
        transformedY() {
            return (this.vpY % this.scaledGap)
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
