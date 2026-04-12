<template>
  <div class="vue-flow__node-output">
    <Handle
      type="target"
      :position="node.fromPosition || dn.fromPosition || 'top'"
      :connectable="connectable"
      :locked="locked"
      @connect-start="$emit('connect-start', $event)"
    />
    <div class="vue-flow__node-label">{{ node.name }}</div>
  </div>
</template>

<script>
import Handle from './Handle.vue'

export default {
    name: 'OutputNode',
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
