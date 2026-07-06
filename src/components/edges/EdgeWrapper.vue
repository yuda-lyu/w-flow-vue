<template>
  <g
    :class="classes"
    :data-id="conn.id"
    @mouseenter="onGroupMouseEnter"
    @mouseleave="onGroupMouseLeave"
  >
    <!-- Hover zone around label + settings icon area (below interaction path in z-order) -->
    <rect
      :x="pathData.labelX - 60"
      :y="pathData.labelY - 18"
      width="120"
      height="36"
      fill="transparent"
      pointer-events="all"
      @click.stop="onClick"
    />
    <!-- Interaction path (wider, invisible) -->
    <path
      :d="pathData.path"
      class="vue-flow__edge-interaction"
      @click.stop="onClick"
      @dblclick.stop="onDoubleClick"
      @contextmenu.stop="onContextMenu"
    />
    <!-- Visible path -->
    <path
      :d="pathData.path"
      :style="connStyle"
      :marker-start="markerStartUrl"
      :marker-end="markerEndUrl"
    />
    <!-- Label + Settings icon (merged into one foreignObject for correct relative positioning) -->
    <foreignObject
      :x="pathData.labelX - 100"
      :y="pathData.labelY - 18"
      width="200"
      height="36"
      style="overflow: visible; pointer-events: none;"
    >
      <div class="vue-flow__edge-label-area" xmlns="http://www.w3.org/1999/xhtml">
        <span class="vue-flow__edge-label-group">
          <WPopup
            v-if="conn.name"
            v-model="infoPopupShow"
            placement="bottom"
            modeHide="mousedown"
            :editable="infoPopupEditable"
            :minWidth="null"
            :maxWidth="null"
            :autoFitMinWidth="false"
            :autoFitMaxWidth="false"
            :backgroundColor="inforPopupBackgroundColor"
            :textFontSize="inforPopupTitleTextFontSize"
            :paddingStyle="{v:8,h:12}"
          >
            <template v-slot:trigger>
              <span class="vue-flow__edge-label" :style="labelStyle" @mousedown="onLabelMouseDown">{{ conn.name }}</span>
            </template>
            <template v-slot:content>
              <slot name="conn-popup" :conn="conn">
                <div v-if="conn.name || conn.description" style="min-width:120px">
                  <div v-if="conn.name" :style="{ fontSize: inforPopupTitleTextFontSize, color: inforPopupTitleTextColor, fontWeight: 500 }">{{ conn.name }}</div>
                  <div v-if="conn.description" :style="{ fontSize: inforPopupDescriptionTextFontSize, color: inforPopupDescriptionTextColor, marginTop: '4px' }">{{ conn.description }}</div>
                </div>
              </slot>
            </template>
          </WPopup>
          <transition name="vue-flow__fade">
          <span v-if="(hovered || settingsPopupShow) && interactive && !locked && settingsEnabled" class="vue-flow__edge-settings-anchor">
              <WPopup
                v-model="settingsPopupShow"
                placement="right-start"
                modeHide="mousedown"
                :minWidth="null"
                :maxWidth="null"
                :autoFitMinWidth="false"
                :autoFitMaxWidth="false"
                :backgroundColor="settingsPopupBackgroundColor"
                :textColor="settingsPopupTextColor"
                :paddingStyle="{v:8,h:8}"
                @show="$emit('conn-settings-click', { conn: conn })"
              >
                <template v-slot:trigger>
                  <span class="vue-flow__edge-settings" @mousedown.stop>
                    <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
                      <path d="M11.078 0l.294 1.833a7.587 7.587 0 0 1 2.174 1.25l1.725-.618 1.078 1.87-1.43 1.217a7.508 7.508 0 0 1 0 2.498l1.43 1.217-1.078 1.87-1.725-.618a7.587 7.587 0 0 1-2.174 1.25L11.078 14H8.922l-.294-1.833a7.587 7.587 0 0 1-2.174-1.25l-1.725.618-1.078-1.87 1.43-1.217a7.508 7.508 0 0 1 0-2.498L3.65 4.733l1.078-1.87 1.725.618a7.587 7.587 0 0 1 2.174-1.25L8.922 0h2.156zM10 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" transform="translate(0 3)"/>
                    </svg>
                  </span>
                </template>
                <template v-slot:content>
                  <ConnSettingsForm
                    :conn="conn"
                    :def-conn="dc"
                    :text-font-size="settingsPopupTextFontSize"
                    :excludes="settingsExcludes"
                    @update="onSettingsUpdate"
                    @delete="onSettingsDelete"
                  />
                </template>
              </WPopup>
          </span>
          </transition>
        </span>
      </div>
    </foreignObject>
  </g>
</template>

<script>
import { getBezierPath, getStraightPath, getStepPath, getSmoothStepPath } from '../../js/edge-path'
import ConnSettingsForm from '../ui/ConnSettingsForm.vue'
import WPopup from 'w-component-vue/src/components/WPopup.vue'

const pathFunctions = {
    bezier: getBezierPath,
    straight: getStraightPath,
    step: getStepPath,
    smoothstep: getSmoothStepPath,
}

export default {
    name: 'EdgeWrapper',
    components: { ConnSettingsForm, WPopup },
    inject: { getDefConn: { default: () => () => ({}) } },
    props: {
        conn: { type: Object, required: true },
        sourceX: { type: Number, required: true },
        sourceY: { type: Number, required: true },
        sourcePosition: { type: String, default: 'bottom' },
        targetX: { type: Number, required: true },
        targetY: { type: Number, required: true },
        targetPosition: { type: String, default: 'top' },
        selected: { type: Boolean, default: false },
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
        allNodes: { type: Array, default: () => [] },
        nodeInternals: { type: Object, default: () => ({}) },
        settingsEnabled: { type: Boolean, default: true },
        settingsExcludes: { type: Array, default: () => [] },
    },
    data() {
        return {
            hovered: false,
            infoPopupShow: false,
            infoPopupEditable: true,
            settingsPopupShow: false,
        }
    },
    watch: {
        settingsPopupShow(val) {
            if (val) this.infoPopupShow = false
        },
        infoPopupShow(val) {
            if (val) this.settingsPopupShow = false
        },
    },
    computed: {
        dc() {
            return this.getDefConn()
        },
        classes() {
            const connClasses = this.conn.class
                ? (Array.isArray(this.conn.class) ? this.conn.class : [this.conn.class])
                : []
            return [
                'vue-flow__edge',
                `vue-flow__edge-${this.conn.type || this.dc.type || 'bezier'}`,
                ...connClasses,
                {
                    'vue-flow__edge--selected': this.selected,
                    'vue-flow__edge--animated': this.conn.animated,
                },
            ]
        },
        pathData() {
            const type = this.conn.type || this.dc.type || 'bezier'
            const fn = pathFunctions[type] || pathFunctions.bezier
            return fn({
                sourceX: this.sourceX,
                sourceY: this.sourceY,
                sourcePosition: this.sourcePosition,
                targetX: this.targetX,
                targetY: this.targetY,
                targetPosition: this.targetPosition,
                curvature: this.conn.curvature,
                allNodes: this.allNodes,
                nodeInternals: this.nodeInternals,
                connFromId: this.conn.from,
                connToId: this.conn.to,
                offset: this.dc.defOffset,
            })
        },
        connStyle() {
            const d = this.dc
            const base = this.conn.style ? { ...this.conn.style } : {}
            base.stroke = this.conn.edgeColor || d.edgeColor || '#b1b1b7'
            if (this.conn.edgeWidth !== undefined) base.strokeWidth = this.conn.edgeWidth
            else if (d.edgeWidth !== undefined) base.strokeWidth = d.edgeWidth
            let dash = this.conn.edgeDasharray !== undefined ? this.conn.edgeDasharray : d.edgeDasharray
            if (dash) base.strokeDasharray = dash
            return base
        },
        markerStartUrl() {
            return this.getMarkerUrl(this.conn.markerStart)
        },
        markerEndUrl() {
            return this.getMarkerUrl(this.conn.markerEnd || this.dc.markerEnd)
        },
        labelStyle() {
            const d = this.dc
            const s = {}
            const fontSize = this.conn.fontSize || d.fontSize
            const fontColor = this.conn.fontColor || d.fontColor
            if (fontSize) s.fontSize = fontSize + 'px'
            if (fontColor) s.color = fontColor
            return s
        },
    },
    methods: {
        getMarkerUrl(marker) {
            if (!marker) return null
            const config = typeof marker === 'string' ? { type: marker } : marker
            // Fallback chain must match EdgeMarkerDefs so the generated ids agree.
            const color = config.color || this.conn.edgeColor || this.dc.edgeColor || '#b1b1b7'
            return `url(#vue-flow__${config.type}_${color.replace('#', '')})`
        },
        onGroupMouseEnter(event) {
            this.hovered = true
            this.$emit('conn-mouseenter', { conn: this.conn, event })
        },
        onGroupMouseLeave(event) {
            this.hovered = false
            this.$emit('conn-mouseleave', { conn: this.conn, event })
        },
        onClick(event) {
            this.$emit('conn-click', { conn: this.conn, event })
        },
        onDoubleClick(event) {
            this.$emit('conn-double-click', { conn: this.conn, event })
        },
        onContextMenu(event) {
            this.$emit('conn-context-menu', { conn: this.conn, event })
        },
        onLabelMouseDown(event) {
            this.infoPopupShow = false
            const startX = event.clientX
            const startY = event.clientY
            const onMove = (e) => {
                if (Math.abs(e.clientX - startX) > 2 || Math.abs(e.clientY - startY) > 2) {
                    this.infoPopupEditable = false
                    document.removeEventListener('mousemove', onMove)
                }
            }
            const onUp = () => {
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
                if (!this.infoPopupEditable) {
                    setTimeout(() => {
                        this.infoPopupEditable = true
                    }, 0)
                }
            }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
        },
        onSettingsUpdate(key, value) {
            this.$emit('conn-settings-update', { conn: this.conn, key, value })
        },
        onSettingsDelete() {
            this.$emit('conn-settings-delete', { conn: this.conn })
        },
    },
}
</script>

<style scoped>
/* Only target direct-child paths (edge paths), not SVG paths inside settings icon */
.vue-flow__edge > path {
  stroke: #b1b1b7;
  stroke-width: 1;
  fill: none;
  pointer-events: none;
  transition: stroke 0.3s ease, filter 0.18s ease;
}
.vue-flow__edge-interaction {
  stroke: transparent !important;
  stroke-width: 20 !important;
  fill: none;
  pointer-events: stroke !important;
  cursor: pointer;
}
.vue-flow__edge:hover > path {
  stroke: #555;
}
.vue-flow__edge--selected > path,
.vue-flow__edge--selected:hover > path {
  filter: drop-shadow(0 0 2px rgba(220, 38, 38, 0.8)) drop-shadow(0 0 4px rgba(220, 38, 38, 0.5)) drop-shadow(0 0 6px rgba(220, 38, 38, 0.25));
}
.vue-flow__edge--animated > path:not(.vue-flow__edge-interaction) {
  stroke-dasharray: 5;
  animation: vue-flow-dash 0.5s linear infinite;
}
@keyframes vue-flow-dash {
  to { stroke-dashoffset: -10; }
}
.vue-flow__edge-label-area {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.vue-flow__edge-label-group {
  position: relative;
  display: inline-flex;
  align-items: center;
  pointer-events: all;
}
.vue-flow__edge-label {
  pointer-events: all;
  cursor: pointer;
  font-family: 'Microsoft JhengHei', '微軟正黑體', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 10px;
  background: #fff;
  padding: 2px 4px;
  border-radius: 2px;
  white-space: nowrap;
  user-select: none;
  text-align: center;
  display: inline-block;
}
.vue-flow__edge-settings-anchor {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 2;
  pointer-events: all;
}
.vue-flow__edge-settings {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #ccc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #888;
  pointer-events: all;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.vue-flow__edge-settings:hover {
  border-color: #666;
  background: #f0f0f0;
  color: #333;
}
/* Fade transition for settings icon */
.vue-flow__fade-enter-active,
.vue-flow__fade-leave-active {
  transition: opacity 0.15s ease;
}
.vue-flow__fade-enter,
.vue-flow__fade-leave-to {
  opacity: 0;
}
</style>
