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
    @dragstart="onNativeDragStart"
  >
    <WPopup
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
        <!-- 宿主自訂popup內容以「普通函式prop」傳入(SlotOutlet呼叫), 取代條件式slot轉發鏈
             why: v-if slot轉發使本元件$stable=false, 上游每次re-render都強制全部wrapper重渲染(實測10/10 vs 0/10) -->
        <SlotOutlet v-if="popupSlotFn" :render="popupSlotFn" :scope="{ node: node }" />
        <slot v-else name="node-popup" :node="node">
          <div v-if="node.name || node.description" style="min-width:120px">
            <div v-if="node.name" :style="{ fontSize: inforPopupTitleTextFontSize, color: inforPopupTitleTextColor, fontWeight: 500 }">{{ node.name }}</div>
            <div v-if="node.description" :style="{ fontSize: inforPopupDescriptionTextFontSize, color: inforPopupDescriptionTextColor, marginTop: '4px' }">{{ node.description }}</div>
          </div>
        </slot>
      </template>
    </WPopup>
    <!-- Settings popup -->
    <!-- activate掛@click而非@mousedown: mousedown當下改選取會於down與up之間觸發重渲染,
         元素若被patch替換, up落在新元素上使click(popup開啟訊號)根本不發生(已於e2e重現於edge齒輪);
         click時WPopup trigger之內層handler先跑(popup先開), 冒泡至此才轉移active, 同一手勢內完成且不掛@show -->
    <transition name="vue-flow__fade">
    <div v-if="(hovered || settingsPopupShow) && draggable && !locked && settingsEnabled" class="vue-flow__node-settings-anchor" @click="onSettingsAnchorClick">
      <!-- 受控而非v-model: 開啟請求須經onSettingsPopupInput裁決(複選模式中拒開);
           WPopup非isolated, trigger點擊只是$emit請求, @show跟隨實際開啟故拒開時不會幽靈emit -->
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
            :fixed-out-count="fixedOutCount"
            :fixed-in-count="fixedInCount"
            @update="onSettingsUpdate"
            @delete="onSettingsDelete"
            @unfix-anchors="onUnfixAnchors"
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
import SlotOutlet from '../ui/SlotOutlet.vue'
import WPopup from 'w-component-vue/src/components/WPopup.vue'

export default {
    name: 'NodeWrapper',
    components: { NodeBody, NodeSettingsForm, SlotOutlet, WPopup },
    inject: {
        getDefNode: { default: () => () => ({}) },
        //conns 供固定錨點(Fixed)數量統計(設定表單之揭示列)
        getConns: { default: () => () => [] },
        getDragGhost: { default: () => () => null },
        //複選鍵是否生效: getter注入而非prop——只被事件handler讀取, 不進渲染面, 按/放複選鍵時不觸發重渲染
        getMultiSelectActive: { default: () => () => false },
    },
    props: {
        node: { type: Object, required: true },
        selected: { type: Boolean, default: false },
        draggable: { type: Boolean, default: true },
        connectable: { type: Boolean, default: true },
        resizable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
        //拖曳態: 由WFlowVue下傳(其dragNodeStartPositions之成員), 代表父層已真正接受此次拖曳。
        //不用NodeWrapper本地旗標: 本地只擋draggable不擋nodesDraggable, 於
        //nodesDraggable=false + node.draggable=true 時會誤判為拖曳中(父層其實拒絕);
        //且多選拖曳為整組移動, 本地旗標只會套到被滑鼠抓住的那一顆
        dragging: { type: Boolean, default: false },
        //宿主自訂popup內容之scoped slot函式(無則null走內建fallback), 由WFlowVue經Renderer原樣下傳
        popupSlotFn: { type: Function, default: null },
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
        //固定錨點(Fixed)之出/入邊數: 這些邊不跟隨節點之 To/From Handle 設定, 於表單揭示
        fixedOutCount() {
            return (this.getConns() || []).filter(c => c && c.from === this.node.id && c.fromPosition).length
        },
        fixedInCount() {
            return (this.getConns() || []).filter(c => c && c.to === this.node.id && c.toPosition).length
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
        //複選模式(反應式讀取注入getter): 供watcher清popup與各開啟入口gating
        multiSelectActive() {
            return this.getMultiSelectActive()
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
                    'vue-flow__node--dragging': this.dragging,
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
            //拖曳/縮放ghost(細粒度): 進行中之暫時幾何優先(per-key反應式, 只有本節點被拖/縮放時才觸發重渲染)
            const g = this.getDragGhost(n.id)
            const px = g ? g.x : n.position.x
            const py = g ? g.y : n.position.y
            const w = (g && g.width !== undefined) ? g.width : n.width
            const h = (g && g.height !== undefined) ? g.height : n.height
            const style = {
                transform: `translate(${px}px, ${py}px)`,
                zIndex: n.zIndex || 0,
                // Nodes with an explicit width wrap long names instead of
                // overflowing (base CSS is nowrap); per-node style can override.
                ...(w ? { whiteSpace: 'pre-line' } : {}),
                ...(n.style || {}),
            }
            if (w) style.width = typeof w === 'number' ? `${w}px` : w
            if (h) style.height = typeof h === 'number' ? `${h}px` : h
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
        //複選模式引擎時關閉本節點已開之popup(進入模式=畫面收束為純選取操作; 開啟入口另有各自gating,
        //本watcher只負責清理既有狀態); computed經注入getter建立反應式依賴, watcher具值相等檢查故僅於翻轉時執行
        multiSelectActive(val) {
            if (val) {
                this.infoPopupShow = false
                this.settingsPopupShow = false
            }
        },
    },
    mounted() {
        this.$nextTick(() => this.reportDimensions())
    },
    updated() {
        this.reportDimensions()
    },
    beforeDestroy() {
        //拖曳/縮放進行中被銷毀時, 掛在document上的監聽器與插入document.head之全域游標樣式
        //都不會自行移除, 於此一併收尾
        this.endMouseGesture(false)
        this.endResizeGesture(false)
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
        //收掉本次mousedown手勢之document監聽與暫存態; restorePopup=false供beforeDestroy使用(元件將銷毀不需再排程還原)
        endMouseGesture(restorePopup = true) {
            const g = this._mouseGesture
            if (!g) return
            this._mouseGesture = null
            this._mouseDownPos = null
            document.removeEventListener('mousemove', g.onDragMove)
            document.removeEventListener('mouseup', g.onDragEnd)
            window.removeEventListener('blur', g.onDragEnd)
            if (restorePopup && !this.infoPopupEditable) {
                setTimeout(() => {
                    this.infoPopupEditable = true
                }, 0)
            }
        },
        //收掉本次resize手勢之document監聽與插入document.head之全域游標樣式;
        //回傳是否確實收到一個進行中之手勢(供onMouseUp判斷該不該再發node-resize-end)
        //why: 全域樣式為`* { cursor: X !important; }`, 若因元件銷毀或視窗外放開而未移除,
        //     整頁每個元素都會卡在該游標直到重新整理(已於jsdom確定性重現: 銷毀後樣式仍留在head)
        endResizeGesture(restorePopup = true) {
            const g = this._resizeGesture
            if (!g) return false
            this._resizeGesture = null
            document.removeEventListener('mousemove', g.onMouseMove)
            document.removeEventListener('mouseup', g.onMouseUp)
            window.removeEventListener('blur', g.onMouseUp)
            if (g.cursorStyle && g.cursorStyle.parentNode) {
                g.cursorStyle.parentNode.removeChild(g.cursorStyle)
            }
            if (restorePopup) {
                setTimeout(() => {
                    this.infoPopupEditable = true
                }, 0)
            }
            return true
        },
        onMouseDown(event) {
            //新手勢開始前先收掉上一次殘留者(如上次mouseup落在視窗外未送達document), 避免監聽器疊加
            this.endMouseGesture()
            //點設定齒輪(及其popup錨區)不啟動節點拖曳/點擊: 齒輪刻意不用@mousedown.stop(stopPropagation會擋掉window層WPopup互斥協調),
            //故於此明確排除, 使點齒輪只開設定popup、不移動節點座標(避免尚未變更設定就先改到座標→誤觸發變更儲存)
            if (event.target.closest && event.target.closest('.vue-flow__node-settings-anchor')) {
                this._mouseDownPos = null
                return
            }
            //非主鍵(右鍵/中鍵)不啟動拖曳與點擊: 判準對齊畫布平移之onCanvasMouseDown(event.button === 0),
            //使同套件內「按下開始拖動」採同一套判準; contextmenu走@contextmenu.stop另一條路徑不受影響
            if (event.button !== 0) {
                this._mouseDownPos = null
                return
            }
            this._mouseDownPos = { x: event.clientX, y: event.clientY }
            if (!this.draggable) return
            if (this.node.dragHandle) {
                const handle = event.target.closest(this.node.dragHandle)
                if (!handle) return
            }
            //互動元素與明確opt-out區域(.vue-flow__nodrag): 不武裝拖曳手勢, 保留原生行為(輸入聚焦/點連結/選字);
            //點擊仍經onMouseUp發node-click, 選取不受影響
            //why: 若只免除下方preventDefault而仍武裝手勢, 於輸入框內選字移動超過2px門檻會連節點一起拖走
            if (event.target.closest && event.target.closest('input, textarea, select, button, a[href], label, [contenteditable=""], [contenteditable="true"], .vue-flow__nodrag')) {
                return
            }
            //節點面上拖曳=移動節點: 阻止原生預設行為(形成文字選取/自既有選取啟動原生drag)
            //why: 宿主節點內容若可選字(user-select:text), 拖曳中會形成選取且殘留; 之後mousedown落在選取上
            //     即啟動原生文字層drag接管事件流, mousemove斷流使節點於門檻跨越後凍結
            //     (真瀏覽器實測: mousemove 11→2次, dragstart=1, 節點僅移8px後卡住)
            event.preventDefault()
            this.infoPopupShow = false
            //選取仍於mousedown完成(與修正前一致): 拖曳延後但選取不可延後,
            //否則按住節點未移動時, 原本立即出現的選取回饋會拖到mouseup才出現
            this.$emit('drag-prepare', { node: this.node, event })
            const startX = event.clientX
            const startY = event.clientY
            const gesture = { crossed: false, onDragMove: null, onDragEnd: null }
            gesture.onDragMove = (e) => {
                //mouseup落在視窗外時不會送達document, 監聽器會殘留;
                //此處確認主鍵仍按著, 否則於無按鍵狀態下跨門檻會誤啟動拖曳(幽靈拖曳)
                if ((e.buttons & 1) === 0) {
                    this.endMouseGesture()
                    return
                }
                if (gesture.crossed) return
                if (Math.abs(e.clientX - startX) > 2 || Math.abs(e.clientY - startY) > 2) {
                    gesture.crossed = true
                    this.infoPopupEditable = false
                    //拖曳延後至跨越位移門檻才啟動
                    //why: 若於mousedown即emit drag-start, 無位移之純點擊於mouseup仍會走endDrag→回寫座標→emit update:nodes,
                    //     宿主收到未變更之全量節點而誤判有未儲存變更
                    //event傳原始mousedown事件, 使WFlowVue之dragStartPos取按下當下座標(改傳本次mousemove會少算門檻位移);
                    //moveEvent供WFlowVue於啟動當下立即補跑一次doDrag, 否則跨門檻後立刻放開會完全沒有位移
                    this.$emit('drag-start', { node: this.node, event, moveEvent: e })
                }
                //刻意不移除mousemove: 後續仍需靠它做buttons清理, crossed旗標已保證不會重複啟動
            }
            gesture.onDragEnd = () => {
                this.endMouseGesture()
            }
            this._mouseGesture = gesture
            document.addEventListener('mousemove', gesture.onDragMove)
            document.addEventListener('mouseup', gesture.onDragEnd)
            //視窗失焦後收不到mouseup, 本地監聽與popup態同樣需收尾(WFlowVue之onWindowBlur只收父層狀態)
            window.addEventListener('blur', gesture.onDragEnd)
        },
        //點齒輪=元素專屬操作: 該節點成為唯一active(掛@click之時序理由見模板註解)
        onSettingsAnchorClick(event) {
            this.$emit('node-activate', { node: this.node, event })
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
        //資訊popup之開關請求由本元件裁決(WPopup之isolated為預設false, 故trigger點擊只是$emit請求, 實際狀態由v-model擁有者決定)
        //why: 多選鍵生效時點擊之語義為複選, 不應同時彈出資訊卡遮擋畫面並干擾連續點選;
        //     判準用multiSelectActive而非「鍵被按下」——選取不可用時(鎖定/檢視模式)該鍵無複選語義, 點擊仍應照常開popup;
        //     關閉請求一律放行, 且不可改用editable抑制——editable會連evHide與外部點擊關閉一併擋掉, 使已開之popup關不掉
        onInfoPopupInput(val) {
            if (val && this.getMultiSelectActive()) {
                return
            }
            this.infoPopupShow = val
        },
        //設定popup之開關同樣由本元件裁決(複選模式中拒開; 關閉請求一律放行)
        onSettingsPopupInput(val) {
            if (val && this.getMultiSelectActive()) {
                return
            }
            this.settingsPopupShow = val
        },
        //宿主API入口同樣gating: 複選模式中程式化開啟亦拒絕(回傳false供呼叫端判斷)
        openInfoPopup() {
            if (this.getMultiSelectActive()) return false
            this.infoPopupShow = true
            return true
        },
        //手勢武裝中阻止原生HTML5 drag(拖曳選取文字/圖片/連結): 原生drag一旦接管, mousemove事件流被drag事件流取代;
        //未武裝時(齒輪/nodrag區/非主鍵/未按下)不干涉, 宿主自訂拖放不受影響
        onNativeDragStart(event) {
            if (this._mouseGesture) {
                event.preventDefault()
            }
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
        //批次將固定錨點改回 Auto(end: 'source'=出邊之fromPosition, 'target'=入邊之toPosition)
        onUnfixAnchors(end) {
            this.$emit('node-anchors-unfix', { node: this.node, end })
        },
        onSettingsDelete() {
            this.$emit('node-settings-delete', { node: this.node })
        },
        onResizeStart(event, edge) {
            //複選模式中不啟動縮放(把手已隱藏, 縱深第二層; 守衛先於任何emit/preventDefault/樣式建立)
            if (this.getMultiSelectActive()) return
            //縮放=元素專屬操作: 該節點成為唯一active(elementsSelectable守衛在WFlowVue.onNodeActivate)
            this.$emit('node-activate', { node: this.node, event })
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

                //closure追蹤縮放最終值供resize-end發送
                //why: 縮放中node本體不變動(ghost僅作用於視覺), this.node.*是原值, 不可作為結果
                lastW = newW
                lastH = newH
                lastX = newX
                lastY = newY

                this.$emit('node-resize', {
                    nodeId: this.node.id,
                    width: newW,
                    height: newH,
                    x: newX,
                    y: newY,
                })
            }

            let lastW = startW
            let lastH = startH
            let lastX = startPosX
            let lastY = startPosY

            const onMouseUp = () => {
                if (!this.endResizeGesture()) return
                this.$emit('node-resize-end', {
                    nodeId: this.node.id,
                    width: lastW,
                    height: lastH,
                    x: lastX,
                    y: lastY,
                })
            }

            this._resizeGesture = { onMouseMove, onMouseUp, cursorStyle }
            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
            //視窗失焦後收不到mouseup, 全域游標樣式與監聽器同樣需收尾
            window.addEventListener('blur', onMouseUp)
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
/* 拖曳中僅改變游標, 刻意不提升z-index: 節點層級由node.zIndex/node.style決定(見:163),
   固定的1000 !important會把自訂較高層級之節點反向降級, 且1000亦壓不過另一顆自訂5000之節點,
   故不提供[拖曳置頂], 疊放順序維持既有規則 */
.vue-flow__node--dragging {
  cursor: grabbing;
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
/* polygon/ellipse live inside the NodeFace child component, so ::v-deep is
   required — a plain scoped selector would pin this component's data-v
   attribute onto the child's inner elements and never match. */
.vue-flow__node--diamond:hover ::v-deep .vue-flow__shape-svg polygon,
.vue-flow__node--triangle:hover ::v-deep .vue-flow__shape-svg polygon,
.vue-flow__node--ellipse:hover ::v-deep .vue-flow__shape-svg ellipse {
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.15));
}
/* SVG shape selected: red shadow */
.vue-flow__node--diamond.vue-flow__node--selected ::v-deep .vue-flow__shape-svg polygon,
.vue-flow__node--triangle.vue-flow__node--selected ::v-deep .vue-flow__shape-svg polygon,
.vue-flow__node--ellipse.vue-flow__node--selected ::v-deep .vue-flow__shape-svg ellipse {
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
