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
        //框選視覺狀態容器(WFlowVue之selectionVisual, 容器identity穩定): 本元件自行依賴state.box,
        //拉框每步只有本元件重渲染, WFlowVue主模板不因每幀更新而重渲染(細粒度模式, 同dragPositions)
        state: { type: Object, required: true }, // { box: { x, y, width, height } | null }
    },
    computed: {
        box() {
            return this.state.box
        },
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
