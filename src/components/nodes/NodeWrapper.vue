<template>
  <div
    v-if="!node.hidden"
    :class="classes"
    :style="wrapperStyle"
    :data-id="node.id"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @dblclick.stop="onDoubleClick"
    @contextmenu.stop="onContextMenu"
  >
    <WPopup
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
        <NodeBody
          :node="node"
          :connectable="connectable"
          :selected="selected"
          :resizable="resizable"
          :locked="locked"
          :hovered="hovered"
          :lastW="cachedW"
          :lastH="cachedH"
          @resize-start="onResizeStart($event.event, $event.edge)"
          @connect-start="onConnectStart"
        />
      </template>
      <template v-slot:content>
        <slot name="node-popup" :node="node">
          <div v-if="node.name || node.description" style="min-width:120px">
            <div v-if="node.name" :style="{ fontSize: inforPopupTitleTextFontSize, color: inforPopupTitleTextColor, fontWeight: 500 }">{{ node.name }}</div>
            <div v-if="node.description" :style="{ fontSize: inforPopupDescriptionTextFontSize, color: inforPopupDescriptionTextColor, marginTop: '4px' }">{{ node.description }}</div>
          </div>
        </slot>
      </template>
    </WPopup>
    <!-- Settings popup -->
    <transition name="vue-flow__fade">
    <div v-if="(hovered || settingsPopupShow) && draggable && !locked && settingsEnabled" class="vue-flow__node-settings-anchor">
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
        @show="$emit('node-settings-click', { node: node })"
      >
        <template v-slot:trigger>
          <div class="vue-flow__node-settings">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
              <path d="M11.078 0l.294 1.833a7.587 7.587 0 0 1 2.174 1.25l1.725-.618 1.078 1.87-1.43 1.217a7.508 7.508 0 0 1 0 2.498l1.43 1.217-1.078 1.87-1.725-.618a7.587 7.587 0 0 1-2.174 1.25L11.078 14H8.922l-.294-1.833a7.587 7.587 0 0 1-2.174-1.25l-1.725.618-1.078-1.87 1.43-1.217a7.508 7.508 0 0 1 0-2.498L3.65 4.733l1.078-1.87 1.725.618a7.587 7.587 0 0 1 2.174-1.25L8.922 0h2.156zM10 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" transform="translate(0 3)"/>
            </svg>
          </div>
        </template>
        <template v-slot:content>
          <NodeSettingsForm
            :node="node"
            :def-node="dn"
            :text-font-size="settingsPopupTextFontSize"
            :excludes="settingsExcludes"
            @update="onSettingsUpdate"
            @delete="onSettingsDelete"
          />
        </template>
      </WPopup>
    </div>
    </transition>
  </div>
</template>

<script>
import NodeBody from './NodeBody.vue'
import NodeSettingsForm from '../ui/NodeSettingsForm.vue'
import WPopup from 'w-component-vue/src/components/WPopup.vue'

export default {
    name: 'NodeWrapper',
    components: { NodeBody, NodeSettingsForm, WPopup },
    inject: { getDefNode: { default: () => () => ({}) } },
    props: {
        node: { type: Object, required: true },
        selected: { type: Boolean, default: false },
        draggable: { type: Boolean, default: true },
        connectable: { type: Boolean, default: true },
        resizable: { type: Boolean, default: true },
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
        dn() {
            return this.getDefNode()
        },
        isDiamond() {
            return this.node.shape === 'diamond'
        },
        isEllipse() {
            return this.node.shape === 'ellipse'
        },
        isTriangle() {
            let s = this.node.shape
            return s === 'triangle' || s === 'triangle-right' || s === 'triangle-down' || s === 'triangle-left'
        },
        isSvgShape() {
            return this.isDiamond || this.isEllipse || this.isTriangle
        },
        classes() {
            const nodeClasses = this.node.class
                ? (Array.isArray(this.node.class) ? this.node.class : [this.node.class])
                : []
            return [
                'vue-flow__node',
                `vue-flow__node-${this.node.type || 'basic'}`,
                ...nodeClasses,
                {
                    'vue-flow__node--selected': this.selected,
                    'vue-flow__node--dragging': this.isDragging,
                    'vue-flow__node--locked': this.locked,
                    'vue-flow__node--diamond': this.isDiamond,
                    'vue-flow__node--ellipse': this.isEllipse,
                    'vue-flow__node--triangle': this.isTriangle,
                },
            ]
        },
        wrapperStyle() {
            const d = this.dn
            const n = this.node
            const style = {
                transform: `translate(${n.position.x}px, ${n.position.y}px)`,
                zIndex: n.zIndex || 0,
                // Nodes with an explicit width wrap long names instead of
                // overflowing (base CSS is nowrap); per-node style can override.
                ...(n.width ? { whiteSpace: 'pre-line' } : {}),
                ...(n.style || {}),
            }
            if (n.width) style.width = typeof n.width === 'number' ? `${n.width}px` : n.width
            if (n.height) style.height = typeof n.height === 'number' ? `${n.height}px` : n.height
            if (!this.isSvgShape) {
                let fColor = n.faceColor || d.faceColor
                if (fColor) style.background = fColor
                let eColor = n.edgeColor || d.edgeColor
                if (eColor) style.borderColor = eColor
                let eWidth = n.edgeWidth !== undefined ? n.edgeWidth : d.edgeWidth
                if (eWidth !== undefined) style.borderWidth = eWidth + 'px'
            }
            let fs = n.fontSize || d.fontSize
            if (fs) style.fontSize = fs + 'px'
            let fc = n.fontColor || d.fontColor
            if (fc) style.color = fc
            return style
        },
    },
    data() {
        return {
            isDragging: false,
            hovered: false,
            infoPopupShow: false,
            infoPopupEditable: true,
            settingsPopupShow: false,
            cachedW: 0,
            cachedH: 0,
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
    mounted() {
        this.$nextTick(() => this.reportDimensions())
    },
    updated() {
        this.reportDimensions()
    },
    methods: {
        reportDimensions() {
            if (!this.$el) return
            const w = this.$el.offsetWidth
            const h = this.$el.offsetHeight
            if (w === this.cachedW && h === this.cachedH) return
            this.cachedW = w
            this.cachedH = h
            this.$emit('dimensions', { nodeId: this.node.id, width: w, height: h })
        },
        onMouseDown(event) {
            this._mouseDownPos = { x: event.clientX, y: event.clientY }
            if (!this.draggable) return
            if (this.node.dragHandle) {
                const handle = event.target.closest(this.node.dragHandle)
                if (!handle) return
            }
            this.infoPopupShow = false
            this.$emit('drag-start', { node: this.node, event })
            const startX = event.clientX
            const startY = event.clientY
            const onDragMove = (e) => {
                if (Math.abs(e.clientX - startX) > 2 || Math.abs(e.clientY - startY) > 2) {
                    this.infoPopupEditable = false
                    document.removeEventListener('mousemove', onDragMove)
                }
            }
            const onDragEnd = () => {
                document.removeEventListener('mousemove', onDragMove)
                document.removeEventListener('mouseup', onDragEnd)
                if (!this.infoPopupEditable) {
                    setTimeout(() => {
                        this.infoPopupEditable = true
                    }, 0)
                }
            }
            document.addEventListener('mousemove', onDragMove)
            document.addEventListener('mouseup', onDragEnd)
        },
        onMouseUp(event) {
            if (!this._mouseDownPos) return
            const dx = event.clientX - this._mouseDownPos.x
            const dy = event.clientY - this._mouseDownPos.y
            this._mouseDownPos = null
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
                this.$emit('node-click', { node: this.node, event })
            }
        },
        onDoubleClick(event) {
            this.$emit('node-double-click', { node: this.node, event })
        },
        onContextMenu(event) {
            this.$emit('node-context-menu', { node: this.node, event })
        },
        onConnectStart(payload) {
            this.$emit('connect-start', { ...payload, nodeId: this.node.id })
        },
        onMouseEnter(event) {
            this.hovered = true
            this.$emit('node-mouseenter', { node: this.node, event })
        },
        onMouseLeave(event) {
            this.hovered = false
            this.$emit('node-mouseleave', { node: this.node, event })
        },
        onSettingsUpdate(key, value) {
            this.$emit('node-settings-update', { node: this.node, key, value })
        },
        onSettingsDelete() {
            this.$emit('node-settings-delete', { node: this.node })
        },
        onResizeStart(event, edge) {
            this.infoPopupShow = false
            this.$nextTick(() => {
                this.infoPopupEditable = false
            })
            event.preventDefault()

            // Lock cursor for the entire drag duration
            const cursorMap = {
                'top-left': 'nwse-resize',
                'bottom-right': 'nwse-resize',
                'top-right': 'nesw-resize',
                'bottom-left': 'nesw-resize',
            }
            const lockedCursor = cursorMap[edge] || 'default'
            const cursorStyle = document.createElement('style')
            cursorStyle.textContent = '* { cursor: ' + lockedCursor + ' !important; }'
            document.head.appendChild(cursorStyle)

            const startX = event.clientX
            const startY = event.clientY
            const startW = this.node.width || this.$el.offsetWidth
            const startH = this.node.height || this.$el.offsetHeight
            const startPosX = this.node.position.x
            const startPosY = this.node.position.y
            const snap = this.snapGridSize
            const minSize = snap || 10
            // Get zoom from the viewport transform
            const viewport = this.$el.closest('.vue-flow__viewport')
            const zoom = viewport ? parseFloat(viewport.style.transform.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1

            const snapVal = (v) => snap ? Math.max(snap, Math.round(v / snap) * snap) : Math.max(minSize, Math.round(v))

            const resizeRight = (dx) => snapVal(startW + dx)
            const resizeLeft = (dx) => {
                const newW = snapVal(startW - dx)
                return { w: newW, x: startPosX + (startW - newW) }
            }
            const resizeBottom = (dy) => snapVal(startH + dy)
            const resizeTop = (dy) => {
                const newH = snapVal(startH - dy)
                return { h: newH, y: startPosY + (startH - newH) }
            }

            const onMouseMove = (e) => {
                const dx = (e.clientX - startX) / zoom
                const dy = (e.clientY - startY) / zoom
                let newW = startW; let newH = startH; let newX = startPosX; let newY = startPosY

                if (edge === 'top-left') {
                    let rl2 = resizeLeft(dx); newW = rl2.w; newX = rl2.x
                    let rt2 = resizeTop(dy); newH = rt2.h; newY = rt2.y
                }
                else if (edge === 'top-right') {
                    newW = resizeRight(dx)
                    let rt3 = resizeTop(dy); newH = rt3.h; newY = rt3.y
                }
                else if (edge === 'bottom-left') {
                    let rl3 = resizeLeft(dx); newW = rl3.w; newX = rl3.x
                    newH = resizeBottom(dy)
                }
                else if (edge === 'bottom-right') {
                    newW = resizeRight(dx)
                    newH = resizeBottom(dy)
                }

                this.$emit('node-resize', {
                    nodeId: this.node.id,
                    width: newW,
                    height: newH,
                    x: newX,
                    y: newY,
                })
            }

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
                document.head.removeChild(cursorStyle)
                setTimeout(() => {
                    this.infoPopupEditable = true
                }, 0)
                this.$emit('node-resize-end', {
                    nodeId: this.node.id,
                    width: this.node.width || this.$el.offsetWidth,
                    height: this.node.height || this.$el.offsetHeight,
                    x: this.node.position.x,
                    y: this.node.position.y,
                })
            }

            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
        },
    },
}
</script>

<style scoped>
.vue-flow__node {
  position: absolute;
  cursor: grab;
  user-select: none;
  pointer-events: all;
  box-sizing: border-box;
  border: 1px solid #bbb;
  border-radius: 3px;
  background: #fff;
  font-family: 'Microsoft JhengHei', '微軟正黑體', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  transition: border-color 0.2s ease, box-shadow 0.3s ease;
}
.vue-flow__node:hover {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}
.vue-flow__node--selected {
  box-shadow: 0 0 8px 2px rgba(220, 38, 38, 0.5);
}
.vue-flow__node--selected:hover {
  box-shadow: 0 0 8px 2px rgba(220, 38, 38, 0.5);
}
.vue-flow__node--dragging {
  cursor: grabbing;
  z-index: 1000 !important;
}

/* Settings icon anchor (positioning only) */
.vue-flow__node-settings-anchor {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 2;
  pointer-events: all;
}
/* Settings icon (appearance only) */
.vue-flow__node-settings {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  color: #888;
}
.vue-flow__node-settings:hover {
  border-color: #666;
  background: #f0f0f0;
  color: #333;
}


/* Shared SVG shape base styles */
.vue-flow__node--diamond,
.vue-flow__node--ellipse,
.vue-flow__node--triangle {
  background: transparent !important;
  border-color: transparent !important;
  border-radius: 0 !important;
}
.vue-flow__node--diamond:hover,
.vue-flow__node--ellipse:hover,
.vue-flow__node--triangle:hover {
  box-shadow: none !important;
}
.vue-flow__node--diamond.vue-flow__node--selected,
.vue-flow__node--ellipse.vue-flow__node--selected,
.vue-flow__node--triangle.vue-flow__node--selected {
  border-color: transparent !important;
  box-shadow: none !important;
}
.vue-flow__node--diamond.vue-flow__node--selected:hover,
.vue-flow__node--ellipse.vue-flow__node--selected:hover,
.vue-flow__node--triangle.vue-flow__node--selected:hover {
  border-color: transparent !important;
  box-shadow: none !important;
}
/* SVG shape hover */
.vue-flow__node--diamond:hover .vue-flow__shape-svg polygon,
.vue-flow__node--triangle:hover .vue-flow__shape-svg polygon,
.vue-flow__node--ellipse:hover .vue-flow__shape-svg ellipse {
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.15));
}
/* SVG shape selected: red shadow */
.vue-flow__node--diamond.vue-flow__node--selected .vue-flow__shape-svg polygon,
.vue-flow__node--triangle.vue-flow__node--selected .vue-flow__shape-svg polygon,
.vue-flow__node--ellipse.vue-flow__node--selected .vue-flow__shape-svg ellipse {
  filter: drop-shadow(0 0 6px rgba(220, 38, 38, 0.6));
}
/* Fade transition for settings icon and resize handles */
.vue-flow__fade-enter-active,
.vue-flow__fade-leave-active {
  transition: opacity 0.15s ease;
}
.vue-flow__fade-enter,
.vue-flow__fade-leave-to {
  opacity: 0;
}
</style>
