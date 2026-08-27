<template>
  <div class="vue-flow__node-body" :style="bodyStyle">
    <NodeFace :node="node" :lastW="lastW" :lastH="lastH" />
    <component
      :is="nodeComponent"
      :node="node"
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
import DefaultNode from './DefaultNode.vue'
import InputNode from './InputNode.vue'
import OutputNode from './OutputNode.vue'
import { nodeType } from '../../js/anchorPolicy.mjs'

const builtInNodes = {
    basic: DefaultNode,
    input: InputNode,
    output: OutputNode,
}

export default {
    name: 'NodeBody',
    components: { NodeFace, DefaultNode, InputNode, OutputNode },
    inject: { getDefNode: { default: () => () => ({}) } },
    props: {
        node: { type: Object, required: true },
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
        nodeComponent() {
            //有效型別經 anchorPolicy.nodeType 單一解析(與 class/表單/same-side/建線判定同一基準)
            return builtInNodes[nodeType(this.node, this.getDefNode())] || DefaultNode
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
.vue-flow__fade-enter-active,
.vue-flow__fade-leave-active {
  transition: opacity 0.15s ease;
}
.vue-flow__fade-enter,
.vue-flow__fade-leave-to {
  opacity: 0;
}
</style>
