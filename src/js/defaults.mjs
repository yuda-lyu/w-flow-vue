/**
 * Default values for node and connection properties.
 */

export const NODE_DEFAULTS = {
    shape: 'rectangle',
    width: 100,
    height: 40,
    fontSize: 12,
    fontSizeMin: 1,
    fontSizeMax: 72,
    fontColor: '#333333',
    faceColor: '#ffffff',
    edgeColor: '#bbbbbb',
    edgeWidth: 1,
    popupDirection: 'right',
    //連接點(把手)樣式: 節點四邊中點各一, 無連出/連入之分, 故單一組樣式
    //Size 為外徑(含框線, box-sizing:border-box)
    handleFaceColor: '#555555',
    handleEdgeColor: '#ffffff',
    handleEdgeWidth: 1,
    handleSize: 10,
}

export const CONN_DEFAULTS = {
    type: 'bezier',
    fontSize: 10,
    fontSizeMin: 1,
    fontSizeMax: 72,
    fontColor: '#333333',
    edgeColor: '#b1b1b1',
    edgeWidth: 1,
    //兩端方位(邊自己持有; 未給時之預設)
    fromPosition: 'bottom',
    toPosition: 'top',
    //兩端箭頭: type '' | 'arrow' | 'arrowclosed'; size px; color 為實心箭頭之填充色(未給即線色)
    markerStart: '',
    markerStartSize: 10,
    markerStartColor: '',
    markerEnd: '',
    markerEndSize: 10,
    markerEndColor: '',
    animated: false,
    defOffset: 24,
}

/** 設定齒輪顯示方式 */
export const SETTINGS_TRIGGERS = ['hover', 'click', 'dblclick']

/** dblclick 模式下, 單擊之資訊 popup 延後開啟之雙擊判定窗(ms): 期間收到 dblclick 即取消 */
export const INFO_POPUP_DEFER_MS = 250

/** 設定表單之線寬上限(節點外框/連線線寬共用) */
export const EDGE_WIDTH_MAX = 24

/** 節點設定更新入口受理之欄位(schema allowlist): 已移除之 type / toPosition / fromPosition 不在其中 */
export const NODE_SETTING_KEYS = [
    'name', 'description', 'shape', 'popupDirection', 'fontSize', 'fontColor', 'faceColor', 'edgeColor', 'edgeWidth',
    'width', 'height', 'connectable', 'draggable', 'resizable', 'deletable', 'hidden', 'class', 'zIndex',
]

/** 連線設定更新入口受理之欄位(schema allowlist) */
export const CONN_SETTING_KEYS = [
    'name', 'description', 'type', 'fromPosition', 'toPosition', 'fontSize', 'fontColor', 'animated',
    'edgeColor', 'edgeWidth', 'edgeDasharray', 'points', 'curvature',
    'markerStart', 'markerStartSize', 'markerStartColor', 'markerEnd', 'markerEndSize', 'markerEndColor',
    'deletable', 'hidden', 'class', 'style',
]
