<template>
  <div class="vue-flow__node-ports">
    <Handle
      v-for="side in sides"
      :key="side"
      :position="side"
      :shape="shape"
      :connectable="connectable"
      :locked="locked"
      :node-edge-width="nodeEdgeWidth"
      @connect-start="$emit('connect-start', $event)"
    />
  </div>
</template>

<script>
import Handle from './Handle.vue'
import { SIDES } from '../../js/anchorPolicy.mjs'
import { nodeBorderWidth, nodeShape } from '../../js/nodeStyle.mjs'

/**
 * 節點之四個連接點(top/right/bottom/left 各一, 完全對稱, 無連出/連入之分)。
 * 職責只有「渲染四把手並轉發 connect-start」; 幾何由 nodeStyle/geometry 提供, 樣式由 defNode 注入。
 */
export default {
    name: 'NodePorts',
    components: { Handle },
    inject: { getDefNode: { default: () => () => ({}) } },
    props: {
        node: { type: Object, required: true },
        connectable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
    },
    computed: {
        sides() {
            return SIDES
        },
        dn() {
            return this.getDefNode()
        },
        //有效形狀(nodeStyle.nodeShape 單一解析, 與節點面/邊端點同一基準)
        shape() {
            return nodeShape(this.node, this.dn)
        },
        //節點外框寬: 把手定位之外推量(與 NodeWrapper 之 border 同一解析)
        nodeEdgeWidth() {
            return nodeBorderWidth(this.node, this.dn)
        },
    },
}
</script>

<style scoped>
/* 把手之定位容器: 與節點 padding box 重合(把手以百分比定位於其上) */
.vue-flow__node-ports {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}
</style>
