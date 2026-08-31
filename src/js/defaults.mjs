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
    markerFrom: '',
    markerFromSize: 10,
    //箭頭之填色與框色分列(與節點之 faceColor / edgeColor 同一語彙):
    //  FaceColor 為三角形填色, 僅 arrowclosed 有意義(arrow 為線式, fill 恆 none), '' = 線色加深 20%
    //  EdgeColor 為箭頭外框色, arrow 與 arrowclosed 皆有意義, '' = 跟隨線色(既有行為)
    markerFromFaceColor: '',
    markerFromEdgeColor: '',
    markerTo: '',
    markerToSize: 10,
    markerToFaceColor: '',
    markerToEdgeColor: '',
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
    'markerFrom', 'markerFromSize', 'markerFromFaceColor', 'markerFromEdgeColor',
    'markerTo', 'markerToSize', 'markerToFaceColor', 'markerToEdgeColor',
    'deletable', 'hidden', 'class', 'style',
]
