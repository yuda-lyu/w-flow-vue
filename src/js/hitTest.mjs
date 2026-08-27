/**
 * 互動 hit 分類(純函式, 以 flow root 為界)。契約見 spec/流程_互動契約.md §3。
 *
 * 用途(刻意縮小, 非中央事件派送器):
 * - WFlowVue 之畫布層 handler(平移/框選/pane-click/canvas-dblclick/pane-context-menu)判斷「是否按在畫布空白」;
 * - Node/EdgeWrapper 判斷「點擊類事件是否落在 affordance 上」(affordance 不代表宿主元素發 click/dblclick/contextmenu)。
 * 各元件既有之 .stop / dragHandle / nodrag / 互動元素規則維持在元件內, 不由此取代。
 *
 * popup 為 Teleport overlay(不在 flow DOM 內), 不在本分類之列; 呼叫端另以 isPopupTarget 判斷。
 */

//由內而外: affordance 先於容器(gear anchor 內含 WPopup trigger, resize/handle 位於 node 內, waypoint/label 位於 edge 內)
const ORDER = [
    ['panel', '.vue-flow__panel'],
    ['node-gear', '.vue-flow__node-settings-anchor, .vue-flow__node-settings'],
    ['edge-gear', '.vue-flow__edge-settings-anchor, .vue-flow__edge-settings'],
    ['resize', '.vue-flow__resize'],
    ['handle', '.vue-flow__handle'],
    ['waypoint', '.vue-flow__edge-waypoint'],
    ['node', '.vue-flow__node'],
    ['edge', '.vue-flow__edge'],
]

const AFFORDANCE = new Set(['panel', 'node-gear', 'edge-gear', 'resize', 'handle', 'waypoint'])

/**
 * @param {EventTarget|null} target
 * @param {Element|null} [flowRoot] 本 flow 實例之根元素; 給定時, 命中元素須位於其內(巢狀/多實例時不撿到他 flow 之元素)
 * @returns {'panel'|'node-gear'|'edge-gear'|'resize'|'handle'|'waypoint'|'node'|'edge'|'canvas'}
 */
export function classifyHit(target, flowRoot) {
    if (!target || typeof target.closest !== 'function') return 'canvas'
    for (const [kind, sel] of ORDER) {
        const el = target.closest(sel)
        if (el && (!flowRoot || flowRoot.contains(el))) return kind
    }
    return 'canvas'
}

/** affordance(gear/resize/handle/waypoint/panel): 其點擊類事件不代表宿主元素或畫布 */
export function isAffordanceHit(kind) {
    return AFFORDANCE.has(kind)
}

/** 畫布層手勢(平移/框選/pane-click)之目標排除: 非畫布空白即排除 */
export function isCanvasBlank(target, flowRoot) {
    return classifyHit(target, flowRoot) === 'canvas'
}
