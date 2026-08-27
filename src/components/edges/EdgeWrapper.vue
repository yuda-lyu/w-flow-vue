<template>
  <!-- 點擊類事件(click/dblclick/contextmenu)統一掛在 <g>: 線本體、label 區(hover rect 與 label span)、
       轉折點等一切子元素冒泡至此同一處理——舊寫法只掛在 interaction path 與 rect, label span(位於 foreignObject,
       疊在 rect 之上)之點擊/雙擊/右鍵全部漏接(實測: label 單擊不發 conn-click 不選取, 雙擊/右鍵無事件);
       齒輪錨區與轉折點於 handler 內排除(各有自己的手勢語義). .stop 維持舊語義(不冒泡至 canvas 之 pane-click)
       hover 視覺以 vue-flow__edge--hovered class 驅動而非 :hover: 選取時 EdgeRenderer 會把本 <g> 搬到最後(置頂),
       DOM 重新插入會令 :hover 樣式從初始態重算並重跑 transition(齒輪閃一下, 實測已重現); class 隨元件狀態存在, 插入即為終態 -->
  <g
    :class="classes"
    :data-id="conn.id"
    @mouseenter="onGroupMouseEnter"
    @mouseleave="onGroupMouseLeave"
    @click.stop="onGroupClick"
    @dblclick.stop="onGroupDoubleClick"
    @contextmenu.stop="onGroupContextMenu"
  >
    <!-- Hover zone around label + settings icon area (below interaction path in z-order) -->
    <rect
      :x="pathData.labelX - 60"
      :y="pathData.labelY - 18"
      width="120"
      height="36"
      fill="transparent"
      pointer-events="all"
    />
    <!-- Interaction path (wider, invisible) -->
    <path
      :d="pathData.path"
      class="vue-flow__edge-interaction"
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
            :value="infoPopupShow"
            @input="onInfoPopupInput"
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
              <!-- 宿主自訂popup內容以「普通函式prop」傳入(SlotOutlet), 取代條件式slot轉發鏈(見SlotOutlet之why) -->
              <SlotOutlet v-if="popupSlotFn" :render="popupSlotFn" :scope="{ conn: conn }" />
              <slot v-else name="conn-popup" :conn="conn">
                <div v-if="conn.name || conn.description" style="min-width:120px">
                  <div v-if="conn.name" :style="{ fontSize: inforPopupTitleTextFontSize, color: inforPopupTitleTextColor, fontWeight: 500 }">{{ conn.name }}</div>
                  <div v-if="conn.description" :style="{ fontSize: inforPopupDescriptionTextFontSize, color: inforPopupDescriptionTextColor, marginTop: '4px' }">{{ conn.description }}</div>
                </div>
              </slot>
            </template>
          </WPopup>
          <transition name="vue-flow__fade">
          <!-- activate掛@click而非@mousedown: mousedown當下改選取會於down與up之間觸發重渲染,
               foreignObject內元素被patch替換後up落在新元素上, click(popup開啟訊號)根本不發生(已於e2e重現: E2E-012表單數變0);
               click時WPopup trigger之內層handler先跑(popup先開), 冒泡至此才轉移active -->
          <span v-if="(hovered || settingsPopupShow) && interactive && !locked && settingsEnabled" class="vue-flow__edge-settings-anchor" @click="onSettingsAnchorClick">
              <!-- 受控而非v-model: 開啟請求經onSettingsPopupInput裁決(複選模式中拒開), @show跟隨實際開啟 -->
              <WPopup
                :value="settingsPopupShow"
                @input="onSettingsPopupInput"
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
                  <!-- 不用@mousedown.stop: stopPropagation會連window層popup互斥協調一併擋掉(致其他popup無法關閉); 防canvas startPan改由onCanvasMouseDown排除.vue-flow__edge-settings處理
                       hover 樣式以 gearHovered class 驅動(理由見 <g> 註解: 置頂重插入時 :hover 會閃) -->
                  <span
                    class="vue-flow__edge-settings"
                    :class="{ 'vue-flow__edge-settings--hover': gearHovered }"
                    @mouseenter="gearHovered = true"
                    @mouseleave="gearHovered = false"
                  >
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
import { resolveSourceAnchor, resolveTargetAnchor } from '../../js/anchorPolicy.mjs'
import ConnSettingsForm from '../ui/ConnSettingsForm.vue'
import SlotOutlet from '../ui/SlotOutlet.vue'
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
    components: { ConnSettingsForm, SlotOutlet, WPopup },
    inject: {
        getDefConn: { default: () => () => ({}) },
        //defNode 供錨點解析之 defNode 層(anchorPolicy), 與把手渲染同一基準
        getDefNode: { default: () => () => ({}) },
        getDragGhost: { default: () => () => null },
        //複選鍵是否生效: getter注入而非prop——只被事件handler讀取, 不進渲染面, 判準與NodeWrapper一致
        getMultiSelectActive: { default: () => () => false },
        //進行中手勢(一次一手勢)與 popup 開啟閘門: 判準與 NodeWrapper 一致(spec/流程_互動契約.md §5-§6)
        getActiveGesture: { default: () => () => null },
        getCanOpenPopup: { default: () => () => true },
    },
    props: {
        conn: { type: Object, required: true },
        sourceNode: { type: Object, default: null },
        targetNode: { type: Object, default: null },
        selected: { type: Boolean, default: false },
        //宿主自訂popup內容之scoped slot函式(無則null走內建fallback)
        popupSlotFn: { type: Function, default: null },
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
            gearHovered: false,
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
        //複選模式引擎時關閉本連線已開之popup(與NodeWrapper同契約)
        multiSelectActive(val) {
            if (val) {
                this.infoPopupShow = false
                this.settingsPopupShow = false
            }
        },
    },
    beforeDestroy() {
        //轉折點拖曳進行中被銷毀: document 監聽與全域游標樣式不會自行移除, 於此收尾並通知 WFlowVue 清手勢(不提交)
        if (this.endWaypointGesture()) {
            this.dragPts = null
            this.$emit('conn-waypoint-end', { conn: this.conn, cancelled: true })
        }
    },
    computed: {
        //複選模式(反應式讀取注入getter): 供watcher清popup與各開啟入口gating
        multiSelectActive() {
            return this.getMultiSelectActive()
        },
        dc() {
            return this.getDefConn()
        },
        hasInfoPopup() {
            //popupSlotFn: 宿主自訂popup內容自slot轉發鏈改為函式prop後, 本元件$scopedSlots不再有宿主slot,
            //缺此判斷時「無name/description但宿主有給conn-popup」之連線會整個不渲染WPopup(自訂popup無聲消失);
            //$scopedSlots保留供直接掛載本元件並帶slot之用法
            return !!(this.conn.name || this.conn.description || this.popupSlotFn || this.$scopedSlots['conn-popup'])
        },
        //(效能重構)錨點方位/座標自算(原由EdgeRenderer解析後以props傳入):
        //  含拖曳/縮放ghost(細粒度反應式), 僅本邊兩端節點變動時本元件才重渲染
        //方位解析走 anchorPolicy 單一來源(Fixed=conn層 > Auto=節點層 > defNode層 > 內建);
        //why 補 defNode 層: 原本此處手寫 fallback 漏看 defNode, 與把手渲染(有看)分家——
        //宿主設 defNodeToPosition 時把手畫在該側, 邊卻仍自內建側出發
        sourcePosition() {
            return resolveSourceAnchor(this.conn, this.sourceNode, this.getDefNode()).side
        },
        targetPosition() {
            return resolveTargetAnchor(this.conn, this.targetNode, this.getDefNode()).side
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
            return getHandlePosition(n, this.sourcePosition, this.nodeInternals[n.id] || {}, 'source', this.getDefNode())
        },
        targetPoint() {
            const n = this.effTargetNode
            if (!n) return { x: 0, y: 0 }
            return getHandlePosition(n, this.targetPosition, this.nodeInternals[n.id] || {}, 'target', this.getDefNode())
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
                    'vue-flow__edge--hovered': this.hovered,
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
            this.gearHovered = false
            this.$emit('conn-mouseleave', { conn: this.conn, event })
        },
        //<g> 層之點擊類事件分流: 齒輪錨區(開設定 popup/activate 由其自身 handler 處理)與轉折點(拖曳手勢, 放開後之 click
        //不得視為點線)一律略過; 其餘(線本體/label 區/hover rect)走原 onClick 語義。
        //target 為 <g> 自身亦略過: mousedown 與 mouseup 落在不同子元素時(如拖轉折點放開於 label rect 上), 瀏覽器把 click
        //派發到共同祖先——那是一次拖曳而非點擊(e2e 轉折點拖曳案例實測: 誤開資訊 popup)
        isGestureTarget(event) {
            const t = event && event.target
            if (!t) return false
            if (t === event.currentTarget) return true
            if (!t.closest) return false
            return !!t.closest('.vue-flow__edge-settings-anchor, .vue-flow__edge-waypoint')
        },
        onGroupClick(event) {
            if (this.isGestureTarget(event)) return
            this.onClick(event)
        },
        onGroupDoubleClick(event) {
            if (this.isGestureTarget(event)) return
            this.onDoubleClick(event)
        },
        onGroupContextMenu(event) {
            if (this.isGestureTarget(event)) return
            this.onContextMenu(event)
        },
        //popup 開啟閘門: 複選模式 或 任何手勢進行中 一律拒開(判準與NodeWrapper一致)
        canOpenPopup() {
            return !this.getMultiSelectActive() && this.getCanOpenPopup()
        },
        //資訊popup之開關請求由本元件裁決(見NodeWrapper.onInfoPopupInput之why); 關閉請求一律放行
        onInfoPopupInput(val) {
            if (val && !this.canOpenPopup()) {
                return
            }
            this.infoPopupShow = val
        },
        onClick(event) {
            //連線之popup另有本地直接開啟路徑(非僅WPopup trigger), 故此處亦須擋
            if (this.hasInfoPopup && this.canOpenPopup()) {
                this.infoPopupShow = true
            }
            this.$emit('conn-click', { conn: this.conn, event })
        },
        //宿主API入口gating: 程式化開啟於複選/手勢中亦拒絕(回傳false供呼叫端判斷)
        openInfoPopup() {
            if (!this.canOpenPopup()) return false
            this.infoPopupShow = true
            return true
        },
        //設定popup之開關由本元件裁決(拒開條件同上; 關閉請求一律放行)
        onSettingsPopupInput(val) {
            if (val && !this.canOpenPopup()) {
                return
            }
            this.settingsPopupShow = val
        },
        //關閉本連線全部 popup(手勢啟動時由 WFlowVue.closeAllPopups 統一呼叫, 理由見 NodeWrapper.closePopups)
        closePopups() {
            this.infoPopupShow = false
            this.settingsPopupShow = false
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
        //點連線齒輪=元素專屬操作: 該連線成為唯一active(掛@click之時序理由見模板註解; click僅主鍵觸發, 不需判button)
        onSettingsAnchorClick(event) {
            this.$emit('conn-activate', { conn: this.conn, event })
        },
        //收掉轉折點拖曳手勢之監聽與全域游標樣式(正常放開/視窗失焦/銷毀共用); 回傳是否確實收到進行中之手勢
        //why: 原版只掛 document mouseup, 視窗失焦或元件銷毀時監聽器與 `* { cursor: move }` 全域樣式殘留整頁
        endWaypointGesture() {
            const g = this._waypointGesture
            if (!g) return false
            this._waypointGesture = null
            document.removeEventListener('mousemove', g.onMouseMove)
            document.removeEventListener('mouseup', g.onMouseUp)
            window.removeEventListener('blur', g.onMouseUp)
            if (g.cursorStyle && g.cursorStyle.parentNode) g.cursorStyle.parentNode.removeChild(g.cursorStyle)
            return true
        },
        onWaypointMouseDown(i, event) {
            if (!this.interactive || this.locked || !this.settingsEnabled) return
            //複選模式中不啟動轉折點拖曳(標記已隱藏, 縱深第二層; 守衛先於preventDefault/樣式建立)
            if (this.getMultiSelectActive()) return
            //僅主鍵; 一次一手勢(判準與把手/四角/節點/畫布一致)
            if (event.button !== 0) return
            if (this.getActiveGesture()) return
            this.endWaypointGesture()
            event.preventDefault()
            //手勢生命週期上報(WFlowVue 據此設 activeGesture / 關閉全部 popup / 標記擁有者)
            this.$emit('conn-waypoint-start', { conn: this.conn, event, el: this.$el })

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
                if (!this.endWaypointGesture()) return
                //放開才發更新事件(與齒輪表單同一事件流, 由宿主持久化); 事件流為同步, 回來時conn.points已更新故可安全清ghost
                const value = this.waypointPts.map(p => [p.x, p.y])
                this.$emit('conn-settings-update', { conn: this.conn, key: 'points', value })
                this.dragPts = null
                this.$emit('conn-waypoint-end', { conn: this.conn })
            }
            this._waypointGesture = { onMouseMove, onMouseUp, cursorStyle }
            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
            //視窗失焦後收不到mouseup, 監聽器與全域游標樣式同樣需收尾(以最後 ghost 提交, 與節點縮放之失焦處理一致)
            window.addEventListener('blur', onMouseUp)
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
/* hover 視覺由 --hovered class 驅動(非 :hover), 理由見模板 <g> 註解 */
.vue-flow__edge--hovered > path {
  stroke: #555;
}
.vue-flow__edge--selected > path,
.vue-flow__edge--selected.vue-flow__edge--hovered > path {
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
.vue-flow__edge-settings--hover {
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
