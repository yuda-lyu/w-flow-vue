<template>
  <div class="vue-flow__node-input">
    <div class="vue-flow__node-label">{{ node.name }}</div>
    <Handle
      type="source"
      :position="sourceSide"
      :connectable="connectable"
      :locked="locked"
      :node-edge-width="nodeEdgeWidth"
      @connect-start="$emit('connect-start', $event)"
    />
  </div>
</template>

<script>
import Handle from './Handle.vue'
import { nodeSourceSide } from '../../js/anchorPolicy.mjs'
import { nodeBorderWidth } from '../../js/nodeStyle.mjs'

export default {
    name: 'InputNode',
    components: { Handle },
    inject: { getDefNode: { default: () => () => ({}) } },
    props: {
        node: { type: Object, required: true },
        connectable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
    },
    computed: {
        dn() {
            return this.getDefNode()
        },
        nodeEdgeWidth() {
            return nodeBorderWidth(this.node, this.dn)
        },
        //連出側由節點決定(anchorPolicy 單一來源): 節點 → defNode → 內建
        sourceSide() {
            return nodeSourceSide(this.node, this.dn)
        },
    },
}
</script>

<style scoped>
.vue-flow__node-input {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 10px 20px;
}
</style>
