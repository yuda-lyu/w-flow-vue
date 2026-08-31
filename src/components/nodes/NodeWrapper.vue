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
    @click="onRootClick"
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
          :def-node="dn"
          :shape="shape"
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
    <!-- 齒輪錨區: hover 模式=移入顯示齒輪, 點齒輪開設定; click/dblclick 模式=不顯示齒輪, 該動作直接開設定 popup
         (錨區仍於 popup 開啟時渲染供 WPopup 定位, 但齒輪 icon 以 --silent 隱藏) -->
    <div v-if="(gearVisible || settingsPopupShow) && draggable && !locked && settingsEnabled" class="vue-flow__node-settings-anchor" :class="{ 'vue-flow__node-settings-anchor--silent': settingsTrigger !== 'hover' }" @click="onSettingsAnchorClick">
      <!-- 受控而非v-model: 開啟請求須經onSettingsPopupInput裁決(複選模式中拒開);
           WPopup非isolated, trigger點擊只是$emit請求, @show跟隨實際開啟故拒開時不會幽靈emit。
           paddingStyle 歸零: 設定表單之內距由 ui/settingsForm.css 掌管, 使群標題列能 full-bleed 貼齊 popup
           左右邊緣; popup 若自帶水平 padding, 標題底色會成為浮在中間的色塊而非分區用的 section header -->
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
        :paddingStyle="{v:0,h:0}"
        @show="$emit('node-settings-click', { node: node })"
      >
        <template v-slot:trigger>
          <div class="vue-flow__node-settings">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
              <path :d="gearPath" transform="translate(0 3)"/>
            </svg>
          </div>
        </template>
        <template v-slot:content>
          <NodeSettingsForm
            :node="node"
            :def-node="dn"
            :text-font-size="settingsPopupTextFontSize"
            :max-height="settingsPopupMaxHeight"
            :background-color="settingsPopupBackgroundColor"
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
import SlotOutlet from '../ui/SlotOutlet.vue'
import WPopup from 'w-component-vue/src/components/WPopup.vue'
import { classifyHit, isAffordanceHit } from '../../js/hitTest.mjs'
import { resolveNodeSize, computeResize } from '../../js/geometry.mjs'
import elementPopups from '../mixins/elementPopups.mjs'
import { GEAR_PATH } from '../../js/icons.mjs'
import { startDocumentGesture, crossedThreshold, gestureBlockedReason } from '../../js/domGesture.mjs'
import { nodeShape, isTriangleShape } from '../../js/nodeStyle.mjs'


export default {
    name: 'NodeWrapper',
    components: { NodeBody, NodeSettingsForm, SlotOutlet, WPopup },
    //popup 狀態機(資訊/設定互斥、複選關閉、開啟閘門、設定入口三模式)共用 mixin
    mixins: [elementPopups],
    inject: {
        getDragGhost: { default: () => () => null },
        //視口縮放(client 位移 → 畫布位移換算; 高頻手勢狀態走 getter)
        getViewportZoom: { default: () => () => 1 },
        //進行中手勢(一次一手勢, spec/流程_互動契約.md §5): 有手勢時不啟動縮放/拖曳
        getActiveGesture: { default: () => () => null },
    },
    props: {
        node: { type: Object, required: true },
        //節點預設(opt.defNode*): 低頻配置 props 下傳, 算一次 shape/dn 再往下傳
        defNode: { type: Object, default: () => ({}) },
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
        settingsPopupMaxHeight: { type: String, default: '400px' },
        inforPopupBackgroundColor: { type: String, default: '#fff' },
        inforPopupTitleTextColor: { type: String, default: '#333' },
        inforPopupTitleTextFontSize: { type: String, default: '12px' },
        inforPopupDescriptionTextColor: { type: String, default: '#888' },
        inforPopupDescriptionTextFontSize: { type: String, default: '10px' },
        snapGridSize: { type: Number, default: null },
        settingsEnabled: { type: Boolean, default: true },
        //設定入口方式: 'hover'(移入顯示齒輪, 點齒輪開設定) | 'click' | 'dblclick'(該動作直接開設定 popup, 不顯示齒輪)
        settingsTrigger: { type: String, default: 'dblclick' },
        settingsExcludes: { type: Array, default: () => [] },
    },
    computed: {
        dn() {
            return this.defNode
        },
        //有效形狀(nodeStyle.nodeShape 單一解析; 與節點面/把手/邊端點同一基準)
        shape() {
            return nodeShape(this.node, this.dn)
        },
        isDiamond() {
            return this.shape === 'diamond'
        },
        isEllipse() {
            return this.shape === 'ellipse'
        },
        isTriangle() {
            return isTriangleShape(this.shape)
        },
        isSvgShape() {
            return this.isDiamond || this.isEllipse || this.isTriangle
        },
        //設定 popup 之可互動旗標(elementPopups.canOpenSettings): 節點以 draggable 為準
        settingsInteractive() {
            return this.draggable
        },
        gearPath() {
            return GEAR_PATH
        },
        classes() {
            const nodeClasses = this.node.class
                ? (Array.isArray(this.node.class) ? this.node.class : [this.node.class])
                : []
            return [
                'vue-flow__node',
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
            //佈局尺寸: ghost > 節點明確尺寸 > defNode(opt.defNodeWidth/Height); 實測值不回寫為佈局來源(resolveNodeSize live=null)
            const declared = resolveNodeSize(n, null, d)
            const w = (g && g.width !== undefined) ? g.width : (n.width || declared.width)
            const h = (g && g.height !== undefined) ? g.height : (n.height || declared.height)
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
            //外框色/寬亦以 CSS 變數供選取態使用(選取態外框加粗 1px: 矩形以 box-shadow ring 外加, 不改 border 以免 padding box 位移使把手漂移;
            //SVG 形狀以 stroke-width 加 1px)
            let eColor = n.edgeColor || d.edgeColor
            let eWidth = n.edgeWidth !== undefined ? n.edgeWidth : d.edgeWidth
            if (eColor) style['--vf-node-edge'] = eColor
            style['--vf-node-ew'] = (eWidth !== undefined ? eWidth : 1) + 'px'
            if (!this.isSvgShape) {
                let fColor = n.faceColor || d.faceColor
                if (fColor) style.background = fColor
                if (eColor) style.borderColor = eColor
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
            //實測尺寸快取初值 null: 首次量測即使為 0×0 亦回報一次(初始尺寸 barrier 需要每個節點皆回報)
            cachedW: null,
            cachedH: null,
        }
    },
    watch: {
        //上鎖切換(契約 §5): 本節點持有之 document 手勢(拖曳追蹤/縮放)取消提交——縮放經 node-resize-cancel 通知 WFlowVue 清手勢與 ghost
        locked(val) {
            if (val) this.cancelLocalGestures()
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
        this.cancelLocalGestures()
    },
    methods: {
        //本節點持有之 document 手勢一併取消(destroy / 上鎖共用): 縮放不提交(node-resize-cancel)
        cancelLocalGestures() {
            this.endMouseGesture(false)
            this.endResizeGesture(false)
        },
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
            g.dispose()
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
            g.dispose()
            if (restorePopup) {
                setTimeout(() => {
                    this.infoPopupEditable = true
                }, 0)
            }
            else {
                //非正常路徑(銷毀/被新手勢取代)收尾: 通知 WFlowVue 清 activeGesture 與 ghost, 不提交尺寸
                this.$emit('node-resize-cancel', { nodeId: this.node.id })
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
            //一次一手勢: 他手勢進行中(如另一節點之縮放尚未收尾)不再啟動選取/拖曳
            if (this.getActiveGesture()) {
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
            let crossed = false
            //document 層手勢(domGesture): mouseup / blur / buttons-lost(視窗外放開)皆同一收尾;
            //拖曳提交與否由 WFlowVue 之 document 監聽決定, 此處只管本地手勢與 popup 態
            this._mouseGesture = startDocumentGesture({
                onMove: (e) => {
                    if (crossed) return
                    if (crossedThreshold(startX, startY, e.clientX, e.clientY)) {
                        crossed = true
                        this.infoPopupEditable = false
                        //拖曳延後至跨越位移門檻才啟動
                        //why: 若於mousedown即emit drag-start, 無位移之純點擊於mouseup仍會走endDrag→回寫座標→emit update:nodes,
                        //     宿主收到未變更之全量節點而誤判有未儲存變更
                        //event傳原始mousedown事件, 使WFlowVue之dragStartPos取按下當下座標(改傳本次mousemove會少算門檻位移);
                        //moveEvent供WFlowVue於啟動當下立即補跑一次doDrag, 否則跨門檻後立刻放開會完全沒有位移
                        this.$emit('drag-start', { node: this.node, event, moveEvent: e })
                    }
                },
                onEnd: () => this.endMouseGesture(),
            })
        },
        //點齒輪=元素專屬操作: 該節點成為唯一active(掛@click之時序理由見模板註解)
        onSettingsAnchorClick(event) {
            this.emitActivate(event)
        },
        onMouseUp(event) {
            if (!this._mouseDownPos) return
            const dx = event.clientX - this._mouseDownPos.x
            const dy = event.clientY - this._mouseDownPos.y
            this._mouseDownPos = null
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
                //click 模式: 點擊節點本體直接開設定 popup——於 click 事件(document mouseup 之後)開啟,
                //此刻 mousedown 武裝之拖曳手勢已收尾(popup 閘門於手勢中拒開; 節點 mouseup 先於 document mouseup 觸發)
                if (this.settingsTrigger === 'click') this._settingsClickPending = true
                this.$emit('node-click', { node: this.node, event })
            }
        },
        onRootClick(event) {
            if (!this._settingsClickPending) return
            this._settingsClickPending = false
            if (this.isAffordanceEvent(event)) return
            this.openSettingsPopup(event)
        },
        //affordance(齒輪/四角/把手)上的雙擊/右鍵不代表節點(spec §3): 與 EdgeWrapper 之 isGestureTarget 對稱
        //(修正前: root 之 @dblclick/@contextmenu 無條件接收後代事件, 雙擊齒輪發 node-double-click、右鍵把手發 node-context-menu, 實測已重現)
        isAffordanceEvent(event) {
            return isAffordanceHit(classifyHit(event && event.target, this.$el))
        },
        onDoubleClick(event) {
            if (this.isAffordanceEvent(event)) return
            //dblclick 模式: 雙擊節點本體直接開設定 popup; 取消單擊排定之資訊 popup(不閃現)
            if (this.settingsTrigger === 'dblclick') {
                this.cancelPendingInfo()
                this.openSettingsPopup(event)
            }
            this.$emit('node-double-click', { node: this.node, event })
        },
        //直接開設定/點齒輪/縮放: 本節點成為唯一 active(elementPopups.openSettingsPopup 亦經此發出)
        emitActivate(event) {
            this.$emit('node-activate', { node: this.node, event })
        },
        //手勢武裝中阻止原生HTML5 drag(拖曳選取文字/圖片/連結): 原生drag一旦接管, mousemove事件流被drag事件流取代;
        //未武裝時(齒輪/nodrag區/非主鍵/未按下)不干涉, 宿主自訂拖放不受影響
        onNativeDragStart(event) {
            if (this._mouseGesture) {
                event.preventDefault()
            }
        },
        onContextMenu(event) {
            if (this.isAffordanceEvent(event)) return
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
            //刪除「請求」(內部通道, 由 WFlowVue.runDelete 裁決與提交; 對宿主之完成事件只有 elements-deleted)
            this.$emit('node-delete-request', { node: this.node })
        },
        onResizeStart(event, edge) {
            //啟動守衛(domGesture.gestureBlockedReason): 複選模式 / 進行中手勢不啟動(主鍵判準在 NodeBody 之 DOM 入口); 守衛先於任何 emit/preventDefault/樣式建立
            if (gestureBlockedReason({ multiSelectActive: this.getMultiSelectActive(), activeGesture: this.getActiveGesture() })) return
            //新手勢開始前先收掉上一次殘留者(視窗外放開未送達 mouseup 時), 避免監聽器與全域游標樣式疊加
            this.endResizeGesture(false)
            //縮放=元素專屬操作: 該節點成為唯一active(elementsSelectable守衛在WFlowVue.onNodeActivate)
            this.$emit('node-activate', { node: this.node, event })
            //手勢生命週期上報(WFlowVue 據此設 activeGesture / 關閉全部 popup / 標記擁有者)
            this.$emit('resize-start', { node: this.node, event, el: this.$el })
            this.infoPopupShow = false
            this.$nextTick(() => {
                this.infoPopupEditable = false
            })
            event.preventDefault()

            const cursorMap = {
                'top-left': 'nwse-resize',
                'bottom-right': 'nwse-resize',
                'top-right': 'nesw-resize',
                'bottom-left': 'nesw-resize',
            }
            const startX = event.clientX
            const startY = event.clientY
            const start = {
                x: this.node.position.x,
                y: this.node.position.y,
                width: this.node.width || this.$el.offsetWidth,
                height: this.node.height || this.$el.offsetHeight,
            }
            const snap = this.snapGridSize
            const zoom = this.getViewportZoom() || 1
            //closure追蹤縮放最終值供resize-end發送
            //why: 縮放中node本體不變動(ghost僅作用於視覺), this.node.*是原值, 不可作為結果
            let last = { ...start }
            //document 層手勢(domGesture): 期間鎖定整頁游標; mouseup / blur / buttons-lost 皆以最後 ghost 提交(同一收尾)
            this._resizeGesture = startDocumentGesture({
                cursor: cursorMap[edge] || 'default',
                onMove: (e) => {
                    last = computeResize(edge, start, { dx: (e.clientX - startX) / zoom, dy: (e.clientY - startY) / zoom }, { snap, minSize: snap || 10 })
                    this.$emit('node-resize', { nodeId: this.node.id, ...last })
                },
                onEnd: () => {
                    if (!this.endResizeGesture()) return
                    this.$emit('node-resize-end', { nodeId: this.node.id, ...last })
                },
            })
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
/* 選取態: 外框加粗 1px(box-shadow ring, 顏色同外框; 不改 border 以免版面/把手位移)+ 淡光暈 rgba(0,0,0,0.1) */
.vue-flow__node--selected,
.vue-flow__node--selected:hover {
  box-shadow: 0 0 0 1px var(--vf-node-edge, #bbb), 0 0 8px 2px rgba(0, 0, 0, 0.1);
}
/* 拖曳中僅改變游標, 刻意不提升z-index: 節點層級由node.zIndex/node.style決定(見:163),
   固定的1000 !important會把自訂較高層級之節點反向降級, 且1000亦壓不過另一顆自訂5000之節點,
   故不提供[拖曳置頂], 疊放順序維持既有規則 */
.vue-flow__node--dragging {
  cursor: grabbing;
}

/* Settings icon anchor (positioning only) */
/* click/dblclick 模式: 錨區只供 popup 定位, 齒輪 icon 不可見亦不可點 */
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


/* Shared SVG shape base styles: 外框由 SVG stroke 繪製, 容器 border 為 0(非透明 1px)——
   使 padding box 與外框盒重合, 形狀 stroke、把手圓心、連線端點同以外框盒為基準(見 nodeStyle.nodeBorderWidth) */
.vue-flow__node--diamond,
.vue-flow__node--ellipse,
.vue-flow__node--triangle {
  background: transparent !important;
  border-width: 0 !important;
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
/* SVG 形狀外框之選取/hover 過場(stroke 加粗與光暈漸變, 與矩形 box-shadow 0.3s 一致) */
.vue-flow__node ::v-deep .vue-flow__shape-svg polygon,
.vue-flow__node ::v-deep .vue-flow__shape-svg ellipse {
  transition: stroke-width 0.2s ease, filter 0.3s ease;
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
/* SVG shape selected: 外框 stroke 加粗 1px + 淡光暈 rgba(0,0,0,0.1)(與矩形同一語義) */
.vue-flow__node--diamond.vue-flow__node--selected ::v-deep .vue-flow__shape-svg polygon,
.vue-flow__node--triangle.vue-flow__node--selected ::v-deep .vue-flow__shape-svg polygon,
.vue-flow__node--ellipse.vue-flow__node--selected ::v-deep .vue-flow__shape-svg ellipse {
  stroke-width: calc(var(--vf-node-ew, 1px) + 1px);
  filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.1));
}
/* Fade transition for settings icon and resize handles */
</style>
