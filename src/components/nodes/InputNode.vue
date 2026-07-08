<template>
  <div class="vue-flow__node-input">
    <div class="vue-flow__node-label">{{ node.name }}</div>
    <Handle
      v-for="p in usedSourceSides"
      :key="'s-' + p"
      type="source"
      :position="p"
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
        // 連接點依「實際連線使用之方位」顯示(conn.fromPosition 逐邊錨點優先), 無任何出邊才回退節點/預設方位
        usedSourceSides() {
            const def = this.node.toPosition || this.dn.toPosition || 'bottom'
            const conns = this.getConns() || []
            const sides = []
            for (const c of conns) {
                if (c.from !== this.node.id) continue
                const p = c.fromPosition || def
                if (sides.indexOf(p) < 0) sides.push(p)
            }
            return sides.length ? sides : [def]
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
