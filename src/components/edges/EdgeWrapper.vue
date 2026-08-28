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
    <!-- 不設 label 周邊透明 hover/click 區: 可點區域只有線本體(interaction path)與 label 文字本身, 文字兩側空白不可點 -->
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
          <span v-if="(gearVisible || settingsPopupShow) && interactive && !locked && settingsEnabled" class="vue-flow__edge-settings-anchor" :class="{ 'vue-flow__edge-settings-anchor--silent': settingsTrigger !== 'hover' }" @click="onSettingsAnchorClick">
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
                      <path :d="gearPath" transform="translate(0 3)"/>
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
import { getPathFunction, parseWaypoints } from '../../js/edgePath'
import { effectiveEdgeType, effectiveAnimated, computeConnStyle, computeLabelStyle, computeEdgeClasses } from '../../js/edgeStyle.mjs'
import { getHandlePosition } from '../../js/geometry'
import { connSourceSide, connTargetSide } from '../../js/anchorPolicy.mjs'
import { resolveMarker, markerUrl } from '../../js/edgeMarker.mjs'
import { classifyHit, isAffordanceHit } from '../../js/hitTest.mjs'
import elementPopups from '../mixins/elementPopups.mjs'
import { GEAR_PATH } from '../../js/icons.mjs'
import { startDocumentGesture, crossedThreshold, gestureBlockedReason } from '../../js/domGesture.mjs'
import ConnSettingsForm from '../ui/ConnSettingsForm.vue'
import SlotOutlet from '../ui/SlotOutlet.vue'
import WPopup from 'w-component-vue/src/components/WPopup.vue'
import fixSvgNs from '../../js/fixSvgNs.mjs'


export default {
    name: 'EdgeWrapper',
    //修Vue2 #7330: 本元件位於<svg>內且含foreignObject, 需清除$vnode.ns否則其內HTML元素(含WPopup之slot內容)被建為SVGElement而0x0不可見
    //popup 狀態機共用 mixin(elementPopups, 與 NodeWrapper 同一份判準)
    mixins: [fixSvgNs, elementPopups],
    components: { ConnSettingsForm, SlotOutlet, WPopup },
    inject: {
        getDragGhost: { default: () => () => null },
        //視口縮放(client 位移 → 畫布位移換算; 高頻手勢狀態走 getter)
        getViewportZoom: { default: () => () => 1 },
        //進行中手勢(一次一手勢)與 popup 開啟閘門: 判準與 NodeWrapper 一致(spec/流程_互動契約.md §5-§6)
        getActiveGesture: { default: () => () => null },
    },
    props: {
        conn: { type: Object, required: true },
        //節點/連線預設(opt.def*): 低頻配置 props 下傳
        defNode: { type: Object, default: () => ({}) },
        defConn: { type: Object, default: () => ({}) },
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
        nodeInternals: { type: Object, default: () => ({}) },
        settingsEnabled: { type: Boolean, default: true },
        //設定入口方式: 'hover'(移入顯示齒輪, 點齒輪開設定) | 'click' | 'dblclick'(該動作直接開設定 popup, 不顯示齒輪)
        settingsTrigger: { type: String, default: 'dblclick' },
        settingsExcludes: { type: Array, default: () => [] },
    },
    data() {
        return {
            gearHovered: false,
            dragPts: null, //轉折點拖曳中之暫時座標([[x,y],...]), 比照節點拖曳之ghost: 不改conn.points(prop), 放開才emit由宿主寫回
        }
    },
    watch: {
        //上鎖切換(契約 §5): 本連線持有之 document 手勢(轉折點拖曳/label 追蹤)取消提交
        locked(val) {
            if (val) this.cancelLocalGestures()
        },
    },
    beforeDestroy() {
        this.cancelLocalGestures()
    },
    computed: {
        //設定 popup 之可互動旗標(elementPopups.canOpenSettings): 連線以 interactive 為準
        settingsInteractive() {
            return this.interactive
        },
        gearPath() {
            return GEAR_PATH
        },
        effAnimated() {
            return effectiveAnimated(this.conn, this.dc)
        },
        edgeType() {
            return effectiveEdgeType(this.conn, this.dc)
        },
        dc() {
            return this.defConn
        },
        hasInfoPopup() {
            //popupSlotFn: 宿主自訂popup內容自slot轉發鏈改為函式prop後, 本元件$scopedSlots不再有宿主slot,
            //缺此判斷時「無name/description但宿主有給conn-popup」之連線會整個不渲染WPopup(自訂popup無聲消失);
            //$scopedSlots保留供直接掛載本元件並帶slot之用法
            return !!(this.conn.name || this.conn.description || this.popupSlotFn || this.$scopedSlots['conn-popup'])
        },
        //(效能重構)錨點方位/座標自算(原由EdgeRenderer解析後以props傳入):
        //  含拖曳/縮放ghost(細粒度反應式), 僅本邊兩端節點變動時本元件才重渲染
        //方位由邊自己持有(anchorPolicy 單一來源: conn → defConn → 內建): 射出方向為節點外接矩形該邊之法向量
        sourcePosition() {
            return connSourceSide(this.conn, this.dc)
        },
        targetPosition() {
            return connTargetSide(this.conn, this.dc)
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
            return getHandlePosition(n, this.sourcePosition, this.nodeInternals[n.id] || {}, this.defNode)
        },
        targetPoint() {
            const n = this.effTargetNode
            if (!n) return { x: 0, y: 0 }
            return getHandlePosition(n, this.targetPosition, this.nodeInternals[n.id] || {}, this.defNode)
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
        //強制轉折點(edgePath.parseWaypoints 嚴格解析, 與路徑函式同一 parser), 無效回空陣列
        waypointPts() {
            return parseWaypoints(this.effPoints) || []
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
            return computeEdgeClasses(this.conn, this.dc, { selected: this.selected, hovered: this.hovered })
        },
        pathData() {
            const fn = getPathFunction(this.edgeType)
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
                offset: this.dc.defOffset,
            })
        },
        //線色/線寬與 marker 同一 resolveLineStyle; 選取態 +1px(edgeStyle.computeConnStyle)
        connStyle() {
            return computeConnStyle(this.conn, this.dc, this.selected)
        },
        //兩端箭頭(edgeMarker 單一來源, 與 EdgeMarkerDefs 同一 id)
        markerStartUrl() {
            return markerUrl(resolveMarker(this.conn, this.dc, 'start'))
        },
        markerEndUrl() {
            return markerUrl(resolveMarker(this.conn, this.dc, 'end'))
        },
        labelStyle() {
            return computeLabelStyle(this.conn, this.dc)
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
            //affordance(齒輪錨區/轉折點)之分類走 hitTest 單一來源(選擇器清單不再於此另抄一份)
            return isAffordanceHit(classifyHit(t, this.$el))
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
        //直接開設定/點齒輪/轉折點: 本連線成為唯一 active(elementPopups.openSettingsPopup 亦經此發出)
        emitActivate(event) {
            this.$emit('conn-activate', { conn: this.conn, event })
        },
        onClick(event) {
            if (this.settingsTrigger === 'click' && this.canOpenSettings()) {
                //click 模式: 點線直接開設定 popup, 資訊 popup 讓位
                this.openSettingsPopup(event)
            }
            else if (this.hasInfoPopup) {
                //連線之popup另有本地直接開啟路徑(非僅WPopup trigger): 同走 elementPopups 之開啟政策(閘門/讓位/延後)
                this.requestInfoPopup()
            }
            this.$emit('conn-click', { conn: this.conn, event })
        },
        onDoubleClick(event) {
            if (this.settingsTrigger === 'dblclick') {
                this.cancelPendingInfo()
                this.openSettingsPopup(event)
            }
            this.$emit('conn-double-click', { conn: this.conn, event })
        },
        onContextMenu(event) {
            this.$emit('conn-context-menu', { conn: this.conn, event })
        },
        onLabelMouseDown(event) {
            //label 文字不可選取亦不可原生拖曳(圖台內文字拖曳無語義; 原生 drag 會接管事件流)
            event.preventDefault()
            //僅主鍵(與其他手勢同一判準); 重入先收上一輪(mouseup 遺失時之殘留)
            if (event.button !== 0) return
            this.endLabelGesture()
            this.infoPopupShow = false
            const startX = event.clientX
            const startY = event.clientY
            //label 位移追蹤(domGesture): 跨門檻即視為拖曳(資訊 popup 不因此次放開而開); mouseup / blur / buttons-lost 同一收尾
            this._labelGesture = startDocumentGesture({
                onMove: (e) => {
                    if (crossedThreshold(startX, startY, e.clientX, e.clientY)) this.infoPopupEditable = false
                },
                onEnd: () => {
                    this._labelGesture = null
                    if (!this.infoPopupEditable) {
                        setTimeout(() => {
                            this.infoPopupEditable = true
                        }, 0)
                    }
                },
            })
        },
        //label 位移追蹤之收尾(mouseup / blur / destroy 共用): 卸 document/window 監聽
        endLabelGesture() {
            const g = this._labelGesture
            if (!g) return false
            this._labelGesture = null
            return g.dispose()
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
        //本連線持有之 document 手勢一併取消(destroy / 上鎖共用): 轉折點不提交, 通知 WFlowVue 清手勢與 ghost
        cancelLocalGestures() {
            this.endLabelGesture()
            if (this.endWaypointGesture()) {
                this.dragPts = null
                this.$emit('conn-waypoint-end', { conn: this.conn, cancelled: true })
            }
        },
        endWaypointGesture() {
            const g = this._waypointGesture
            if (!g) return false
            this._waypointGesture = null
            g.dispose()
            return true
        },
        onWaypointMouseDown(i, event) {
            if (!this.interactive || this.locked || !this.settingsEnabled) return
            //啟動守衛(domGesture.gestureBlockedReason 單一來源): 複選模式 / 進行中手勢 / 非主鍵不啟動(先於 preventDefault/樣式建立)
            if (gestureBlockedReason({ button: event.button, multiSelectActive: this.getMultiSelectActive(), activeGesture: this.getActiveGesture() })) return
            this.endWaypointGesture()
            event.preventDefault()
            //手勢生命週期上報(WFlowVue 據此設 activeGesture / 關閉全部 popup / 標記擁有者)
            this.$emit('conn-waypoint-start', { conn: this.conn, event, el: this.$el })

            const startX = event.clientX
            const startY = event.clientY
            const pts0 = this.waypointPts.map(p => [p.x, p.y]) //拖曳起始快照
            const zoom = this.getViewportZoom() || 1
            //document 層手勢(domGesture): 期間鎖定 move 游標; mouseup / blur / buttons-lost 皆以最後 ghost 提交(同一收尾)
            this._waypointGesture = startDocumentGesture({
                cursor: 'move',
                onMove: (e) => {
                    const dx = (e.clientX - startX) / zoom
                    const dy = (e.clientY - startY) / zoom
                    const np = pts0.map(p => [p[0], p[1]])
                    np[i] = [Math.round(pts0[i][0] + dx), Math.round(pts0[i][1] + dy)]
                    //僅更新本元件之ghost, 路徑即時重繪; 不mutate conn.points(prop)以免波及宿主之deep watcher
                    this.dragPts = np
                },
                onEnd: () => {
                    if (!this.endWaypointGesture()) return
                    //放開才發更新事件(與齒輪表單同一事件流, 由宿主持久化); 事件流為同步, 回來時conn.points已更新故可安全清ghost
                    const value = this.waypointPts.map(p => [p.x, p.y])
                    this.$emit('conn-settings-update', { conn: this.conn, key: 'points', value })
                    this.dragPts = null
                    this.$emit('conn-waypoint-end', { conn: this.conn })
                },
            })
        },
        onSettingsDelete() {
            //刪除「請求」(內部通道, 由 WFlowVue.runDelete 裁決與提交; 對宿主之完成事件只有 elements-deleted)
            this.$emit('conn-delete-request', { conn: this.conn })
        },
    },
}
</script>

<style scoped>
/* Only target direct-child paths (edge paths), not SVG paths inside settings icon */
.vue-flow__edge > path {
  stroke: #b1b1b1;
  stroke-width: 1;
  fill: none;
  pointer-events: none;
  /* 選取/取消選取之線寬與光暈以漸變過場(線寬為 inline style, transition 仍生效) */
  transition: stroke 0.2s ease, stroke-width 0.2s ease, filter 0.3s ease;
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
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.1)) drop-shadow(0 0 4px rgba(0, 0, 0, 0.1)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.1));
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
  -webkit-user-drag: none;
  text-align: center;
  display: inline-block;
}
.vue-flow__edge-popup-anchor {
  display: inline-block;
  width: 0;
  height: 0;
}
/* click/dblclick 模式: 錨區只供 popup 定位, 齒輪 icon 不可見亦不可點 */
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
</style>
