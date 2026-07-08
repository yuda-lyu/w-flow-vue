<template>
  <svg class="vue-flow__edges">
    <EdgeMarkerDefs :conns="conns" />
    <EdgeWrapper
      v-for="conn in visibleConns"
      ref="wrappers"
      :key="conn.id"
      :conn="conn"
      :source-node="nodeMap[conn.from]"
      :target-node="nodeMap[conn.to]"
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
            const list = this.conns.filter(
                e => !e.hidden && visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
            )
            //選取之連線移至最後渲染(SVG疊序=文件順序即置頂): 該線與其轉折點不被其他線遮擋, 便於檢視與編修
            const sel = this.selectedConnIds || []
            if (!sel.length) return list
            return [...list.filter(c => sel.indexOf(c.id) < 0), ...list.filter(c => sel.indexOf(c.id) >= 0)]
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
        //(效能重構)錨點座標/方位解析下沉至EdgeWrapper自算(含拖曳ghost):
        //  本層render不再讀取各節點position, 拖曳節點時EdgeRenderer不重渲染, 僅相連邊之EdgeWrapper更新
        isSelected(id) {
            return this.selectedConnIds.includes(id)
        },
        openConnInfoPopup(connId) {
            let wrappers = this.$refs.wrappers || []
            let w = wrappers.find(c => c.conn && c.conn.id === connId)
            if (!w) return false
            w.openInfoPopup()
            return true
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
