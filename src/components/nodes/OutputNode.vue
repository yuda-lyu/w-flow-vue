<template>
  <div class="vue-flow__node-output">
    <Handle
      v-for="h in targetHandles"
      :key="'t-' + h.side"
      type="target"
      :position="h.side"
      :binding="h.binding"
      :connectable="connectable"
      :locked="locked"
      @connect-start="$emit('connect-start', $event)"
    />
    <div class="vue-flow__node-label">{{ node.name }}</div>
  </div>
</template>

<script>
import Handle from './Handle.vue'
import { targetHandleSides } from '../../js/anchorPolicy.mjs'

export default {
    name: 'OutputNode',
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
        //把手集合由 anchorPolicy 單一來源解析: 預設 Auto 把手永遠存在, 各入邊之 Fixed 錨點附加
        targetHandles() {
            return targetHandleSides(this.node, this.getConns() || [], this.dn)
        },
    },
}
</script>

<style scoped>
.vue-flow__node-output {
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
