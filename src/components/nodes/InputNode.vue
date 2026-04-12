<template>
  <div class="vue-flow__node-input">
    <div class="vue-flow__node-label">{{ node.name }}</div>
    <Handle
      type="source"
      :position="node.toPosition || dn.toPosition || 'bottom'"
      :connectable="connectable"
      :locked="locked"
      @connect-start="$emit('connect-start', $event)"
    />
  </div>
</template>

<script>
import Handle from './Handle.vue'

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
