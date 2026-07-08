<template>
  <div class="vue-flow__node-output">
    <Handle
      v-for="p in usedTargetSides"
      :key="'t-' + p"
      type="target"
      :position="p"
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
        // 連接點依「實際連線使用之方位」顯示(conn.toPosition 逐邊錨點優先), 無任何入邊才回退節點/預設方位
        usedTargetSides() {
            const def = this.node.fromPosition || this.dn.fromPosition || 'top'
            const conns = this.getConns() || []
            const sides = []
            for (const c of conns) {
                if (c.to !== this.node.id) continue
                const p = c.toPosition || def
                if (sides.indexOf(p) < 0) sides.push(p)
            }
            return sides.length ? sides : [def]
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
