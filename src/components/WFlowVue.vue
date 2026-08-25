<template>
  <!-- data-flow-id: 建線 DOM adapter 之 flow 歸屬檢查錨點(頁面可能有多個 flow 實例);
       vue-flow--connecting: 建線期間之根 class, 靜態 CSS 據此切換游標/把手三態/齒輪縮放把手隱藏
       (取代原 document.head 注入全域樣式——全域 * 選擇器會污染整頁與其他 flow 實例) -->
  <div
    :style="`width:${widthInp}px; height:${heightInp}px;`"
    :data-flow-id="flowId"
    :class="{ 'vue-flow--connecting': isConnecting, 'vue-flow--multiselecting': multiSelectMode }"
  >
  <FlowCanvas
    v-if="inited"
    ref="canvas"
    @canvas-mousedown="onCanvasMouseDown"
    @canvas-mousemove="onCanvasMouseMove"
    @canvas-mouseup="onCanvasMouseUp"
    @canvas-wheel="onCanvasWheel"
    @canvas-dblclick="onCanvasDblClick"
    @canvas-click="onCanvasClick"
    @canvas-contextmenu="onCanvasContextMenu"
  >
    <BackgroundLayer
      :variant="platformBackgroundPatternType"
      :gap="platformBackgroundPatternGap"
      :size="platformBackgroundPatternSize"
      :pattern-color="platformBackgroundPatternColor"
      :bg-color="platformBackgroundColor"
      :viewport="viewport"
    />

    <ViewportTransform
      :viewport="viewport"
    >
      <EdgeRenderer
        ref="edgeRenderer"
        :conns="conns"
        :nodes="nodes"
        :node-internals="nodeInternals"
        :selected-conn-ids="selectedConns"
        :popup-slot-fn="$scopedSlots['conn-popup'] || null"
        :interactive="elementsSelectable"
        :locked="locked"
        :settings-popup-background-color="settingsPopupBackgroundColor"
        :settings-popup-text-color="settingsPopupTextColor"
        :settings-popup-text-font-size="settingsPopupTextFontSize"
        :infor-popup-background-color="inforPopupBackgroundColor"
        :infor-popup-title-text-color="inforPopupTitleTextColor"
        :infor-popup-title-text-font-size="inforPopupTitleTextFontSize"
        :infor-popup-description-text-color="inforPopupDescriptionTextColor"
        :infor-popup-description-text-font-size="inforPopupDescriptionTextFontSize"
        :settings-enabled="connsSettingsEnabled"
        :settings-excludes="connsSettingsExcludes"
        @conn-click="onConnClick"
        @conn-double-click="onConnDoubleClick"
        @conn-context-menu="onConnContextMenu"
        @conn-mouseenter="onConnMouseEnter"
        @conn-mouseleave="onConnMouseLeave"
        @conn-settings-click="onConnSettingsClick"
        @conn-settings-update="onConnSettingsUpdate"
        @conn-settings-delete="onConnSettingsDelete"
        @conn-activate="onConnActivate"
      />

      <NodeRenderer
        ref="nodeRenderer"
        :nodes="nodes"
        :selected-node-ids="selectedNodes"
        :dragging-node-map="isDraggingNode ? dragNodeStartPositions : null"
        :popup-slot-fn="$scopedSlots['node-popup'] || null"
        :nodes-draggable="nodesDraggable"
        :nodes-connectable="nodesConnectable"
        :locked="locked"
        :nodes-resizable="nodesResizable"
        :settings-popup-background-color="settingsPopupBackgroundColor"
        :settings-popup-text-color="settingsPopupTextColor"
        :settings-popup-text-font-size="settingsPopupTextFontSize"
        :infor-popup-background-color="inforPopupBackgroundColor"
        :infor-popup-title-text-color="inforPopupTitleTextColor"
        :infor-popup-title-text-font-size="inforPopupTitleTextFontSize"
        :infor-popup-description-text-color="inforPopupDescriptionTextColor"
        :infor-popup-description-text-font-size="inforPopupDescriptionTextFontSize"
        :snap-grid-size="snapToGrid ? snapGridSize : null"
        :settings-enabled="nodesSettingsEnabled"
        :settings-excludes="nodesSettingsExcludes"
        @drag-prepare="onNodeDragPrepare"
        @drag-start="onNodeDragStart"
        @node-click="onNodeClick"
        @node-double-click="onNodeDoubleClick"
        @node-context-menu="onNodeContextMenu"
        @node-settings-click="onNodeSettingsClick"
        @node-settings-update="onNodeSettingsUpdate"
        @node-settings-delete="onNodeSettingsDelete"
        @node-mouseenter="onNodeMouseEnter"
        @node-mouseleave="onNodeMouseLeave"
        @connect-start="onConnectStart"
        @dimensions="onNodeDimensions"
        @node-resize="onNodeResize"
        @node-resize-end="onNodeResizeEnd"
        @node-activate="onNodeActivate"
        @node-anchors-unfix="onNodeAnchorsUnfix"
      />

      <ConnectionLine
        :state="connectionVisual"
        :type="defConnCreatingType"
        :line-style="defConnCreatingStyle"
      />

      <slot name="viewport-overlay" />
    </ViewportTransform>

    <SelectionBox :state="selectionVisual" />

    <Controls
      :locked="locked"
      :menu="menuInp"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @fit-view="fitView"
      @toggle-interactive="toggleInteractive"
    />

  </FlowCanvas>
  </div>
</template>

<script>
import FlowCanvas from './canvas/FlowCanvas.vue'
import ViewportTransform from './canvas/ViewportTransform.vue'
import BackgroundLayer from './canvas/BackgroundLayer.vue'
import SelectionBox from './canvas/SelectionBox.vue'
import NodeRenderer from './nodes/NodeRenderer.vue'
import EdgeRenderer from './edges/EdgeRenderer.vue'
import ConnectionLine from './edges/ConnectionLine.vue'
import Controls from './ui/Controls.vue'
import { getHandlePosition, getOverlappingNodes, snapPosition, clampPosition } from '../js/geometry'
import { clearStepCache } from '../js/edgePath'
import { generateId } from '../js/graph'
import { assessConnection } from '../js/connectPolicy.mjs'
import { findHandleElAt, describeHandleEndpoint, setHandleConnectStatus, setHandleConnectRole } from '../js/handleDom.mjs'
import { NODE_DEFAULTS, CONN_DEFAULTS } from '../js/defaults'

/**
 * WFlowVue — Vue 2 flow/graph editor component.
 *
 * All configuration is passed via the `opt` prop object.
 *
 * @prop {Object} opt
 *
 * ─── Canvas ────────────────────────────────────────────────────────────
 * @prop {number}   [opt.width=800]                       Canvas width (px)
 * @prop {number}   [opt.height=600]                      Canvas height (px)
 * @prop {Array}    [opt.nodes=[]]                        Node data array
 * @prop {Array}    [opt.conns=[]]                        Connection data array
 *
 * ─── Interaction ───────────────────────────────────────────────────────
 * @prop {boolean}  [opt.nodesDraggable=true]             Allow node dragging
 * @prop {boolean}  [opt.nodesConnectable=true]           Allow creating connections
 * @prop {boolean}  [opt.nodesResizable=true]            Allow resizing nodes (per-node override: node.resizable)
 * @prop {boolean}  [opt.elementsSelectable=true]         Allow selecting nodes/conns
 * @prop {boolean}  [opt.locked=false]                    Initial interactive-lock state (afterwards toggled via Controls lock button, emits toggle-interactive)
 * @prop {boolean}  [opt.nodesSettingsEnabled=true]       Show built-in node settings popup (gear icon)
 * @prop {boolean}  [opt.connsSettingsEnabled=true]       Show built-in connection settings popup (gear icon)
 * @prop {Array}    [opt.nodesSettingsExcludes=[]]        Field keys hidden in node settings form (e.g. ['name','description'])
 * @prop {Array}    [opt.connsSettingsExcludes=[]]        Field keys hidden in connection settings form
 * @prop {boolean}  [opt.selectNodesOnDrag=true]          Select node when drag starts
 * @prop {boolean}  [opt.deleteKeyEnabled=false]           Enable keyboard deletion of selected elements
 * @prop {string}   [opt.deleteKeyCode='Backspace']       Key to delete selected elements (requires deleteKeyEnabled)
 * @prop {boolean}  [opt.multiSelectEnabled=true]          Enable multi-selection (box select + Shift+Click)
 * @prop {string}   [opt.boxSelectionKeyCode='Shift']     Key to hold for box selection (drag on canvas)
 * @prop {string}   [opt.multiSelectionKeyCode='Shift']   Key to hold for Shift+Click add/remove selection
 *
 * ─── Multi-select mode(複選模式契約)───
 * multiSelectionKey 按住(且 multiSelectEnabled、elementsSelectable、未鎖定)期間為「複選模式」:
 * - 統一隱藏所有元素專屬操作 affordance: 節點設定齒輪/四角縮放把手/連出入把手/邊設定齒輪/邊轉折點;
 *   模式中不得啟動建線/縮放/轉折點拖曳, 亦不得開啟任何 popup; 已開之資訊/設定 popup 於進入模式時關閉。
 * - 節點本體點擊 = toggle 加入/移除選取(不清除既有連線選取——連線不參與複選, 點邊不變更選取)。
 * - 拖曳/框選/平移/縮放畫布/Delete/工具列不受模式影響; dblclick 因兩次 click 而 toggle 兩次(淨零)後照發事件。
 * - 手勢優先序: 建線進行中按住複選鍵, 建線續行且落點把手不隱藏; 進行中之縮放/拖曳手勢照常完成。
 * - 鍵盤作用域: 於 input/textarea/select/contenteditable 內按鍵不觸發畫布快捷鍵(含複選鍵與 Delete);
 *   同頁多個 flow 實例監聽同一 document, 按住複選鍵時各實例同時進入模式(全域行為, 刻意)。
 * @prop {boolean}  [opt.zoomOnScroll=true]               Zoom with mouse wheel
 * @prop {number}   [opt.zoom=1]                  Initial viewport zoom level
 * @prop {number}   [opt.zoomMin=0.5]                     Minimum zoom level (fitView may go below it; wheel zoom then keeps the current level as its lower bound instead of jumping back)
 * @prop {number}   [opt.zoomMax=2]                       Maximum zoom level
 * @prop {Array}    [opt.center=[0,0]]            Initial viewport center [x, y]
 * @prop {boolean}  [opt.panOnDrag=true]                  Pan canvas by dragging background
 * @prop {Array}    [opt.panLimits=null]                  Pan limits [[minX,minY],[maxX,maxY]]
 * @prop {boolean}  [opt.snapToGrid=false]                Snap node positions to grid
 * @prop {number}   [opt.snapGridSize=20]                  Grid cell size (px, used for both drag snap and resize snap)
 *
 * Anchor contract (Auto/Fixed): an edge end is Fixed when the conn itself carries
 * `fromPosition`/`toPosition` (set via the conn settings form, or by dragging from an extra
 * fixed handle) — it then always wins. Otherwise the end is Auto and follows
 * node.toPosition/fromPosition → defNodeToPosition/defNodeFromPosition → built-in bottom/top.
 * Dragging from a node's default handle creates an Auto edge (no position is persisted), so
 * changing the node's To/From Handle re-routes all its Auto edges. Fixed anchors are shown in
 * the node settings form with a batch "改為 Auto" action; the conn form's Auto option clears one.
 *
 * Node-surface input contract: dragging on a node moves the node — text selection and native
 * HTML5 drag are suppressed there (a formed selection would let the browser's text-layer drag
 * take over the gesture and freeze the node). Interactive elements (input/textarea/select/button/
 * a[href]/label/contenteditable) and any region marked with the `vue-flow__nodrag` class opt out:
 * native behavior (focus/click/text selection) is preserved and node dragging never starts there.
 *
 * ─── Platform ────────────────────────────────────────────────────────
 * @prop {string}   [opt.platformBackgroundPatternType='dots']        Background pattern: 'dots' | 'lines' | 'cross'
 * @prop {number}   [opt.platformBackgroundPatternGap=20]                Pattern spacing (px)
 * @prop {number}   [opt.platformBackgroundPatternSize=1]                Pattern element size
 * @prop {string}   [opt.platformBackgroundPatternColor='#81818a'] Pattern color
 * @prop {string}   [opt.platformBackgroundColor='#fff']          Canvas background color
 *
 * ─── Menu ──────────────────────────────────────────────────────────────
 * Top-left toolbar. Every option is opt-in: omit them all and the toolbar is identical to before.
 * Any value of the wrong type (or an empty string) falls back to the default listed here.
 * @prop {boolean}  [opt.useMenu=true]                    Show the whole toolbar
 * @prop {string}   [opt.menuPosition='top-left']         Toolbar corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
 * @prop {number}   [opt.menuYShift=0]                    Toolbar vertical shift (px); positive moves it away from its anchored edge (down for top-*, up for bottom-*)
 * @prop {boolean}  [opt.useSetting=true]                 Initial expanded state (afterwards toggled via the gear button)
 * @prop {string}   [opt.menuSettingIcon=mdiCogOutline]   Gear (collapse/expand) button icon, SVG path string
 * @prop {string}   [opt.menuSettingTooltip='Settings']   Gear button tooltip
 * @prop {boolean}  [opt.useMenuItemZoomIn=true]          Show zoom-in button
 * @prop {string}   [opt.menuZoomInIcon=mdiMagnifyPlusOutline]   Zoom-in icon, SVG path string
 * @prop {string}   [opt.menuZoomInTooltip='Zoom In']     Zoom-in tooltip
 * @prop {boolean}  [opt.useMenuItemZoomOut=true]         Show zoom-out button
 * @prop {string}   [opt.menuZoomOutIcon=mdiMagnifyMinusOutline] Zoom-out icon, SVG path string
 * @prop {string}   [opt.menuZoomOutTooltip='Zoom Out']   Zoom-out tooltip
 * @prop {boolean}  [opt.useMenuItemFitView=true]         Show fit-view button
 * @prop {string}   [opt.menuFitViewIcon=mdiFitToPageOutline]    Fit-view icon, SVG path string
 * @prop {string}   [opt.menuFitViewTooltip='Fit View']   Fit-view tooltip
 * @prop {boolean}  [opt.useMenuItemLock=true]            Show lock button
 * @prop {string}   [opt.menuLockIcon=mdiLockOpenVariantOutline] Lock button icon while unlocked
 * @prop {string}   [opt.menuLockTooltip='Lock']          Lock button tooltip while unlocked (names the action the click performs)
 * @prop {string}   [opt.menuLockIconLocked=mdiLockOutline]      Lock button icon while locked
 * @prop {string}   [opt.menuLockTooltipLocked='Unlock']  Lock button tooltip while locked
 * @prop {string}   [opt.menuIconColor='#555']            Toolbar icon color
 * @prop {string}   [opt.menuIconColorHover='#222']       Toolbar icon color on hover
 * @prop {string}   [opt.menuIconColorFocus='#222']       Toolbar icon color on focus
 * @prop {number}   [opt.menuIconSize=22]                 Toolbar icon size (px)
 * @prop {string}   [opt.menuBackgroundColor='#fefefe']   Toolbar button background
 * @prop {string}   [opt.menuBackgroundColorHover='#f0f0f0']     Toolbar button background on hover
 * @prop {string}   [opt.menuBackgroundColorFocus='#f0f0f0']     Toolbar button background on focus
 * @prop {string}   [opt.menuSeparatorColor='#e6e6e6']    Toolbar separator line color
 * @prop {boolean}  [opt.menuShadow=true]                 Toolbar drop shadow
 * @prop {string}   [opt.menuTooltipTextColor='white']    Toolbar tooltip text color
 * @prop {string}   [opt.menuTooltipTextFontSize='0.7rem']       Toolbar tooltip font size
 * @prop {string}   [opt.menuTooltipBackgroundColor='rgba(60,60,60,0.75)'] Toolbar tooltip background
 *
 * ─── Settings Popup ────────────────────────────────────────────────────
 * @prop {string}   [opt.settingsPopupBackgroundColor='#fff'] Settings popup background
 * @prop {string}   [opt.settingsPopupTextColor='#333']       Settings popup text color
 * @prop {string}   [opt.settingsPopupTextFontSize='12px']    Settings popup font size
 *
 * ─── Infor Popup ────────────────────────────────────────────────────────
 * @prop {string}   [opt.inforPopupBackgroundColor='#fff']              Info popup background
 * @prop {string}   [opt.inforPopupTitleTextColor='#333']              Info popup title text color
 * @prop {string}   [opt.inforPopupTitleTextFontSize='12px']           Info popup title font size
 * @prop {string}   [opt.inforPopupDescriptionTextColor='#888']        Info popup description text color
 * @prop {string}   [opt.inforPopupDescriptionTextFontSize='10px']     Info popup description font size
 *
 * ─── Default Node ──────────────────────────────────────────
 * @prop {string}   [opt.defNodeType='basic']             Default node type: 'input' | 'basic' | 'output'
 * @prop {string}   [opt.defNodeShape='rectangle']        Default shape: 'rectangle' | 'diamond' | 'ellipse' | 'triangle' | ...
 * @prop {number}   [opt.defNodeWidth=100]                Default node width (px)
 * @prop {number}   [opt.defNodeHeight=40]                Default node height (px)
 * @prop {number}   [opt.defNodeFontSize=12]              Default node font size (px)
 * @prop {number}   [opt.defNodeFontSizeMin=1]            Min font size in settings
 * @prop {number}   [opt.defNodeFontSizeMax=72]           Max font size in settings
 * @prop {string}   [opt.defNodeFontColor='#333333']      Default node text color
 * @prop {string}   [opt.defNodeFaceColor='#ffffff']      Default node fill color
 * @prop {string}   [opt.defNodeEdgeColor='#bbbbbb']      Default node border color
 * @prop {number}   [opt.defNodeEdgeWidth=1]              Default node border width (px)
 * @prop {string}   [opt.defNodeToPosition='bottom']      Default outgoing handle position: 'top' | 'bottom' | 'left' | 'right'
 * @prop {string}   [opt.defNodeFromPosition='top']       Default incoming handle position
 * @prop {string}   [opt.defNodePopupDirection='right']   Default settings popup direction
 *
 * ─── Default Creating Connection ────────────────────────────────────────────────────────
 * @prop {string}   [opt.defConnCreatingType='bezier']     Drag-line type: 'bezier' | 'straight' | 'step' | 'smoothstep'
 * @prop {string}   [opt.defConnCreatingEdgeColor='#b1b1b7']  Drag-line color
 * @prop {number}   [opt.defConnCreatingEdgeWidth=1]          Drag-line width (px)
 * @prop {string}   [opt.defConnCreatingEdgeDasharray='5 5'] Drag-line dash pattern ('' for solid)
 * ─── Deleting confirmation(刪除確認契約)───
 * @prop {Function} [opt.funConfirmDeleting=null]        Async delete confirmation fn(payload) → Promise<boolean>.
 *   套件不內建二次確認 UI:未提供此 callback 時,刪除按鈕/刪除鍵一律立即刪除;
 *   提供時,全部刪除入口(節點設定表單、連線設定表單、刪除鍵)一律先 await 此 callback,
 *   **嚴格回傳 true 才真的刪除**——回傳 false / undefined / 其他值 / 拋錯一律不刪。
 *   payload = { nodes, conns, from }:
 *     - nodes:即將刪除之節點(已排除 deletable:false 者)
 *     - conns:即將刪除之連線,含「因節點被刪而連帶刪除」者(供宿主組出確認訊息)
 *     - from:'node-settings' | 'conn-settings' | 'delete-key'
 *   確認進行中(await 尚未回覆)不再受理新的刪除請求,避免重複刪除與多重確認視窗;
 *   await 期間圖若已變動(宿主抽換資料、他途已刪),僅刪除仍存在之目標,`delete` 事件之
 *   payload 亦只含實際被刪者。
 * @prop {Function} [opt.funValidConnCreating=null]      Custom connection validator fn(connection) → boolean.
 *   須為同步純函式(無副作用): 除放開(commit)外, 拖線中游標移入把手(hover 目標變更)時亦會被呼叫一次,
 *   以即時標示落點可否連線(valid/invalid); 兩處收到之 connection 形狀完全相同(含已烙印之 fromPosition/toPosition)。
 *   connect-end 事件之第二參數為判定結果 { valid, reason, connection }(additive, 第一參數仍為原生 event),
 *   reason ∈ 'no-endpoint'|'origin-not-source'|'target-not-target'|'not-connectable'|'self'|'missing-node'|
 *   'from-output'|'to-input'|'duplicate'|'custom'|'cancelled'|null
 *
 * ─── Default Connection ────────────────────────────────────
 * @prop {string}   [opt.defConnType='bezier']            Default conn type: 'bezier' | 'straight' | 'step' | 'smoothstep'
 * @prop {number}   [opt.defConnFontSize=10]              Default conn label font size (px)
 * @prop {number}   [opt.defConnFontSizeMin=1]            Min font size in settings
 * @prop {number}   [opt.defConnFontSizeMax=72]           Max font size in settings
 * @prop {string}   [opt.defConnFontColor='#333333']      Default conn label text color
 * @prop {string}   [opt.defConnEdgeColor='#b1b1b7']      Default conn line color
 * @prop {number}   [opt.defConnEdgeWidth=1]              Default conn line width (px)
 * @prop {string}   [opt.defConnEdgeDasharray='']         Default conn dash pattern ('' for solid, '5 5' for dashed)
 * @prop {string}   [opt.defConnMarkerEnd='']             Default arrow marker: '' | 'arrow' | 'arrowclosed'
 * @prop {boolean}  [opt.defConnAnimated=false]           Default conn animation (dashed flow)
 * @prop {number}   [opt.defOffset=24]                    Step/smoothstep routing buffer (px)
 */
export default {
    components: {
        FlowCanvas,
        ViewportTransform,
        BackgroundLayer,
        SelectionBox,
        NodeRenderer,
        EdgeRenderer,
        ConnectionLine,
        Controls,
    },
    props: {
        opt: {
            type: Object,
            default: () => ({}),
        },
    },
    provide() {
        return {
            getDefNode: () => this.defNode,
            getDefConn: () => this.defConn,
            getConns: () => this.conns, //供節點元件推導實際使用之連接點方位(conn層級錨點)
            //拖曳/縮放ghost(細粒度): 回傳該節點進行中之暫時幾何({x,y}或{x,y,width,height}), 無則null
            getDragGhost: (id) => {
                return this.dragPositions[id] || null
            },
            //複選鍵是否生效(行為判準, 非渲染狀態): 供Node/EdgeWrapper之事件handler呼叫;
            //以getter注入而非prop下傳——此值只影響行為不影響渲染輸出, prop形式會使按/放複選鍵時全部wrapper白重渲染一輪
            getMultiSelectActive: () => this.isMultiSelectActive,
        }
    },
    data() {
        return {
            inited: false,

            // Viewport
            viewport: { x: 0, y: 0, zoom: 1 },

            // Selection
            selectedNodes: [],
            selectedConns: [],

            // UI state
            //框選視覺狀態容器: 容器本身永不替換, 只改box欄位——主模板只讀容器參照,
            //SelectionBox自行依賴box, 拉框每步僅該元件重渲染, WFlowVue不重渲染(與dragPositions同一細粒度模式)
            selectionVisual: { box: null },
            selectionCrossedThreshold: false,
            nodeInternals: {},

            // Interactive lock state (opt.locked sets the initial value only;
            // afterwards toggled via the Controls lock button)
            locked: this.opt.locked === true,

            // Drag state
            isDraggingNode: false,
            draggingNodeId: null,
            dragStartPos: null,
            dragNodeStartPositions: null,
            //拖曳/縮放ghost容器: 鍵隨nodes預建(值null=無ghost), 永不整包替換——
            //讀取端(Node/EdgeWrapper)依賴per-key, 拖曳開始/每步/結束皆僅通知被拖節點之讀者, 無全量重渲染
            dragPositions: {},

            // Pan state
            isPanning: false,
            panStartPos: null,

            // Connection state
            //建線視覺狀態容器: 同selectionVisual之細粒度模式, active兼作邏輯旗標(單一事實來源,
            //經computed isConnecting供既有守衛/測試讀取); 欄位全數預宣告, 只改欄位不換容器
            connectionVisual: {
                active: false,
                fromX: 0,
                fromY: 0,
                fromPosition: 'bottom',
                toX: 0,
                toY: 0,
                //游標懸於把手時之曲線進入方位(把手之 data-handle-position; 離開把手回復 'top')
                toPosition: 'top',
                //游標下落點之即時判定: 'none'(非把手)|'valid'|'invalid'; 僅 ConnectionLine 讀取(細粒度)
                dropStatus: 'none',
            },
            connectingFrom: null,

            //複選模式(渲染面scalar, 由isMultiSelectActive之watcher維護; 契約見JSDoc「Multi-select mode」)
            multiSelectMode: false,

            // Selection state
            isSelecting: false,
            selectionStartPos: null,

            // Key state
            keysPressed: {},

        }
    },
    watch: {
        //複選模式之transition-only scalar: watcher僅於值真正翻轉時寫入(watcher具值相等檢查),
        //根class綁定此scalar而非isMultiSelectActive推導鏈——keysPressed物件於「任意鍵首按」時整包替換,
        //直接綁computed會使根渲染於無關按鍵時被排程; scalar只在false↔true轉移時觸發一次根渲染
        isMultiSelectActive(v) {
            this.multiSelectMode = v
        },
        //ghost鍵預建: 於節點首次渲染前備妥per-key反應式插槽, 讀者才能建立細粒度依賴
        nodes: {
            immediate: true,
            handler(ns) {
                for (const n of (ns || [])) {
                    if (!(n.id in this.dragPositions)) {
                        this.$set(this.dragPositions, n.id, null)
                    }
                }
            },
        },
        opt: {
            handler() {
                if (!this.inited) {
                    this.inited = true
                    let vc = this.center
                    if (vc) {
                        this.viewport.x = vc[0] || 0
                        this.viewport.y = vc[1] || 0
                    }
                    this.viewport.zoom = this.zoom
                    this.$emit('init')
                }
            },
            immediate: true,
        },
    },
    mounted() {
        document.addEventListener('keydown', this.onKeyDown)
        document.addEventListener('keyup', this.onKeyUp)
        document.addEventListener('mousemove', this.onDocMouseMove)
        document.addEventListener('mouseup', this.onDocMouseUp)
        window.addEventListener('blur', this.onWindowBlur)
    },
    beforeDestroy() {
        if (this._panAnimId) {
            cancelAnimationFrame(this._panAnimId)
            this._panAnimId = null
        }
        document.removeEventListener('keydown', this.onKeyDown)
        document.removeEventListener('keyup', this.onKeyUp)
        document.removeEventListener('mousemove', this.onDocMouseMove)
        document.removeEventListener('mouseup', this.onDocMouseUp)
        window.removeEventListener('blur', this.onWindowBlur)
        //建線進行中被銷毀: 把手上的 data-connect-* 暫態標記為 DOM 屬性, 不隨元件狀態消失,
        //須顯式清理(根 class 隨元素移除自然消失); 此處不發connect-end(元件已在銷毀流程中)
        this.resetConnectGesture()
    },
    computed: {
        //flow 實例識別: DOM adapter 據此檢查 elementFromPoint 撿到的把手是否屬於本實例
        flowId() {
            return `wf-${this._uid}`
        },
        widthInp() {
            return this.opt.width || 800
        },
        heightInp() {
            return this.opt.height || 600
        },
        nodes() {
            return this.opt.nodes || []
        },
        conns() {
            return this.opt.conns || []
        },

        nodesDraggable() {
            return this.opt.nodesDraggable !== undefined ? this.opt.nodesDraggable : true
        },
        menuInp() {
            //垂直選單之全部設定, 自opt原樣取出後交Controls解析; 各項未給或型別不符即由Controls回退預設,
            //故此處不套預設值, 預設值統一定義於Controls.vue之menuDef(icon預設需用到@mdi/js之常數)
            let o = this.opt
            return {

                //整體
                useMenu: o.useMenu,
                menuPosition: o.menuPosition,
                menuYShift: o.menuYShift,
                useSetting: o.useSetting,

                //設定鈕(收合/展開)
                menuSettingIcon: o.menuSettingIcon,
                menuSettingTooltip: o.menuSettingTooltip,

                //放大
                useMenuItemZoomIn: o.useMenuItemZoomIn,
                menuZoomInIcon: o.menuZoomInIcon,
                menuZoomInTooltip: o.menuZoomInTooltip,

                //縮小
                useMenuItemZoomOut: o.useMenuItemZoomOut,
                menuZoomOutIcon: o.menuZoomOutIcon,
                menuZoomOutTooltip: o.menuZoomOutTooltip,

                //全圖
                useMenuItemFitView: o.useMenuItemFitView,
                menuFitViewIcon: o.menuFitViewIcon,
                menuFitViewTooltip: o.menuFitViewTooltip,

                //鎖定(雙態: 無後綴為未鎖態, Locked後綴為已鎖態)
                useMenuItemLock: o.useMenuItemLock,
                menuLockIcon: o.menuLockIcon,
                menuLockTooltip: o.menuLockTooltip,
                menuLockIconLocked: o.menuLockIconLocked,
                menuLockTooltipLocked: o.menuLockTooltipLocked,

                //樣式
                menuIconColor: o.menuIconColor,
                menuIconColorHover: o.menuIconColorHover,
                menuIconColorFocus: o.menuIconColorFocus,
                menuIconSize: o.menuIconSize,
                menuBackgroundColor: o.menuBackgroundColor,
                menuBackgroundColorHover: o.menuBackgroundColorHover,
                menuBackgroundColorFocus: o.menuBackgroundColorFocus,
                menuSeparatorColor: o.menuSeparatorColor,
                menuShadow: o.menuShadow,
                menuTooltipTextColor: o.menuTooltipTextColor,
                menuTooltipTextFontSize: o.menuTooltipTextFontSize,
                menuTooltipBackgroundColor: o.menuTooltipBackgroundColor,

            }
        },
        nodesConnectable() {
            return this.opt.nodesConnectable !== undefined ? this.opt.nodesConnectable : true
        },
        nodesResizable() {
            return this.opt.nodesResizable !== undefined ? this.opt.nodesResizable : true
        },
        elementsSelectable() {
            return this.opt.elementsSelectable !== undefined ? this.opt.elementsSelectable : true
        },
        nodesSettingsEnabled() {
            return this.opt.nodesSettingsEnabled !== undefined ? this.opt.nodesSettingsEnabled : true
        },
        connsSettingsEnabled() {
            return this.opt.connsSettingsEnabled !== undefined ? this.opt.connsSettingsEnabled : true
        },
        nodesSettingsExcludes() {
            return this.opt.nodesSettingsExcludes || []
        },
        connsSettingsExcludes() {
            return this.opt.connsSettingsExcludes || []
        },
        selectNodesOnDrag() {
            return this.opt.selectNodesOnDrag !== undefined ? this.opt.selectNodesOnDrag : true
        },
        deleteKeyEnabled() {
            return this.opt.deleteKeyEnabled !== undefined ? this.opt.deleteKeyEnabled : false
        },
        deleteKeyCode() {
            return this.opt.deleteKeyCode || 'Backspace'
        },

        defConnCreatingType() {
            return this.opt.defConnCreatingType || 'bezier'
        },
        defConnCreatingEdgeColor() {
            return this.opt.defConnCreatingEdgeColor || '#b1b1b7'
        },
        defConnCreatingEdgeWidth() {
            return this.opt.defConnCreatingEdgeWidth !== undefined ? this.opt.defConnCreatingEdgeWidth : 1
        },
        defConnCreatingEdgeDasharray() {
            return this.opt.defConnCreatingEdgeDasharray || '5 5'
        },
        defConnCreatingStyle() {
            return {
                stroke: this.defConnCreatingEdgeColor,
                strokeWidth: this.defConnCreatingEdgeWidth,
                strokeDasharray: this.defConnCreatingEdgeDasharray,
            }
        },
        zoomOnScroll() {
            return this.opt.zoomOnScroll !== undefined ? this.opt.zoomOnScroll : true
        },
        panOnDrag() {
            return this.opt.panOnDrag !== undefined ? this.opt.panOnDrag : true
        },
        zoomMin() {
            return this.opt.zoomMin !== undefined ? this.opt.zoomMin : 0.5
        },
        zoomMax() {
            return this.opt.zoomMax !== undefined ? this.opt.zoomMax : 2
        },
        center() {
            return this.opt.center || [0, 0]
        },
        zoom() {
            return this.opt.zoom !== undefined ? this.opt.zoom : 1
        },
        panLimits() {
            return this.opt.panLimits || null
        },

        multiSelectEnabled() {
            return this.opt.multiSelectEnabled !== undefined ? this.opt.multiSelectEnabled : true
        },
        boxSelectionKeyCode() {
            return this.opt.boxSelectionKeyCode || 'Shift'
        },
        multiSelectionKeyCode() {
            return this.opt.multiSelectionKeyCode || 'Shift'
        },

        snapToGrid() {
            return this.opt.snapToGrid !== undefined ? this.opt.snapToGrid : false
        },
        snapGridSize() {
            return this.opt.snapGridSize || 20
        },

        platformBackgroundPatternType() {
            return this.opt.platformBackgroundPatternType || 'dots'
        },
        platformBackgroundPatternGap() {
            return this.opt.platformBackgroundPatternGap !== undefined ? this.opt.platformBackgroundPatternGap : 20
        },
        platformBackgroundPatternSize() {
            return this.opt.platformBackgroundPatternSize !== undefined ? this.opt.platformBackgroundPatternSize : 1
        },
        platformBackgroundPatternColor() {
            return this.opt.platformBackgroundPatternColor || '#81818a'
        },
        platformBackgroundColor() {
            return this.opt.platformBackgroundColor || '#fff'
        },

        // --- Settings popup styling ---
        settingsPopupBackgroundColor() {
            return this.opt.settingsPopupBackgroundColor || '#fff'
        },
        settingsPopupTextColor() {
            return this.opt.settingsPopupTextColor || '#333'
        },
        settingsPopupTextFontSize() {
            return this.opt.settingsPopupTextFontSize || '12px'
        },
        inforPopupBackgroundColor() {
            return this.opt.inforPopupBackgroundColor || '#fff'
        },
        inforPopupTitleTextColor() {
            return this.opt.inforPopupTitleTextColor || '#333'
        },
        inforPopupTitleTextFontSize() {
            return this.opt.inforPopupTitleTextFontSize || '12px'
        },
        inforPopupDescriptionTextColor() {
            return this.opt.inforPopupDescriptionTextColor || '#888'
        },
        inforPopupDescriptionTextFontSize() {
            return this.opt.inforPopupDescriptionTextFontSize || '10px'
        },

        funValidConnCreating() {
            return this.opt.funValidConnCreating || null
        },
        //刪除確認callback(async): 未提供即直接刪除, 提供則須回傳true才真的刪除
        funConfirmDeleting() {
            return typeof this.opt.funConfirmDeleting === 'function' ? this.opt.funConfirmDeleting : null
        },

        defNode() {
            let o = this.opt
            let d = NODE_DEFAULTS
            return {
                type: o.defNodeType || d.type,
                shape: o.defNodeShape || d.shape,
                width: o.defNodeWidth || d.width,
                height: o.defNodeHeight || d.height,
                fontSize: o.defNodeFontSize || d.fontSize,
                fontSizeMin: o.defNodeFontSizeMin || d.fontSizeMin,
                fontSizeMax: o.defNodeFontSizeMax || d.fontSizeMax,
                fontColor: o.defNodeFontColor || d.fontColor,
                faceColor: o.defNodeFaceColor || d.faceColor,
                edgeColor: o.defNodeEdgeColor || d.edgeColor,
                edgeWidth: o.defNodeEdgeWidth !== undefined ? o.defNodeEdgeWidth : d.edgeWidth,
                toPosition: o.defNodeToPosition || d.toPosition,
                fromPosition: o.defNodeFromPosition || d.fromPosition,
                popupDirection: o.defNodePopupDirection || d.popupDirection,
            }
        },
        defConn() {
            let o = this.opt
            let d = CONN_DEFAULTS
            return {
                type: o.defConnType || d.type,
                fontSize: o.defConnFontSize || d.fontSize,
                fontSizeMin: o.defConnFontSizeMin || d.fontSizeMin,
                fontSizeMax: o.defConnFontSizeMax || d.fontSizeMax,
                fontColor: o.defConnFontColor || d.fontColor,
                edgeColor: o.defConnEdgeColor || d.edgeColor,
                edgeWidth: o.defConnEdgeWidth !== undefined ? o.defConnEdgeWidth : d.edgeWidth,
                edgeDasharray: o.defConnEdgeDasharray || '',
                markerEnd: o.defConnMarkerEnd || d.markerEnd,
                animated: o.defConnAnimated !== undefined ? o.defConnAnimated : d.animated,
                defOffset: o.defOffset != null ? o.defOffset : d.defOffset,
            }
        },

        //(效能重構)拖曳/縮放ghost改由getDragGhost細粒度提供(per-node反應式鍵), 不再整包重建nodes陣列
        //why: 舊renderNodes每步mousemove產新陣列+新物件prop, 使兩Renderer與全部Node/EdgeWrapper(含WPopup/WTooltip子樹)
        //     每步全量重渲染(84節點+95邊實測~128ms/步); 細粒度後僅被拖節點與其相連邊重渲染
        //「複選鍵生效中」而非單純「鍵被按下」: 鎖定 或 宿主關閉multiSelectEnabled 時, 該鍵不具複選語義, 等同沒按
        //why: 單選之active有對應效果(開資訊popup, 宿主據node-click同步外部清單之目前項目), 檢視模式本就該保留;
        //     複選之active則無任何對應效果——選了不能整組拖曳/刪除, 只是一片亮起的框, 反而使人誤認功能故障.
        //     故此處只擋複選與框選, 不動單選; 且該鍵無效時點擊須完整退回單選路徑(照常取得active與popup)
        isBoxSelectActive() {
            return this.multiSelectEnabled && !this.locked && !!this.keysPressed[this.boxSelectionKeyCode]
        },
        isMultiSelectActive() {
            //elementsSelectable=false 時該鍵無複選語義(等同鎖定之判準): 不進入複選模式, 點擊照常開popup
            return this.multiSelectEnabled && !this.locked && this.elementsSelectable && !!this.keysPressed[this.multiSelectionKeyCode]
        },
        //建線進行中旗標: 單一事實來源為connectionVisual.active(渲染由ConnectionLine細粒度讀取);
        //此computed供既有守衛與外部測試以原名讀取, 不建立主模板渲染依賴
        isConnecting() {
            return this.connectionVisual.active
        },
    },
    methods: {
    // --- Helpers (replace store methods) ---
        nodeById(id) {
            return this.nodes.find(n => n.id === id) || null
        },
        connById(id) {
            return this.conns.find(c => c.id === id) || null
        },
        setSelectedNodes(ids) {
            this.selectedNodes.splice(0, this.selectedNodes.length, ...ids)
        },
        setSelectedConns(ids) {
            this.selectedConns.splice(0, this.selectedConns.length, ...ids)
        },
        clearSelection() {
            this.selectedNodes.splice(0, this.selectedNodes.length)
            this.selectedConns.splice(0, this.selectedConns.length)
        },
        removeNode(id) {
            let nodes = this.nodes
            let idx = nodes.findIndex(n => n.id === id)
            if (idx === -1) return
            nodes.splice(idx, 1)
            // Remove connected conns
            let conns = this.conns
            for (let i = conns.length - 1; i >= 0; i--) {
                if (conns[i].from === id || conns[i].to === id) {
                    conns.splice(i, 1)
                }
            }
            let selIdx = this.selectedNodes.indexOf(id)
            if (selIdx !== -1) this.selectedNodes.splice(selIdx, 1)
        },
        removeConn(id) {
            let conns = this.conns
            let idx = conns.findIndex(c => c.id === id)
            if (idx === -1) return
            conns.splice(idx, 1)
            let selIdx = this.selectedConns.indexOf(id)
            if (selIdx !== -1) this.selectedConns.splice(selIdx, 1)
        },
        addConn(conn) {
            if (!conn.id || !conn.from || !conn.to) return
            if (this.connById(conn.id)) return
            if (!this.nodeById(conn.from) || !this.nodeById(conn.to)) return
            this.conns.push(conn)
        },
        updateNodeInternals(id, internals) {
            let existing = this.nodeInternals[id]
            if (existing && existing.width === internals.width && existing.height === internals.height) return
            this.$set(this.nodeInternals, id, internals)
        },
        setViewport({ x, y, zoom }) {
            if (x !== undefined) this.viewport.x = x
            if (y !== undefined) this.viewport.y = y
            if (zoom !== undefined) this.viewport.zoom = zoom
        },

        // --- Key handling ---
        //可編輯目標排除: 於輸入框/表單內打字(如設定表單輸入大寫時按Shift)不得被當成畫布快捷鍵——
        //否則Shift會引擎複選模式而關閉使用者正在打字的表單, Delete會誤刪選取節點
        isEditableKeyTarget(e) {
            const t = e.target
            if (!t || !t.tagName) return false
            const tag = t.tagName.toUpperCase()
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true
        },
        onKeyDown(e) {
            if (this.isEditableKeyTarget(e)) return
            //key-repeat不重建keysPressed: 按住修飾鍵時OS以repeat連發keydown(Windows之Shift亦repeat),
            //每次重建物件會使依賴它之computed失效而重渲染(實測80節點+90邊場景, 20次repeat=全樹渲染20輪);
            //僅首次按下才更新物件; 不early return——Delete長按之連刪語義須保留
            if (!this.keysPressed[e.key]) {
                this.keysPressed = { ...this.keysPressed, [e.key]: true }
            }
            if (!this.locked && this.deleteKeyEnabled && (e.key === this.deleteKeyCode || e.key === 'Delete')) {
                //刪除須經確認閘門(async): 此處不等待其完成, 鍵盤事件不因宿主確認流程而阻塞;
                //長按連發之重複請求由閘門之進行中旗標擋下
                this.deleteSelectedElements()
            }
        },
        onKeyUp(e) {
            //keyup不做編輯目標排除: 若按下發生於畫布而放開時焦點已入輸入框, 仍須清除該鍵避免殘留
            //無此鍵即不重建(如視窗外按下回到視窗才放開), 避免多餘之全樹渲染
            if (!(e.key in this.keysPressed)) return
            const copy = { ...this.keysPressed }
            delete copy[e.key]
            this.keysPressed = copy
        },

        // --- Canvas events ---
        onCanvasClick(event) {
            if (event.target.closest('.vue-flow__popup')) return
            if (this.isCanvasInteractiveTarget(event)) return
            //本次手勢已是框選(於mousedown鎖定)者不清空選取: 是否提交新選取交由endSelection依門檻決定
            //why: canvas-click由FlowCanvas元素層mouseup同步emit, 必先於document層之onDocMouseUp→endSelection,
            //     此處若逕自clearSelection, 框選手勢中途放開會先清掉既有選取
            if (this.isSelecting) {
                this.$emit('pane-click', event)
                return
            }
            this.clearSelection()
            this.$emit('pane-click', event)
        },
        onCanvasContextMenu(event) {
            this.$emit('pane-context-menu', event)
        },
        onCanvasDblClick(event) {
            // Calculate flow-space position from the click
            const rect = this.$refs.canvas.getContainerRect()
            if (!rect) return
            const vp = this.viewport
            const flowX = (event.clientX - rect.left - vp.x) / vp.zoom
            const flowY = (event.clientY - rect.top - vp.y) / vp.zoom

            this.$emit('canvas-dblclick', {
                event,
                flowX,
                flowY,
                clientX: event.clientX,
                clientY: event.clientY,
            })
        },
        //畫布層手勢(框選/平移)之目標排除: 按在節點, 連線, 連接點, 縮放把手, 齒輪錨區, 轉折點, 控制選單上時不啟動
        //why: 這些元素各有自己的手勢語義(拖節點/拉連線/縮放/開設定/拖轉折點/操作選單), 畫布層再搶一個手勢會互相干擾;
        //     它們刻意不用@mousedown.stop(stopPropagation會擋掉window層WPopup互斥協調), 故mousedown必定冒泡至此
        isCanvasInteractiveTarget(event) {
            const t = event && event.target
            if (!t || !t.closest) return false
            return !!t.closest([
                '.vue-flow__node',
                '.vue-flow__edge',
                '.vue-flow__handle',
                '.vue-flow__resize',
                '.vue-flow__node-settings',
                '.vue-flow__node-settings-anchor',
                '.vue-flow__edge-settings',
                '.vue-flow__edge-waypoint',
                '.vue-flow__panel',
            ].join(','))
        },
        onCanvasMouseDown(event) {
            if (event.target.closest && event.target.closest('.vue-flow__popup')) return
            //非主鍵不啟動任何畫布層手勢: 判準對齊NodeWrapper.onMouseDown之event.button !== 0
            if (event.button !== 0) return
            if (this.elementsSelectable && this.isBoxSelectActive) {
                if (!this.isCanvasInteractiveTarget(event)) {
                    this.startSelection(event)
                }
                return
            }
            if (this.panOnDrag) {
                const target = event.target
                const isOnNode = target.closest && target.closest('.vue-flow__node')
                const isOnHandle = target.closest && target.closest('.vue-flow__handle')
                //齒輪等UI元素/左上角控制選單/連線轉折點之mousedown不啟動平移(取代其@mousedown.stop, 使mousedown仍能冒泡至window做popup互斥關閉;
                // .vue-flow__panel=Controls垂直選單, .vue-flow__edge-waypoint=連線轉折點拖曳鈕, 否則按之再拖曳會誤觸發平移)
                const isOnUi = target.closest && target.closest('.vue-flow__node-settings, .vue-flow__edge-settings, .vue-flow__panel, .vue-flow__edge-waypoint')
                if (!isOnNode && !isOnHandle && !isOnUi) {
                    this.startPan(event)
                }
            }
        },
        onCanvasMouseMove(event) {
            // Handled by document-level listener
        },
        onCanvasMouseUp(event) {
            // Handled by document-level listener
        },
        onCanvasWheel(event) {
            if (!this.zoomOnScroll) return
            //滾輪縮放亦為viewport寫入者, 先取消程式動畫避免二者互相覆寫
            this.cancelViewportAnimation()
            const delta = -event.deltaY * 0.001
            const currentZoom = this.viewport.zoom
            // fitView may set zoom below zoomMin; use the current level as the
            // effective lower bound so wheel zoom does not jump the view back.
            const zoomMinUse = Math.min(this.zoomMin, currentZoom)
            const newZoom = Math.max(zoomMinUse, Math.min(this.zoomMax, currentZoom + delta * currentZoom))

            const rect = this.$refs.canvas.getContainerRect()
            if (!rect) return
            const mouseX = event.clientX - rect.left
            const mouseY = event.clientY - rect.top

            const vp = this.viewport
            const scale = newZoom / currentZoom
            const newX = mouseX - (mouseX - vp.x) * scale
            const newY = mouseY - (mouseY - vp.y) * scale

            this.setViewport({ x: newX, y: newY, zoom: newZoom })
            this.emitViewportChange()
        },

        // --- Document-level mouse ---
        onDocMouseMove(event) {
            //按鍵已放開卻仍處於進行中狀態: 代表收尾事件未送達(於瀏覽器視窗外放開/視窗失焦/手勢被原生拖曳接管),
            //此時須主動走既有收尾路徑清除狀態; 只return不清狀態無效, 旗標續留為真下次移動仍會誤判
            if ((event.buttons & 1) === 0) {
                //建線不併入onDocMouseUp: endConnect以事件座標做drop落點判定, 而此處是「回到文件後的第一次移動」,
                //其座標已非放開當下位置, 交給endConnect會把途經之target handle誤判為落點, 建立使用者從未放開過的連線
                //(已重現: 回來後第一次mousemove落在另一節點之target handle即產生conn並發update:conns)
                if (this.isConnecting) {
                    this.cancelConnect(event)
                }
                if (this.isPanning || this.isDraggingNode || this.isSelecting) {
                    this.onDocMouseUp(event)
                }
                return
            }
            if (this.isPanning) {
                this.doPan(event)
            }
            else if (this.isDraggingNode) {
                this.doDrag(event)
            }
            else if (this.isConnecting) {
                this.doConnect(event)
            }
            else if (this.isSelecting) {
                this.doSelection(event)
            }
        },
        onWindowBlur(event) {
            //視窗失焦後不會再收到mouseup與keyup, 於此統一收尾避免狀態黏住
            if (this.isPanning) {
                this.endPan()
            }
            //節點拖曳同樣須收尾: 否則isDraggingNode殘留為true, 回到視窗後在觸發mousemove守衛前
            //點擊其他節點, 該次node-click會被onNodeClick之拖曳守衛以過期狀態誤擋
            //event為blur事件(非MouseEvent), endDrag不讀取座標僅原樣轉交node-drag-stop, 故不偽造mouseup
            if (this.isDraggingNode) {
                this.endDrag(event)
            }
            //框選同樣須收尾: 殘留之isSelecting會於回到視窗後與新手勢並存, mouseup時再次以過期框覆寫選取
            if (this.isSelecting) {
                this.cancelSelection()
            }
            //建線同樣須收尾: 否則isConnecting殘留為true且全域樣式續留document.head(已重現: 失焦後兩者皆不變),
            //失焦無「放開當下」之有效座標, 故走取消路徑不做落點判定亦不建立連線
            if (this.isConnecting) {
                this.cancelConnect(event)
            }
            this.keysPressed = {}
        },
        onDocMouseUp(event) {
            if (this.isPanning) {
                this.endPan()
            }
            if (this.isDraggingNode) {
                this.endDrag(event)
            }
            if (this.isConnecting) {
                this.endConnect(event)
            }
            if (this.isSelecting) {
                this.endSelection(event)
            }
        },

        // --- Pan ---
        startPan(event) {
            //手動平移優先於程式動畫, 否則二者同時寫viewport而互相覆寫
            this.cancelViewportAnimation()
            this.isPanning = true
            this.panStartPos = { x: event.clientX, y: event.clientY }
        },
        doPan(event) {
            const dx = event.clientX - this.panStartPos.x
            const dy = event.clientY - this.panStartPos.y
            this.panStartPos = { x: event.clientX, y: event.clientY }

            let x = this.viewport.x + dx
            let y = this.viewport.y + dy

            if (this.panLimits) {
                const clamped = clampPosition({ x, y }, this.panLimits)
                x = clamped.x
                y = clamped.y
            }

            this.viewport.x = x
            this.viewport.y = y
        },
        endPan() {
            this.isPanning = false
            this.panStartPos = null
            this.emitViewportChange()
        },

        // --- Node drag ---
        //於節點mousedown當下先行選取(拖曳本身延後至跨越位移門檻才由onNodeDragStart啟動)。
        //守衛與選取條件皆與修正前之onNodeDragStart一致, 故選取時機不因拖曳延後而改變。
        onNodeDragPrepare({ node }) {
            if (this.locked || !this.nodesDraggable) return
            //已在選取集合內者不塌陷選取, 否則框選一組後直接拖其中一顆會只搬動該顆
            //(單純點擊仍由onNodeClick收斂為單選, 故單擊改選這顆之行為不變)
            if (this.selectNodesOnDrag && !this.isMultiSelectActive && !this.selectedNodes.includes(node.id)) {
                this.setSelectedNodes([node.id])
                this.setSelectedConns([])
            }
        },
        onNodeDragStart({ node, event, moveEvent }) {
            if (this.locked || !this.nodesDraggable) return

            // Cache start positions for drag
            //拖曳成員過濾: hidden(未渲染)與draggable:false之節點不得被同組節點連帶搬走, 否則該旗標語義被破壞
            //(過濾與早退須在設isDraggingNode之前, 否則早退會留下isDraggingNode為真之黏住狀態)
            const canMove = (n) => !!n && !n.hidden && n.draggable !== false
            const starts = {}
            this.selectedNodes.forEach(id => {
                const n = this.nodeById(id)
                if (canMove(n)) starts[id] = { x: n.position.x, y: n.position.y }
            })
            if (!starts[node.id]) {
                const n = this.nodeById(node.id)
                if (canMove(n)) starts[node.id] = { x: n.position.x, y: n.position.y }
            }
            if (!starts[node.id]) return

            this.isDraggingNode = true
            this.draggingNodeId = node.id
            this.dragStartPos = { x: event.clientX, y: event.clientY }
            this.dragNodeStartPositions = starts

            //啟用被拖節點之ghost(per-key賦值, 僅通知讀該鍵之元件), 之後每步僅原地改x/y
            for (let id in starts) {
                if (!(id in this.dragPositions)) {
                    this.$set(this.dragPositions, id, null)
                }
                this.dragPositions[id] = { x: starts[id].x, y: starts[id].y }
            }

            this.$emit('node-drag-start', { node, event })

            //立即套用跨門檻的這一次mousemove: document層之onDocMouseMove於本輪事件已先看過
            //(當時isDraggingNode仍為false而返回), 不補這一次則跨門檻後立刻放開將完全沒有位移
            if (moveEvent && this.isDraggingNode) {
                this.doDrag(moveEvent)
            }
        },
        doDrag(event) {
            const zoom = this.viewport.zoom
            const dx = (event.clientX - this.dragStartPos.x) / zoom
            const dy = (event.clientY - this.dragStartPos.y) / zoom
            const snap = this.snapToGrid

            for (let id in this.dragNodeStartPositions) {
                const start = this.dragNodeStartPositions[id]
                let x = start.x + dx
                let y = start.y + dy
                if (snap) {
                    const s = snapPosition({ x, y }, this.snapGridSize)
                    x = s.x
                    y = s.y
                }
                const gg = this.dragPositions && this.dragPositions[id]
                if (gg) {
                    gg.x = x
                    gg.y = y
                }
            }
        },
        endDrag(event) {
            // Write final positions back to opt.nodes, 並關閉ghost(per-key設回null)
            if (this.dragNodeStartPositions) {
                for (let id in this.dragNodeStartPositions) {
                    let pos = this.dragPositions[id]
                    let node = this.nodeById(id)
                    if (node && pos) {
                        node.position.x = pos.x
                        node.position.y = pos.y
                    }
                    this.dragPositions[id] = null
                }
            }
            const dragNode = this.nodeById(this.draggingNodeId)
            this.isDraggingNode = false
            this.draggingNodeId = null
            this.dragStartPos = null
            this.dragNodeStartPositions = null
            clearStepCache()
            if (dragNode) {
                this.$emit('node-drag-stop', { node: dragNode, event })
            }
            this.emitNodesUpdate()
        },

        // --- Connection ---
        onConnectStart(payload) {
            if (this.locked || !this.nodesConnectable) return
            //複選模式中不啟動建線(把手已隱藏, 此為縱深第二層; 守衛先於任何狀態/標記之設定)
            if (this.isMultiSelectActive) return
            //建線只能自source(連出)型handle出發: target(連入)型handle拖曳不啟動建線, 維持方向語義
            if (payload.handleType !== 'source') return
            //重入守衛(縱深第二層, Handle已擋非主鍵): 拉線途中他途再送connect-start不得重跑啟動流程,
            //否則出發把手標記/狀態被改寫而失去清理參照
            if (this.isConnecting) return
            //節點不存在即不啟動: 此檢查須先於狀態設定, 否則早退會留下isConnecting與把手標記
            const node = this.nodeById(payload.nodeId)
            if (!node) return

            //出發 endpoint(preview/commit 共用之判定輸入; element 供暫態視覺標記與清理)
            const originEl = payload.event
                ? (payload.event.currentTarget || (payload.event.target && payload.event.target.closest && payload.event.target.closest('.vue-flow__handle')))
                : null
            this._connectOrigin = {
                nodeId: payload.nodeId,
                handleId: payload.handleId || null,
                type: 'source',
                position: payload.handlePosition || null,
                binding: payload.handleBinding || 'auto',
                connectable: true,
                element: originEl || null,
            }
            this._connectHoverEl = null
            setHandleConnectRole(originEl, 'origin')

            this.connectionVisual.active = true
            this.connectingFrom = payload

            const pos = getHandlePosition(
                node, payload.handlePosition,
                this.nodeInternals[payload.nodeId] || {},
                'source', this.defNode
            )
            this.connectionVisual.fromX = pos.x
            this.connectionVisual.fromY = pos.y
            this.connectionVisual.fromPosition = payload.handlePosition
            this.connectionVisual.toX = pos.x
            this.connectionVisual.toY = pos.y
            this.connectionVisual.toPosition = 'top'
            this.connectionVisual.dropStatus = 'none'

            this.$emit('connect-start', {
                nodeId: payload.nodeId,
                handleId: payload.handleId,
                handleType: payload.handleType,
            })
        },
        doConnect(event) {
            const rect = this.$refs.canvas.getContainerRect()
            if (!rect) return
            const vp = this.viewport
            this.connectionVisual.toX = (event.clientX - rect.left - vp.x) / vp.zoom
            this.connectionVisual.toY = (event.clientY - rect.top - vp.y) / vp.zoom
            //游標下落點之即時判定(對齊 React Flow/Vue Flow: 拖曳中逐 hover 目標評估, 非只在放開時):
            //僅於「游標下把手 identity 改變」時判定一次並標記, 不逐幀重算(validator 呼叫紀律)
            const handleEl = findHandleElAt(event.clientX, event.clientY)
            if (handleEl !== this._connectHoverEl) {
                setHandleConnectStatus(this._connectHoverEl, null)
                this._connectHoverEl = handleEl
                let status = 'none'
                let toPosition = 'top'
                if (handleEl) {
                    const target = describeHandleEndpoint(handleEl, this.flowId)
                    if (target) {
                        //preview 與 commit 共用 assessConnection(相同 endpoint 對必得相同結論);
                        //宿主 validator 拋錯視為 invalid(hover 屬預覽, 不得讓 mousemove listener 逐次拋錯;
                        //commit 路徑之拋錯由 endConnect 之 finally 保證清理後原樣上拋)
                        let r
                        try {
                            r = assessConnection(this._connectOrigin, target, {
                                nodes: this.nodes, conns: this.conns, validator: this.funValidConnCreating,
                            })
                        }
                        catch (e) {
                            r = { valid: false }
                        }
                        status = r.valid ? 'valid' : 'invalid'
                        if (target.position) toPosition = target.position
                        setHandleConnectStatus(handleEl, status)
                    }
                    //他 flow 實例之把手(describe 回 null): 不標記不反應, status 維持 'none'
                }
                if (this.connectionVisual.dropStatus !== status) this.connectionVisual.dropStatus = status
                if (this.connectionVisual.toPosition !== toPosition) this.connectionVisual.toPosition = toPosition
            }
        },
        endConnect(event) {
            //落點判定與 commit: 與 doConnect 之 preview 共用 describeHandleEndpoint + assessConnection,
            //不另手組 connection(preview/commit 同源, 不會分家)。
            //逐邊錨點只在把手宣告 binding='fixed' 時烙印(anchorPolicy 之 Auto/Fixed 語義, 由
            //buildConnectionCandidate 統一實作): 預設 Auto 把手拉出的邊不寫方位, 動態跟隨節點設定;
            //why: 原本無條件烙印, 使 conn 層永遠蓋過節點層 → To Handle 設定看似失效(已重現)
            let result = { valid: false, reason: 'no-endpoint', connection: null }
            try {
                const handleEl = findHandleElAt(event.clientX, event.clientY)
                const target = describeHandleEndpoint(handleEl, this.flowId)
                if (target && this._connectOrigin) {
                    result = assessConnection(this._connectOrigin, target, {
                        nodes: this.nodes, conns: this.conns, validator: this.funValidConnCreating,
                    })
                    if (result.valid) {
                        const connection = result.connection
                        const connId = `e${connection.from}-${connection.to}`
                        const conn = {
                            id: this.connById(connId) ? generateId() : connId,
                            ...connection,
                        }
                        this.addConn(conn)
                        this.emitConnsUpdate()
                        this.$emit('connect', connection)
                    }
                }
            }
            finally {
                //清理入 finally: validator/addConn/宿主事件handler拋錯時不得留下建線狀態與把手標記
                //(原版清理接在 commit 之後循序執行, 中途拋錯即黏死 isConnecting 與全域樣式)
                //connect-end 第二參數為判定結果(additive): 宿主可據 reason 說明為何未建線
                this.$emit('connect-end', event, { valid: result.valid, reason: result.reason, connection: result.connection })
                this.resetConnectGesture()
            }
        },
        //取消建線: 不做落點判定亦不建立連線, 供視窗失焦與buttons補收尾使用——二者皆無「放開當下」之有效座標,
        //交由endConnect會以錯誤座標做drop hit-test; 仍發connect-end使宿主能收尾自身UI(與endDrag於失焦時照發node-drag-stop同理)
        cancelConnect(event) {
            if (!this.isConnecting) return
            this.$emit('connect-end', event, { valid: false, reason: 'cancelled', connection: null })
            this.resetConnectGesture()
        },
        //建線手勢之統一清理(正常放開/取消/銷毀共用): 重置視覺容器欄位、清除出發與hover把手之暫態標記。
        //把手標記為 DOM dataset(非反應式), 必須顯式清除; 重複呼叫安全(setHandleConnectXxx 對 null 無操作)
        resetConnectGesture() {
            this.connectionVisual.active = false
            this.connectionVisual.dropStatus = 'none'
            this.connectionVisual.toPosition = 'top'
            this.connectingFrom = null
            setHandleConnectStatus(this._connectHoverEl, null)
            this._connectHoverEl = null
            if (this._connectOrigin) setHandleConnectRole(this._connectOrigin.element, null)
            this._connectOrigin = null
        },

        // --- Selection ---
        onNodeClick({ node, event }) {
            //本次手勢已被接受為拖曳者不再視為點擊: NodeWrapper之@mouseup綁在節點元素上,
            //必先於document層之onDocMouseUp→endDrag觸發, 故此刻isDraggingNode仍為true即代表拖曳成立。
            //(涵蓋「跨門檻拖出後又移回原點放開」之情形——該情形最終位移為0, 僅靠距離判準無法辨識)
            if (this.isDraggingNode) return
            if (!this.elementsSelectable) return
            //複選鍵未生效時(含鎖定/宿主關閉複選)一律走單選路徑: 該節點取得active, 宿主據node-click同步外部清單
            if (this.isMultiSelectActive) {
                const idx = this.selectedNodes.indexOf(node.id)
                if (idx === -1) {
                    this.selectedNodes.push(node.id)
                }
                else {
                    this.selectedNodes.splice(idx, 1)
                }
            }
            else {
                this.setSelectedNodes([node.id])
                this.setSelectedConns([])
            }
            this.emitSelectionChange()

            this.$emit('node-click', { node, event })
        },
        onNodeDoubleClick(payload) {
            this.$emit('node-double-click', payload)
        },
        onNodeContextMenu(payload) {
            this.$emit('node-context-menu', payload)
        },
        onNodeSettingsClick(payload) {
            this.$emit('node-settings-click', payload)
        },
        onNodeSettingsUpdate({ node, key, value }) {
            let n = this.nodeById(node.id)
            if (!n) return
            let oldType = n.type
            this.$set(n, key, value)
            if (key === 'type' && oldType !== value) {
                let nodeId = n.id
                let hasTo = value === 'input' || value === 'basic'
                let hasFrom = value === 'output' || value === 'basic'
                let conns = this.conns
                for (let i = conns.length - 1; i >= 0; i--) {
                    let c = conns[i]
                    if ((!hasTo && c.from === nodeId) || (!hasFrom && c.to === nodeId)) {
                        conns.splice(i, 1)
                    }
                }
            }
            this.$emit('node-settings-update', { node: n, key, value })
        },
        async onNodeSettingsDelete({ node }) {
            //與刪除鍵共用同一確認閘門(不同入口不得有不同反應)
            const ok = await this.confirmDeleting({
                nodes: [node],
                conns: this.withRelatedConns([node.id], []), //連帶被刪之邊
                from: 'node-settings',
            })
            if (!ok || this._isDestroyed) return false
            //await期間目標可能已被他途刪除
            if (!this.nodeById(node.id)) return false
            this.removeNode(node.id)
            clearStepCache()
            this.emitNodesUpdate()
            this.emitConnsUpdate()
            this.$emit('node-settings-delete', { node })
            return true
        },
        //批次將某節點一側之固定錨點改回 Auto(使用者於設定表單明確操作, 非默默清除)
        //end: 'source'=出邊之fromPosition, 'target'=入邊之toPosition
        onNodeAnchorsUnfix({ node, end }) {
            const isSource = end === 'source'
            let changed = false
            for (const c of this.conns) {
                if (isSource && c.from === node.id && c.fromPosition) {
                    this.$delete(c, 'fromPosition')
                    changed = true
                }
                if (!isSource && c.to === node.id && c.toPosition) {
                    this.$delete(c, 'toPosition')
                    changed = true
                }
            }
            if (changed) {
                clearStepCache()
                this.emitConnsUpdate()
            }
        },
        onNodeMouseEnter({ node, event }) {
            this.$emit('node-mouseenter', { node, event })
        },
        onNodeMouseLeave({ node, event }) {
            this.$emit('node-mouseleave', { node, event })
        },
        onConnClick({ conn, event }) {
            if (!this.elementsSelectable) return
            //連線不參與多選鍵之複選: 按住多選鍵點連線時不變更任何選取(不加入亦不移除), 單擊路徑維持原樣
            if (this.isMultiSelectActive) {
                this.$emit('conn-click', { conn, event })
                return
            }
            this.setSelectedConns([conn.id])
            this.setSelectedNodes([])
            this.emitSelectionChange()

            this.$emit('conn-click', { conn, event })
        },
        onConnDoubleClick(payload) {
            this.$emit('conn-double-click', payload)
        },
        onConnContextMenu(payload) {
            this.$emit('conn-context-menu', payload)
        },
        onConnMouseEnter({ conn, event }) {
            this.$emit('conn-mouseenter', { conn, event })
        },
        onConnMouseLeave({ conn, event }) {
            this.$emit('conn-mouseleave', { conn, event })
        },
        onConnSettingsClick(payload) {
            this.$emit('conn-settings-click', payload)
        },
        onConnSettingsUpdate({ conn, key, value }) {
            let c = this.connById(conn.id)
            if (c) {
                this.$set(c, key, value)
                this.$emit('conn-settings-update', { conn: c, key, value })
            }
        },
        async onConnSettingsDelete({ conn }) {
            const ok = await this.confirmDeleting({ nodes: [], conns: [conn], from: 'conn-settings' })
            if (!ok || this._isDestroyed) return false
            if (!this.connById(conn.id)) return false
            this.removeConn(conn.id)
            clearStepCache()
            this.emitConnsUpdate()
            this.$emit('conn-settings-delete', { conn })
            return true
        },

        // --- Activate(單元素active轉移) ---
        //齒輪/縮放把手等「元素專屬操作」使該元素成為唯一選取(active)
        //why: 此類操作之作用對象只有該元素, 不沿用拖曳之「已選不塌陷」——沿用會使視覺選取(A+B)與
        //     實際作用對象(B)不一致, 且已在集合內時不發事件, 宿主據以同步之外部清單將停留在舊項目;
        //     按住多選鍵時控制項語義優先, 仍單選不做toggle
        onNodeActivate({ node }) {
            if (!this.elementsSelectable) return
            //複選模式中不做sole-select(齒輪/縮放把手已隱藏點不到, 此為縱深invariant):
            //模式中之選取變更只能走onNodeClick之toggle路徑, 程式化選取應走選取API而非借用UI activate
            if (this.isMultiSelectActive) return
            //已是唯一選取即不重發: 重複點同一齒輪不應連發selection-change
            if (this.selectedNodes.length === 1 && this.selectedNodes[0] === node.id && this.selectedConns.length === 0) return
            this.setSelectedNodes([node.id])
            this.setSelectedConns([])
            this.emitSelectionChange()
        },
        onConnActivate({ conn }) {
            if (!this.elementsSelectable) return
            //同onNodeActivate: 複選模式中不做sole-select
            if (this.isMultiSelectActive) return
            if (this.selectedConns.length === 1 && this.selectedConns[0] === conn.id && this.selectedNodes.length === 0) return
            this.setSelectedConns([conn.id])
            this.setSelectedNodes([])
            this.emitSelectionChange()
        },

        startSelection(event) {
            const rect = this.$refs.canvas.getContainerRect()
            if (!rect) return //rect取不到即不進入框選態, 否則留下isSelecting為真之殘留狀態
            this.isSelecting = true
            this.selectionCrossedThreshold = false
            this.selectionStartPos = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            }
            this.selectionVisual.box = {
                x: this.selectionStartPos.x,
                y: this.selectionStartPos.y,
                width: 0,
                height: 0,
            }
        },
        doSelection(event) {
            const rect = this.$refs.canvas.getContainerRect()
            if (!rect || !this.selectionStartPos) return
            const currentX = event.clientX - rect.left
            const currentY = event.clientY - rect.top
            const width = Math.abs(currentX - this.selectionStartPos.x)
            const height = Math.abs(currentY - this.selectionStartPos.y)
            //跨過門檻即鎖住: 供endSelection判定本次是真的拉了框, 或只是原地按放(後者不得覆寫既有選取)
            if (width >= 3 || height >= 3) {
                this.selectionCrossedThreshold = true
            }
            const x = Math.min(this.selectionStartPos.x, currentX)
            const y = Math.min(this.selectionStartPos.y, currentY)
            this.selectionVisual.box = { x, y, width, height }
        },
        //只清框選手勢狀態, 不提交選取(供視窗失焦與未跨門檻之收尾)
        cancelSelection() {
            this.isSelecting = false
            this.selectionStartPos = null
            this.selectionVisual.box = null
            this.selectionCrossedThreshold = false
        },
        endSelection() {
            //未跨門檻(原地按放)不提交選取: 否則零面積框恰落於游標下元素內時會取代既有選取,
            //使Shift+點擊之累加被覆寫, 且Shift+點空白處會清空整組選取
            if (this.selectionVisual.box && this.selectionCrossedThreshold) {
                const box = this.selectionVisual.box
                const vp = this.viewport
                // Convert screen-space box to graph-space
                const graphBox = {
                    x: (box.x - vp.x) / vp.zoom,
                    y: (box.y - vp.y) / vp.zoom,
                    width: box.width / vp.zoom,
                    height: box.height / vp.zoom,
                }
                //hidden節點未渲染於畫布, 不應被框選選入
                const nodesVisible = this.nodes.filter(n => !n.hidden)
                const overlapping = getOverlappingNodes(graphBox, nodesVisible, this.nodeInternals)
                const nodeIds = overlapping.map(n => n.id)
                this.setSelectedNodes(nodeIds)
                //連線不參與框選複選: 連線為起訖節點錨點/轉折點/自身設定推得之衍生物, 節點移動時重繪即可,
                //不視為可被複選之項目, 故此處只清空而不依兩端是否入框自動選取
                this.setSelectedConns([])
                this.emitSelectionChange()
            }
            this.cancelSelection()
        },

        // --- Delete ---
        //刪除確認閘門: 全部刪除入口(節點設定表單/連線設定表單/刪除鍵)共用之單一 gate。
        //宿主未提供 opt.funConfirmDeleting 即直接刪除(套件不再內建二次確認UI);
        //提供則 await 其結果, 嚴格為 true 才真的刪除——回傳 false/undefined/拋錯一律不刪(不可預設為准)。
        async confirmDeleting(payload) {
            const fn = this.funConfirmDeleting
            if (!fn) return true
            //確認進行中不再受理新的刪除請求: 避免同一目標連點兩次而重複刪除/重複發事件,
            //或同時開出多個確認流程(宿主之modal通常為單例)
            if (this._deleteConfirming) return false
            this._deleteConfirming = true
            try {
                const ok = await fn(payload)
                return ok === true
            }
            catch (e) {
                //宿主callback拋錯=無從確認 → 不刪; 不靜默吞掉, 使宿主能發現自身錯誤
                console.error('[w-flow-vue] funConfirmDeleting threw, deletion aborted:', e)
                return false
            }
            finally {
                this._deleteConfirming = false
            }
        },
        //以id重新解析仍存在之目標: await 期間圖可能已變(宿主抽換nodes/conns、他途已刪),
        //以確認當下之快照直接刪除會刪到不該刪的或對已消失者發事件
        resolveDeleteTargets(nodeIds, connIds) {
            return {
                nodeIds: nodeIds.filter(id => !!this.nodeById(id)),
                connIds: connIds.filter(id => !!this.connById(id)),
            }
        },
        async deleteSelectedElements() {
            const sel = this.getSelectedElements()
            //deletable:false 者自始排除: 不列入確認payload, 亦不列入delete事件(payload語義為「實際被刪者」)
            const nodes = sel.nodes.filter(n => n.deletable !== false)
            const conns = sel.conns.filter(c => c.deletable !== false)
            if (nodes.length === 0 && conns.length === 0) return false

            const ok = await this.confirmDeleting({
                nodes,
                //節點被刪時其相關連線一併刪除: 併入payload使宿主能據以組出確認訊息
                conns: this.withRelatedConns(nodes.map(n => n.id), conns),
                from: 'delete-key',
            })
            //元件於await期間被銷毀即不再操作狀態
            if (!ok || this._isDestroyed) return false

            const t = this.resolveDeleteTargets(nodes.map(n => n.id), conns.map(c => c.id))
            if (t.nodeIds.length === 0 && t.connIds.length === 0) return false
            const deletedNodes = t.nodeIds.map(id => this.nodeById(id))
            const deletedConns = t.connIds.map(id => this.connById(id))
            t.nodeIds.forEach(id => this.removeNode(id))
            t.connIds.forEach(id => this.removeConn(id))
            this.clearSelection()

            clearStepCache()
            this.$emit('delete', { nodes: deletedNodes, conns: deletedConns })
            this.emitNodesUpdate()
            this.emitConnsUpdate()
            return true
        },
        //指定節點之相關連線(將被連帶刪除者)併入既有連線清單, 去重後回傳
        withRelatedConns(nodeIds, conns) {
            const ids = new Set(nodeIds)
            const seen = new Set(conns.map(c => c.id))
            const out = conns.slice()
            for (const c of this.conns) {
                if (seen.has(c.id)) continue
                if (ids.has(c.from) || ids.has(c.to)) out.push(c)
            }
            return out
        },

        // --- Node dimensions ---
        onNodeDimensions({ nodeId, width, height }) {
            this.updateNodeInternals(nodeId, { width, height })
        },

        onNodeResize({ nodeId, width, height, x, y }) {
            if (this.locked) return
            //縮放ghost併入dragPositions同一per-key機制: 首步建物件, 之後原地改欄位
            if (!(nodeId in this.dragPositions)) {
                this.$set(this.dragPositions, nodeId, null)
            }
            const g = this.dragPositions[nodeId]
            if (!g) {
                this.dragPositions[nodeId] = { x, y, width, height }
            }
            else {
                g.x = x
                g.y = y
                g.width = width
                g.height = height
            }
            this.updateNodeInternals(nodeId, { width, height })
        },
        onNodeResizeEnd({ nodeId, width, height, x, y }) {
            let node = this.nodeById(nodeId)
            if (node) {
                node.width = width
                node.height = height
                node.position.x = x
                node.position.y = y
            }
            this.dragPositions[nodeId] = null
            clearStepCache()
            this.emitNodesUpdate()
        },

        // --- Helpers ---
        updateNodePosition(id, position) {
            let node = this.nodeById(id)
            if (!node) return
            node.position.x = position.x
            node.position.y = position.y
        },
        getSelectedElements() {
            return {
                nodes: this.nodes.filter(n => this.selectedNodes.includes(n.id)),
                conns: this.conns.filter(c => this.selectedConns.includes(c.id)),
            }
        },

        // --- Emit helpers ---
        emitNodesUpdate() {
            this.$emit('update:nodes', [...this.nodes])
        },
        emitConnsUpdate() {
            this.$emit('update:conns', [...this.conns])
        },
        emitViewportChange() {
            this.$emit('viewport-change', { ...this.viewport })
        },
        getViewport() {
            //即時視口: viewport-change僅於手勢結束才發出, 平移途中呼叫端需要當下值時走此方法
            //(呼叫端若以viewport-change快取之值為基準回寫setViewport, 會於平移途中以過期值覆寫使用者正在進行的平移)
            let vp = this.viewport
            return { x: vp.x, y: vp.y, zoom: vp.zoom }
        },
        cancelViewportAnimation() {
            //取消進行中之視口動畫(panToNode), 否則動畫與手動手勢會同時寫入同一個viewport
            if (this._panAnimId) {
                cancelAnimationFrame(this._panAnimId)
                this._panAnimId = null
            }
        },
        emitSelectionChange() {
            this.$emit('selection-change', this.getSelectedElements())
        },

        // --- Public API ---
        fitView(padding) {
            padding = padding || 50
            let nodes = this.nodes.filter(n => !n.hidden)
            if (nodes.length === 0) return
            let internals = this.nodeInternals
            let minX = Infinity
            let minY = Infinity
            let maxX = -Infinity
            let maxY = -Infinity
            nodes.forEach(n => {
                let w = (internals[n.id] && internals[n.id].width) || n.width || 150
                let h = (internals[n.id] && internals[n.id].height) || n.height || 40
                minX = Math.min(minX, n.position.x)
                minY = Math.min(minY, n.position.y)
                maxX = Math.max(maxX, n.position.x + w)
                maxY = Math.max(maxY, n.position.y + h)
            })
            let rect = this.$refs.canvas ? this.$refs.canvas.getContainerRect() : null
            let cw = rect ? rect.width : this.widthInp
            let ch = rect ? rect.height : this.heightInp
            let gw = maxX - minX + padding * 2
            let gh = maxY - minY + padding * 2
            let zoom = Math.min(cw / gw, ch / gh, 2)
            this.viewport.zoom = zoom
            this.viewport.x = (cw - (maxX + minX) * zoom) / 2
            this.viewport.y = (ch - (maxY + minY) * zoom) / 2
            this.emitViewportChange()
        },
        zoomAtCenter(factor) {
            const currentZoom = this.viewport.zoom
            const zoomMinUse = Math.min(this.zoomMin, currentZoom)
            const newZoom = Math.max(zoomMinUse, Math.min(this.zoomMax, currentZoom * factor))
            const rect = this.$refs.canvas ? this.$refs.canvas.getContainerRect() : null
            const cx = rect ? rect.width / 2 : this.widthInp / 2
            const cy = rect ? rect.height / 2 : this.heightInp / 2
            const vp = this.viewport
            const scale = newZoom / currentZoom
            this.setViewport({
                x: cx - (cx - vp.x) * scale,
                y: cy - (cy - vp.y) * scale,
                zoom: newZoom,
            })
            this.emitViewportChange()
        },
        zoomIn() {
            this.zoomAtCenter(1.2)
        },
        zoomOut() {
            this.zoomAtCenter(1 / 1.2)
        },
        toggleInteractive() {
            this.locked = !this.locked
            this.$emit('toggle-interactive', this.locked)
        },
        panToNode(nodeId, opt) {
            opt = opt || {}
            let node = this.nodeById(nodeId)
            if (!node) return false
            let internals = this.nodeInternals[nodeId]
            let w = (internals && internals.width) || node.width || 150
            let h = (internals && internals.height) || node.height || 40
            let cx = node.position.x + w / 2
            let cy = node.position.y + h / 2
            let rect = this.$refs.canvas ? this.$refs.canvas.getContainerRect() : null
            let cw = (rect && rect.width) || this.widthInp
            let ch = (rect && rect.height) || this.heightInp
            let zoom = opt.zoom !== undefined ? opt.zoom : this.viewport.zoom
            let duration = opt.duration !== undefined ? opt.duration : 400
            let target = { x: cw / 2 - cx * zoom, y: ch / 2 - cy * zoom, zoom }
            if (this._panAnimId) {
                cancelAnimationFrame(this._panAnimId)
                this._panAnimId = null
            }
            let finish = () => {
                this.setViewport(target)
                this.emitViewportChange()
                if (opt.openPopup === true) {
                    this.$nextTick(() => this.openNodeInfoPopup(nodeId))
                }
            }
            if (!(duration > 0)) {
                finish()
                return true
            }
            let from = { x: this.viewport.x, y: this.viewport.y, zoom: this.viewport.zoom }
            let easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
            let startTs = null
            let stepFrame = (ts) => {
                if (startTs === null) startTs = ts
                let t = Math.min((ts - startTs) / duration, 1)
                let k = easeInOutCubic(t)
                this.setViewport({
                    x: from.x + (target.x - from.x) * k,
                    y: from.y + (target.y - from.y) * k,
                    zoom: from.zoom + (target.zoom - from.zoom) * k,
                })
                if (t < 1) {
                    this._panAnimId = requestAnimationFrame(stepFrame)
                }
                else {
                    this._panAnimId = null
                    finish()
                }
            }
            this._panAnimId = requestAnimationFrame(stepFrame)
            return true
        },
        openNodeInfoPopup(nodeId) {
            let r = this.$refs.nodeRenderer
            if (!r) return false
            return r.openNodeInfoPopup(nodeId)
        },
        openConnInfoPopup(connId) {
            let r = this.$refs.edgeRenderer
            if (!r) return false
            return r.openConnInfoPopup(connId)
        },
        getFlowData() {
            return {
                nodes: JSON.parse(JSON.stringify(this.nodes)),
                conns: JSON.parse(JSON.stringify(this.conns)),
            }
        },
    },
}
</script>

<style scoped>


</style>

<!-- 建線期間之全域規則(非scoped: 目標元素位於深層子元件, scoped 之 data-v 屬性搆不到);
     一律錨定於根 class .vue-flow--connecting 之下, 只影響建線中的 flow 實例,
     取代原 document.head 注入之 * 全域選擇器(污染整頁與其他 flow 實例, 且拋錯時殘留) -->
<style>
/* 鎖游標: 建線期間畫布內一律 default, 僅依把手判定狀態顯示 crosshair/not-allowed */
.vue-flow--connecting,
.vue-flow--connecting * {
  cursor: default !important;
}
/* 出發把手與判定合法之落點: crosshair(可連) */
.vue-flow--connecting .vue-flow__handle[data-connect-role="origin"],
.vue-flow--connecting .vue-flow__handle[data-connect-status="valid"] {
  cursor: crosshair !important;
}
/* 判定不合法之落點, 以及永不可作為落點之 source 把手: not-allowed(不可連) */
.vue-flow--connecting .vue-flow__handle[data-connect-status="invalid"],
.vue-flow--connecting .vue-flow__handle--source:not([data-connect-role="origin"]) {
  cursor: not-allowed !important;
}
/* 建線期間隱藏齒輪/縮放把手/邊轉折點(避免遮擋落點與誤觸; waypoint與齒輪縮放同屬元素專屬操作) */
.vue-flow--connecting .vue-flow__node-settings,
.vue-flow--connecting .vue-flow__edge-settings,
.vue-flow--connecting .vue-flow__resize,
.vue-flow--connecting .vue-flow__edge-waypoint {
  opacity: 0 !important;
  pointer-events: none !important;
}

/* ─── 複選模式(根class .vue-flow--multiselecting): 按住複選鍵=進行複選操作 ───
   統一隱藏所有「元素專屬操作」affordance(節點齒輪/四角縮放/連出入把手/邊齒輪/邊轉折點):
   複選中點擊之語義一律為選取, 不得依點中部位給出不同反應(sole-select/開popup/啟動手勢)。
   visibility:hidden 併用: pointer-events:none 擋不住鍵盤焦點(WPopup trigger帶tabindex)與程式化click,
   visibility同時將其移出tab order; 程式層另有守衛為縱深。
   建線手勢進行中(.vue-flow--connecting)把手讓位不隱藏——拖線中按住複選鍵不得使落點把手消失 */
.vue-flow--multiselecting .vue-flow__node-settings-anchor,
.vue-flow--multiselecting .vue-flow__edge-settings-anchor,
.vue-flow--multiselecting .vue-flow__resize-group,
.vue-flow--multiselecting .vue-flow__edge-waypoint,
.vue-flow--multiselecting:not(.vue-flow--connecting) .vue-flow__handle {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
</style>
