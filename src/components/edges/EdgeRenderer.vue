<template>
  <svg class="vue-flow__edges">
    <EdgeMarkerDefs :conns="conns" />
    <EdgeWrapper
      v-for="conn in visibleConns"
      :key="conn.id"
      :conn="conn"
      :source-x="getFromPos(conn).x"
      :source-y="getFromPos(conn).y"
      :source-position="getFromHandlePosition(conn)"
      :target-x="getToPos(conn).x"
      :target-y="getToPos(conn).y"
      :target-position="getToHandlePosition(conn)"
      :selected="isSelected(conn.id)"
      :all-nodes="nodes"
      :node-internals="nodeInternals"
      :interactive="interactive"
      :locked="locked"
      :settings-popup-background-color="settingsPopupBackgroundColor"
      :settings-popup-text-color="settingsPopupTextColor"
      :settings-popup-text-font-size="settingsPopupTextFontSize"
      :infor-popup-background-color="inforPopupBackgroundColor"
      :infor-popup-title-text-color="inforPopupTitleTextColor"
      :infor-popup-title-text-font-size="inforPopupTitleTextFontSize"
      :infor-popup-description-text-color="inforPopupDescriptionTextColor"
      :infor-popup-description-text-font-size="inforPopupDescriptionTextFontSize"
      :settings-enabled="settingsEnabled"
      :settings-excludes="settingsExcludes"
      @conn-click="$emit('conn-click', $event)"
      @conn-double-click="$emit('conn-double-click', $event)"
      @conn-context-menu="$emit('conn-context-menu', $event)"
      @conn-mouseenter="$emit('conn-mouseenter', $event)"
      @conn-mouseleave="$emit('conn-mouseleave', $event)"
      @conn-settings-click="$emit('conn-settings-click', $event)"
      @conn-settings-update="$emit('conn-settings-update', $event)"
      @conn-settings-delete="$emit('conn-settings-delete', $event)"
    >
      <template v-if="$scopedSlots['conn-popup']" v-slot:conn-popup="scope">
        <slot name="conn-popup" v-bind="scope" />
      </template>
    </EdgeWrapper>
  </svg>
</template>

<script>
import EdgeWrapper from './EdgeWrapper.vue'
import EdgeMarkerDefs from './EdgeMarkerDefs.vue'
import { getHandlePosition } from '../../js/geometry'

export default {
    name: 'EdgeRenderer', // lock support
    components: { EdgeWrapper, EdgeMarkerDefs },
    props: {
        conns: { type: Array, default: () => [] },
        nodes: { type: Array, default: () => [] },
        nodeInternals: { type: Object, default: () => ({}) },
        selectedConnIds: { type: Array, default: () => [] },
        interactive: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
        settingsPopupBackgroundColor: { type: String, default: '#fff' },
        settingsPopupTextColor: { type: String, default: '#333' },
        settingsPopupTextFontSize: { type: String, default: '12px' },
        inforPopupBackgroundColor: { type: String, default: '#fff' },
        inforPopupTitleTextColor: { type: String, default: '#333' },
        inforPopupTitleTextFontSize: { type: String, default: '12px' },
        inforPopupDescriptionTextColor: { type: String, default: '#888' },
        inforPopupDescriptionTextFontSize: { type: String, default: '10px' },
        settingsEnabled: { type: Boolean, default: true },
        settingsExcludes: { type: Array, default: () => [] },
    },
    computed: {
        visibleConns() {
            const visibleNodeIds = new Set(this.nodes.filter(n => !n.hidden).map(n => n.id))
            return this.conns.filter(
                e => !e.hidden && visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
            )
        },
        nodeMap() {
            const map = {}
            this.nodes.forEach(n => {
                map[n.id] = n
            })
            return map
        },
    },
    methods: {
        getFromPos(conn) {
            const node = this.nodeMap[conn.from]
            if (!node) return { x: 0, y: 0 }
            const pos = node.toPosition || 'bottom'
            return getHandlePosition(node, pos, this.nodeInternals[node.id] || {}, 'source')
        },
        getToPos(conn) {
            const node = this.nodeMap[conn.to]
            if (!node) return { x: 0, y: 0 }
            const pos = node.fromPosition || 'top'
            return getHandlePosition(node, pos, this.nodeInternals[node.id] || {}, 'target')
        },
        getFromHandlePosition(conn) {
            const node = this.nodeMap[conn.from]
            return (node && node.toPosition) || 'bottom'
        },
        getToHandlePosition(conn) {
            const node = this.nodeMap[conn.to]
            return (node && node.fromPosition) || 'top'
        },
        isSelected(id) {
            return this.selectedConnIds.includes(id)
        },
    },
}
</script>

<style scoped>
.vue-flow__edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
</style>
