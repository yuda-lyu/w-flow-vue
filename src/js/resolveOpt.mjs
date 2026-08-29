/**
 * opt 解析 —— 單一來源。WFlowVue 之每個 opt 鍵對應一個 computed(名稱即鍵名, 由 OPT_SPEC 生成),
 * 不再逐鍵手寫 fallback 樣板; 群組型(defNode / defConn / settingsText / menu)以具名解析函式提供。
 *
 * kind(回退規則, 依 JSDoc 契約逐鍵指定):
 *   defined  : opt 值 !== undefined 即採用(布林/數值 0 為合法值)
 *   truthy   : opt 值為 truthy 即採用(空字串/0/null 回退)
 *   enum     : 值須在 values 內, 否則回退
 *   nonneg   : 有限且 >= 0 之數值, 否則回退
 *   padding  : 非負數值或 { top,right,bottom,left } 物件, 逐邊正規化(非法之邊回退 def)
 *   notFalse : 只有明確 false 才關閉(預設開)
 *   nullable : truthy 即採用, 否則 null
 *   fn       : 須為函式, 否則 null
 */
import { NODE_DEFAULTS, CONN_DEFAULTS, SETTINGS_TRIGGERS } from './defaults.mjs'
import { resolvePadding } from './viewport.mjs'

export const OPT_SPEC = {
    //尺寸
    widthInp: { key: 'width', kind: 'truthy', def: 800 },
    heightInp: { key: 'height', kind: 'truthy', def: 600 },
    //互動能力
    nodesDraggable: { kind: 'defined', def: true },
    nodesConnectable: { kind: 'defined', def: true },
    nodesResizable: { kind: 'defined', def: true },
    elementsSelectable: { kind: 'defined', def: true },
    selectNodesOnDrag: { kind: 'defined', def: true },
    multiSelectEnabled: { kind: 'defined', def: true },
    boxSelectionKeyCode: { kind: 'truthy', def: 'Shift' },
    multiSelectionKeyCode: { kind: 'truthy', def: 'Shift' },
    deleteKeyEnabled: { kind: 'defined', def: false },
    deleteKeyCode: { kind: 'truthy', def: 'Backspace' },
    snapToGrid: { kind: 'defined', def: false },
    snapGridSize: { kind: 'truthy', def: 20 },
    //設定入口: 'hover' | 'click' | 'dblclick'(非法值回退 dblclick)
    nodesSettingsEnabled: { kind: 'defined', def: true },
    connsSettingsEnabled: { kind: 'defined', def: true },
    nodesSettingsTrigger: { kind: 'enum', values: SETTINGS_TRIGGERS, def: 'dblclick' },
    connsSettingsTrigger: { kind: 'enum', values: SETTINGS_TRIGGERS, def: 'dblclick' },
    nodesSettingsExcludes: { kind: 'truthy', def: [] },
    connsSettingsExcludes: { kind: 'truthy', def: [] },
    //視口
    zoomOnScroll: { kind: 'defined', def: true },
    panOnDrag: { kind: 'defined', def: true },
    zoomMin: { kind: 'defined', def: 0.5 },
    zoomMax: { kind: 'defined', def: 2 },
    zoom: { kind: 'defined', def: 1 },
    center: { kind: 'truthy', def: [0, 0] },
    panLimits: { kind: 'nullable' },
    fitViewOnInit: { kind: 'notFalse' },
    fitViewPadding: { kind: 'padding', def: 50 },
    //建線預覽線
    defConnCreatingType: { kind: 'truthy', def: 'bezier' },
    defConnCreatingEdgeColor: { kind: 'truthy', def: CONN_DEFAULTS.edgeColor },
    defConnCreatingEdgeWidth: { kind: 'defined', def: 1 },
    defConnCreatingEdgeDasharray: { kind: 'truthy', def: '5 5' },
    //畫布背景
    platformBackgroundPatternType: { kind: 'truthy', def: 'dots' },
    platformBackgroundPatternGap: { kind: 'defined', def: 20 },
    platformBackgroundPatternSize: { kind: 'defined', def: 1 },
    platformBackgroundPatternColor: { kind: 'truthy', def: '#81818a' },
    platformBackgroundColor: { kind: 'truthy', def: '#fff' },
    //popup 樣式
    settingsPopupBackgroundColor: { kind: 'truthy', def: '#fff' },
    settingsPopupTextColor: { kind: 'truthy', def: '#333' },
    settingsPopupTextFontSize: { kind: 'truthy', def: '12px' },
    inforPopupBackgroundColor: { kind: 'truthy', def: '#fff' },
    inforPopupTitleTextColor: { kind: 'truthy', def: '#333' },
    inforPopupTitleTextFontSize: { kind: 'truthy', def: '12px' },
    inforPopupDescriptionTextColor: { kind: 'truthy', def: '#888' },
    inforPopupDescriptionTextFontSize: { kind: 'truthy', def: '10px' },
    //callback
    funValidConnCreating: { kind: 'nullable' },
    //刪除確認(async): 未提供即直接刪除, 提供則須回傳 true 才真的刪除
    funConfirmDeleting: { kind: 'fn' },
}

/** 依 OPT_SPEC 解析單一鍵 */
export function resolveOptValue(opt, name) {
    const spec = OPT_SPEC[name]
    if (!spec) throw new Error(`resolveOpt: unknown opt name '${name}'`)
    const v = (opt || {})[spec.key || name]
    switch (spec.kind) {
    case 'defined': return v !== undefined ? v : spec.def
    case 'truthy': return v || spec.def
    case 'enum': return spec.values.indexOf(v) >= 0 ? v : spec.def
    case 'nonneg': return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : spec.def
    case 'padding': return resolvePadding(v, spec.def)
    case 'notFalse': return v !== false
    case 'nullable': return v || null
    case 'fn': return typeof v === 'function' ? v : null
    default: throw new Error(`resolveOpt: unknown kind '${spec.kind}'`)
    }
}

/** 全部純量鍵一次解析(測試/除錯用; 元件內以 optComputeds 逐鍵 computed, 避免整包失效) */
export function resolveOpt(opt) {
    const r = {}
    for (const name of Object.keys(OPT_SPEC)) r[name] = resolveOptValue(opt, name)
    return r
}

/** 供 Vue computed 展開: 每個 OPT_SPEC 鍵一個 computed(讀 this.opt) */
export function optComputeds() {
    const c = {}
    for (const name of Object.keys(OPT_SPEC)) {
        c[name] = function() {
            return resolveOptValue(this.opt, name)
        }
    }
    return c
}

/** 設定表單可改文字(非字串或空字串回退預設) */
export function resolveSettingsText(opt) {
    const o = opt || {}
    const str = (v, d) => (typeof v === 'string' && v !== '' ? v : d)
    return {
        nodeDelete: str(o.nodesSettingsDeleteText, 'Delete'),
        connDelete: str(o.connsSettingsDeleteText, 'Delete'),
        colorConfirm: str(o.settingsColorConfirmText, 'Confirm'),
    }
}

/** 節點預設(opt.defNode* / opt.defHandle* → NODE_DEFAULTS); 數值型以 !== undefined 判斷(0 為合法之框線寬) */
export function resolveDefNode(opt) {
    const o = opt || {}
    const d = NODE_DEFAULTS
    return {
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
        popupDirection: o.defNodePopupDirection || d.popupDirection,
        //連接點(把手)樣式(四把手同一組)
        handleFaceColor: o.defHandleFaceColor || d.handleFaceColor,
        handleEdgeColor: o.defHandleEdgeColor || d.handleEdgeColor,
        handleEdgeWidth: o.defHandleEdgeWidth !== undefined ? o.defHandleEdgeWidth : d.handleEdgeWidth,
        handleSize: o.defHandleSize || d.handleSize,
    }
}

/** 連線預設(opt.defConn* → CONN_DEFAULTS): 兩端方位/箭頭/animated/step offset 皆在此 */
export function resolveDefConn(opt) {
    const o = opt || {}
    const d = CONN_DEFAULTS
    return {
        type: o.defConnType || d.type,
        fontSize: o.defConnFontSize || d.fontSize,
        fontSizeMin: o.defConnFontSizeMin || d.fontSizeMin,
        fontSizeMax: o.defConnFontSizeMax || d.fontSizeMax,
        fontColor: o.defConnFontColor || d.fontColor,
        edgeColor: o.defConnEdgeColor || d.edgeColor,
        edgeWidth: o.defConnEdgeWidth !== undefined ? o.defConnEdgeWidth : d.edgeWidth,
        edgeDasharray: o.defConnEdgeDasharray || '',
        fromPosition: o.defConnFromPosition || d.fromPosition,
        toPosition: o.defConnToPosition || d.toPosition,
        markerStart: o.defConnMarkerStart || d.markerStart,
        markerStartSize: o.defConnMarkerStartSize || d.markerStartSize,
        markerStartColor: o.defConnMarkerStartColor || d.markerStartColor,
        markerEnd: o.defConnMarkerEnd || d.markerEnd,
        markerEndSize: o.defConnMarkerEndSize || d.markerEndSize,
        markerEndColor: o.defConnMarkerEndColor || d.markerEndColor,
        animated: o.defConnAnimated !== undefined ? o.defConnAnimated : d.animated,
        defOffset: o.defOffset != null ? o.defOffset : d.defOffset,
    }
}

/**
 * 垂直選單設定: 自 opt 原樣透傳(不套預設)——各項未給或型別不符由 Controls.vue 之 menuDef 回退,
 * 預設值單一來源在 Controls(icon 預設需 @mdi/js 常數), 本模組刻意不複製一份。
 */
export const MENU_OPT_KEYS = [
    'useMenu', 'menuPosition', 'menuYShift', 'useSetting',
    'menuSettingIcon', 'menuSettingTooltip',
    'useMenuItemZoomIn', 'menuZoomInIcon', 'menuZoomInTooltip',
    'useMenuItemZoomOut', 'menuZoomOutIcon', 'menuZoomOutTooltip',
    'useMenuItemFitView', 'menuFitViewIcon', 'menuFitViewTooltip',
    'useMenuItemLock', 'menuLockIcon', 'menuLockTooltip', 'menuLockIconLocked', 'menuLockTooltipLocked',
    'menuIconColor', 'menuIconColorHover', 'menuIconColorFocus', 'menuIconSize',
    'menuBackgroundColor', 'menuBackgroundColorHover', 'menuBackgroundColorFocus',
    'menuSeparatorColor', 'menuShadow',
    'menuTooltipTextColor', 'menuTooltipTextFontSize', 'menuTooltipBackgroundColor',
]
export function pickMenuOpt(opt) {
    const o = opt || {}
    const r = {}
    for (const k of MENU_OPT_KEYS) r[k] = o[k]
    return r
}
