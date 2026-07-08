<template>
  <div class="vue-flow__viewport" :style="transformStyle">
    <slot />
  </div>
</template>

<script>
export default {
    name: 'ViewportTransform',
    props: {
        //改收整個viewport物件(而非x/y/zoom三個純量): 令宿主WFlowVue之render僅讀取穩定物件參考,
        //平移時mutate viewport.x/y不再觸發WFlowVue重渲染(進而不再連帶重渲染全部節點/連線), 僅本組件之computed重評估更新transform
        viewport: { type: Object, default: () => ({ x: 0, y: 0, zoom: 1 }) },
    },
    computed: {
        transformStyle() {
            let v = this.viewport || {}
            let x = v.x || 0
            let y = v.y || 0
            let zoom = (v.zoom === undefined || v.zoom === null) ? 1 : v.zoom
            return {
                transform: `translate(${x}px, ${y}px) scale(${zoom})`,
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
