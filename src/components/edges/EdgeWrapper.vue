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
    <!-- 強制轉折點標記(編輯模式顯示, 可直接拖曳移動座標; 亦可經齒輪設定表單編修) -->
    <template v-if="showWaypoints">
      <!-- 不用@mousedown.stop: stopPropagation會擋掉window層WPopup互斥協調(致已開之node/conn資訊popup不關); 防canvas startPan改由onCanvasMouseDown排除.vue-flow__edge-waypoint處理 -->
      <circle
        v-for="(p, i) in waypointPts"
        :key="'wp' + i"
        :cx="p.x"
        :cy="p.y"
        r="4"
        class="vue-flow__edge-waypoint"
        @mousedown="onWaypointMouseDown(i, $event)"
      />
    </template>
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
            v-if="hasInfoPopup"
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
              <span v-if="conn.name" class="vue-flow__edge-label" :style="labelStyle" @mousedown="onLabelMouseDown">{{ conn.name }}</span>
              <!-- Zero-size anchor keeps the popup positioned at the label midpoint when the conn has no name -->
              <span v-else class="vue-flow__edge-popup-anchor"></span>
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
                  <!-- 不用@mousedown.stop: stopPropagation會連window層popup互斥協調一併擋掉(致其他popup無法關閉); 防canvas startPan改由onCanvasMouseDown排除.vue-flow__edge-settings處理 -->
                  <span class="vue-flow__edge-settings">
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
                    :default-point="waypointDefaultPoint"
                    :target-point="waypointTargetPoint"
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
import { getBezierPath, getStraightPath, getStepPath, getSmoothStepPath } from '../../js/edgePath'
import { getHandlePosition } from '../../js/geometry'
import ConnSettingsForm from '../ui/ConnSettingsForm.vue'
import WPopup from 'w-component-vue/src/components/WPopup.vue'
import fixSvgNs from '../../js/fixSvgNs.mjs'

const pathFunctions = {
    bezier: getBezierPath,
    straight: getStraightPath,
    step: getStepPath,
    smoothstep: getSmoothStepPath,
}

export default {
    name: 'EdgeWrapper',
    //修Vue2 #7330: 本元件位於<svg>內且含foreignObject, 需清除$vnode.ns否則其內HTML元素(含WPopup之slot內容)被建為SVGElement而0x0不可見
    mixins: [fixSvgNs],
    components: { ConnSettingsForm, WPopup },
    inject: { getDefConn: { default: () => () => ({}) }, getDragGhost: { default: () => () => null } },
    props: {
        conn: { type: Object, required: true },
        sourceNode: { type: Object, default: null },
        targetNode: { type: Object, default: null },
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
            dragPts: null, //轉折點拖曳中之暫時座標([[x,y],...]), 比照節點拖曳之ghost: 不改conn.points(prop), 放開才emit由宿主寫回
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
        hasInfoPopup() {
            return !!(this.conn.name || this.conn.description || this.$scopedSlots['conn-popup'])
        },
        //(效能重構)錨點方位/座標自算(原由EdgeRenderer解析後以props傳入):
        //  含拖曳/縮放ghost(細粒度反應式), 僅本邊兩端節點變動時本元件才重渲染
        sourcePosition() {
            return this.conn.fromPosition || (this.sourceNode && this.sourceNode.toPosition) || 'bottom' //conn層級覆寫優先
        },
        targetPosition() {
            return this.conn.toPosition || (this.targetNode && this.targetNode.fromPosition) || 'top'
        },
        effSourceNode() {
            return this.effNode(this.sourceNode)
        },
        effTargetNode() {
            return this.effNode(this.targetNode)
        },
        sourcePoint() {
            const n = this.effSourceNode
            if (!n) return { x: 0, y: 0 }
            return getHandlePosition(n, this.sourcePosition, this.nodeInternals[n.id] || {}, 'source')
        },
        targetPoint() {
            const n = this.effTargetNode
            if (!n) return { x: 0, y: 0 }
            return getHandlePosition(n, this.targetPosition, this.nodeInternals[n.id] || {}, 'target')
        },
        sourceX() {
            return this.sourcePoint.x
        },
        sourceY() {
            return this.sourcePoint.y
        },
        targetX() {
            return this.targetPoint.x
        },
        targetY() {
            return this.targetPoint.y
        },
        //自動路由(step/smoothstep)用之節點矩形: 僅取起訖兩節點且套用拖曳/縮放ghost。
        //why: OrthConnector之calculateStepPoints僅以「起訖兩節點矩形」決定路徑(allNodes原僅供findObstacleAt依端點座標定位該兩矩形, 不做跨節點避讓);
        //  若沿用store之allNodes, 拖曳時端點已隨ghost移動、但矩形仍為舊位→findObstacleAt找不到起訖矩形→退化為fallback直角短線, 放開後allNodes更新才恢復正交繞行→路徑跳動。
        //  改用effSource/effTargetNode(含ghost)即拖曳中與放開後同一計算、路徑不跳; 靜止時eff=原節點, 與原本傳全部節點所得之起訖矩形一致(版面不重疊), 放開後路由不變。
        routingNodes() {
            const r = []
            if (this.effSourceNode) r.push(this.effSourceNode)
            if (this.effTargetNode) r.push(this.effTargetNode)
            return r
        },
        //拖曳中優先取暫時座標(ghost), 靜止時取conn.points
        effPoints() {
            return this.dragPts || this.conn.points
        },
        // 強制轉折點正規化([[x,y],...]或[{x,y},...]皆可), 無效回空陣列
        waypointPts() {
            const pts = this.effPoints
            if (!Array.isArray(pts) || pts.length === 0) return []
            const r = []
            for (const p of pts) {
                let x = null
                let y = null
                if (Array.isArray(p) && p.length >= 2) {
                    x = Number(p[0]); y = Number(p[1])
                }
                else if (p && typeof p === 'object') {
                    x = Number(p.x); y = Number(p.y)
                }
                if (!Number.isFinite(x) || !Number.isFinite(y)) return []
                r.push({ x, y })
            }
            return r
        },
        showWaypoints() {
            return this.settingsEnabled && this.interactive && !this.locked && this.waypointPts.length > 0
        },
        //新增轉折點之預設位置=路徑中點(新點落於既有線上, 路徑幾乎不變不跳動)
        waypointDefaultPoint() {
            return { x: Math.round(this.pathData.labelX), y: Math.round(this.pathData.labelY) }
        },
        //後續新增以「末點與迄點錨中點」細分(供表單計算)
        waypointTargetPoint() {
            return { x: Math.round(this.targetX), y: Math.round(this.targetY) }
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
                points: this.effPoints, //強制轉折點([[x,y],...]或[{x,y},...]), 有給即取代自動路由(兩端錨點方位仍生效); 拖曳中為ghost座標
                allNodes: this.routingNodes, //僅起訖兩節點且含ghost, 修拖曳中路徑與放開後不一致(見routingNodes說明)

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
        //拖曳/縮放ghost套用: 有進行中之暫時幾何則以其構成有效節點(不改原節點物件)
        effNode(node) {
            if (!node) return null
            const g = this.getDragGhost(node.id)
            if (!g) return node
            return {
                ...node,
                position: { x: g.x, y: g.y },
                width: g.width !== undefined ? g.width : node.width,
                height: g.height !== undefined ? g.height : node.height,
            }
        },
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
            if (this.hasInfoPopup) {
                this.infoPopupShow = true
            }
            this.$emit('conn-click', { conn: this.conn, event })
        },
        openInfoPopup() {
            this.infoPopupShow = true
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
        onWaypointMouseDown(i, event) {
            if (!this.interactive || this.locked || !this.settingsEnabled) return
            event.preventDefault()

            // 鎖定拖曳游標
            const cursorStyle = document.createElement('style')
            cursorStyle.textContent = '* { cursor: move !important; }'
            document.head.appendChild(cursorStyle)

            const startX = event.clientX
            const startY = event.clientY
            const pts0 = this.waypointPts.map(p => [p.x, p.y]) //拖曳起始快照
            // Get zoom from the viewport transform(同 NodeWrapper 拖曳之換算)
            const viewport = this.$el.closest('.vue-flow__viewport')
            const zoom = viewport ? parseFloat(viewport.style.transform.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1

            const onMouseMove = (e) => {
                const dx = (e.clientX - startX) / zoom
                const dy = (e.clientY - startY) / zoom
                const np = pts0.map(p => [p[0], p[1]])
                np[i] = [Math.round(pts0[i][0] + dx), Math.round(pts0[i][1] + dy)]
                //僅更新本元件之ghost, 路徑即時重繪; 不mutate conn.points(prop)以免波及宿主之deep watcher
                this.dragPts = np
            }
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
                document.head.removeChild(cursorStyle)
                //放開才發更新事件(與齒輪表單同一事件流, 由宿主持久化); 事件流為同步, 回來時conn.points已更新故可安全清ghost
                const value = this.waypointPts.map(p => [p.x, p.y])
                this.$emit('conn-settings-update', { conn: this.conn, key: 'points', value })
                this.dragPts = null
            }
            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
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
.vue-flow__edge-waypoint {
  fill: #9e9e9e;
  stroke: #fff;
  stroke-width: 1.5;
  pointer-events: all;
  cursor: grab;
}
.vue-flow__edge-waypoint:hover {
  fill: #616161;
  stroke-width: 2;
}
.vue-flow__edge-waypoint:active {
  cursor: grabbing;
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
.vue-flow__edge-popup-anchor {
  display: inline-block;
  width: 0;
  height: 0;
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
