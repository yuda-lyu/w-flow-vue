<template>
  <div class="vue-flow__nodes">
    <NodeWrapper
      v-for="node in visibleNodes"
      :key="node.id"
      :node="node"
      :selected="isSelected(node.id)"
      :draggable="isDraggable(node)"
      :connectable="isConnectable(node)"
      :resizable="isResizable(node)"
      :locked="locked"
      :settings-popup-background-color="settingsPopupBackgroundColor"
      :settings-popup-text-color="settingsPopupTextColor"
      :settings-popup-text-font-size="settingsPopupTextFontSize"
      :infor-popup-background-color="inforPopupBackgroundColor"
      :infor-popup-title-text-color="inforPopupTitleTextColor"
      :infor-popup-title-text-font-size="inforPopupTitleTextFontSize"
      :infor-popup-description-text-color="inforPopupDescriptionTextColor"
      :infor-popup-description-text-font-size="inforPopupDescriptionTextFontSize"
      :snap-grid-size="snapGridSize"
      :settings-enabled="settingsEnabled"
      :settings-excludes="settingsExcludes"
      @drag-start="$emit('drag-start', $event)"
      @node-click="$emit('node-click', $event)"
      @node-double-click="$emit('node-double-click', $event)"
      @node-context-menu="$emit('node-context-menu', $event)"
      @node-settings-click="$emit('node-settings-click', $event)"
      @node-settings-update="$emit('node-settings-update', $event)"
      @node-settings-delete="$emit('node-settings-delete', $event)"
      @node-mouseenter="$emit('node-mouseenter', $event)"
      @node-mouseleave="$emit('node-mouseleave', $event)"
      @connect-start="$emit('connect-start', $event)"
      @dimensions="$emit('dimensions', $event)"
      @node-resize="$emit('node-resize', $event)"
      @node-resize-end="$emit('node-resize-end', $event)"
    >
      <template v-if="$scopedSlots['node-popup']" v-slot:node-popup="scope">
        <slot name="node-popup" v-bind="scope" />
      </template>
    </NodeWrapper>
  </div>
</template>

<script>
import NodeWrapper from './NodeWrapper.vue'

export default {
    name: 'NodeRenderer',
    components: { NodeWrapper },
    props: {
        nodes: { type: Array, default: () => [] },
        selectedNodeIds: { type: Array, default: () => [] },
        nodesDraggable: { type: Boolean, default: true },
        nodesConnectable: { type: Boolean, default: true },
        nodesResizable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
        settingsPopupBackgroundColor: { type: String, default: '#fff' },
        settingsPopupTextColor: { type: String, default: '#333' },
        settingsPopupTextFontSize: { type: String, default: '12px' },
        inforPopupBackgroundColor: { type: String, default: '#fff' },
        inforPopupTitleTextColor: { type: String, default: '#333' },
        inforPopupTitleTextFontSize: { type: String, default: '12px' },
        inforPopupDescriptionTextColor: { type: String, default: '#888' },
        inforPopupDescriptionTextFontSize: { type: String, default: '10px' },
        snapGridSize: { type: Number, default: null },
        settingsEnabled: { type: Boolean, default: true },
        settingsExcludes: { type: Array, default: () => [] },
    },
    computed: {
        visibleNodes() {
            return this.nodes.filter(n => !n.hidden)
        },
    },
    methods: {
        isSelected(id) {
            return this.selectedNodeIds.includes(id)
        },
        isDraggable(node) {
            return node.draggable !== undefined ? node.draggable : this.nodesDraggable
        },
        isConnectable(node) {
            return node.connectable !== undefined ? node.connectable : this.nodesConnectable
        },
        isResizable(node) {
            return node.resizable !== undefined ? node.resizable : this.nodesResizable
        },
    },
}
</script>

<style scoped>
.vue-flow__nodes {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
}
</style>
