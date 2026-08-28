<template>
  <div class="vue-flow__node-body" :style="bodyStyle">
    <NodeFace :node="node" :def-node="defNode" :shape="shape" :lastW="lastW" :lastH="lastH" />
    <div class="vue-flow__node-content">
      <div class="vue-flow__node-label" :style="labelStyle">{{ node.name }}</div>
    </div>
    <NodePorts
      :node="node"
      :def-node="defNode"
      :shape="shape"
      :connectable="connectable"
      :locked="locked"
      @connect-start="$emit('connect-start', $event)"
    />
    <!-- Corner resize handles (4 corners only) -->
    <transition name="vue-flow__fade">
      <div v-if="resizable && !locked && (selected || hovered)" class="vue-flow__resize-group">
        <div class="vue-flow__resize vue-flow__resize--top-left" @mousedown.stop="onResizeMouseDown($event, 'top-left')"></div>
        <div class="vue-flow__resize vue-flow__resize--top-right" @mousedown.stop="onResizeMouseDown($event, 'top-right')"></div>
        <div class="vue-flow__resize vue-flow__resize--bottom-left" @mousedown.stop="onResizeMouseDown($event, 'bottom-left')"></div>
        <div class="vue-flow__resize vue-flow__resize--bottom-right" @mousedown.stop="onResizeMouseDown($event, 'bottom-right')"></div>
      </div>
    </transition>
  </div>
</template>

<script>
import NodeFace from './NodeFace.vue'
import NodePorts from './NodePorts.vue'
import { labelOffsetStyle } from '../../js/nodeStyle.mjs'

/**
 * 節點本體: 形狀面(NodeFace)+ 文字 + 四連接點(NodePorts)+ 四角縮放。
 * 節點無型別: 所有節點同一結構, 差異只在資料(形狀/尺寸/色彩)。
 */
export default {
    name: 'NodeBody',
    components: { NodeFace, NodePorts },
    props: {
        node: { type: Object, required: true },
        //由 NodeWrapper 算一次後下傳(shape 單一解析; 子元件不再各自 inject 重算)
        defNode: { type: Object, default: () => ({}) },
        shape: { type: String, default: 'rectangle' },
        connectable: { type: Boolean, default: true },
        selected: { type: Boolean, default: false },
        resizable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
        hovered: { type: Boolean, default: false },
        lastW: { type: Number, default: 0 },
        lastH: { type: Number, default: 0 },
    },
    methods: {
        //僅主鍵啟動縮放(判準與把手/節點拖曳/畫布平移一致, spec/流程_互動契約.md §3): 右鍵/中鍵按在四角不得啟動縮放手勢
        onResizeMouseDown(event, edge) {
            if (event.button !== 0) return
            this.$emit('resize-start', { event, edge })
        },
    },
    computed: {
        labelStyle() {
            return labelOffsetStyle(this.node, this.defNode)
        },
        bodyStyle() {
            const w = this.lastW || this.node.width
            const h = this.lastH || this.node.height
            const s = {}
            if (w) s.width = (typeof w === 'number' ? w + 'px' : w)
            if (h) s.height = (typeof h === 'number' ? h + 'px' : h)
            return s
        },
    },
}
</script>

<style scoped>
.vue-flow__node-body {
  box-sizing: border-box;
}
.vue-flow__node-content {
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
.vue-flow__resize {
  position: absolute;
  pointer-events: all;
}
.vue-flow__resize--top-left,
.vue-flow__resize--top-right,
.vue-flow__resize--bottom-left,
.vue-flow__resize--bottom-right {
  width: 10px;
  height: 10px;
  z-index: 1;
  border-radius: 2px;
  background: #fff;
  border: 1.5px solid #bbb;
  transition: border-color 0.15s ease;
}
.vue-flow__resize--top-left:hover,
.vue-flow__resize--top-right:hover,
.vue-flow__resize--bottom-left:hover,
.vue-flow__resize--bottom-right:hover {
  border-color: #0041d0;
  background: #e8f0fe;
}
.vue-flow__resize--top-left { top: -5px; left: -5px; cursor: nwse-resize; }
.vue-flow__resize--top-right { top: -5px; right: -5px; cursor: nesw-resize; }
.vue-flow__resize--bottom-left { bottom: -5px; left: -5px; cursor: nesw-resize; }
.vue-flow__resize--bottom-right { bottom: -5px; right: -5px; cursor: nwse-resize; }
</style>
