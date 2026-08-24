<template>
  <div class="vue-flow__node-input">
    <div class="vue-flow__node-label">{{ node.name }}</div>
    <Handle
      v-for="h in sourceHandles"
      :key="'s-' + h.side"
      type="source"
      :position="h.side"
      :binding="h.binding"
      :connectable="connectable"
      :locked="locked"
      @connect-start="$emit('connect-start', $event)"
    />
  </div>
</template>

<script>
import Handle from './Handle.vue'
import { sourceHandleSides } from '../../js/anchorPolicy.mjs'

export default {
    name: 'InputNode',
    components: { Handle },
    inject: { getDefNode: { default: () => () => ({}) }, getConns: { default: () => () => [] } },
    props: {
        node: { type: Object, required: true },
        connectable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
    },
    computed: {
        dn() {
            return this.getDefNode()
        },
        //把手集合由 anchorPolicy 單一來源解析: 預設 Auto 把手永遠存在, 各出邊之 Fixed 錨點附加
        sourceHandles() {
            return sourceHandleSides(this.node, this.getConns() || [], this.dn)
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
