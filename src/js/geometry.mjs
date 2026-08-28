import { nodeShape } from './nodeStyle.mjs'
import { sideAnchorFraction } from './shapeAnchor.mjs'
import { NODE_DEFAULTS } from './defaults.mjs'

/**
 * 節點某邊連接點之畫布絕對座標(邊端點與把手圓心同一基準)。
 * @param {Object} node
 * @param {string} side 'top'|'right'|'bottom'|'left'
 * @param {Object} [nodeInternals] 量測尺寸 { width, height }(優先於 node.width/height)
 * @param {Object} [defNode] 節點預設(形狀之 defNode 層, 經 nodeStyle.nodeShape 單一解析)
 */
export function getHandlePosition(node, side, nodeInternals, defNode) {
    const { width: w, height: h } = resolveNodeSize(node, nodeInternals, defNode)
    const f = sideAnchorFraction(nodeShape(node, defNode), side)
    return { x: node.position.x + w * f.fx, y: node.position.y + h * f.fy }
}

/**
 * 節點有效尺寸 —— 單一事實來源(幾何/路由/fit/形狀面/佈局共用同一優先序)。
 * 優先序: 實測尺寸(live: 量測或進行中 ghost, 須為正數)→ 節點明確數值 → defNode(opt.defNodeWidth/Height)→ NODE_DEFAULTS。
 * 佈局(CSS width/height)不得把實測值回寫為尺寸來源, 故呼叫端傳 live=null 即取「宣告尺寸」。
 * @param {Object} node
 * @param {Object|null} [live] { width, height } 實測或 ghost
 * @param {Object} [defNode]
 * @returns {{ width: number, height: number }}
 */
export function resolveNodeSize(node, live, defNode) {
    const n = node || {}
    const l = live || {}
    const d = defNode || {}
    const pos = (v) => (typeof v === 'number' && isFinite(v) && v > 0) ? v : null
    const width = pos(l.width) || pos(n.width) || pos(d.width) || NODE_DEFAULTS.width
    const height = pos(l.height) || pos(n.height) || pos(d.height) || NODE_DEFAULTS.height
    return { width, height }
}

/**
 * Get all nodes that overlap with a given rectangle.
 */
export function getOverlappingNodes(rect, nodes, nodeInternals, defNode) {
    return nodes.filter(node => {
        const { width: w, height: h } = resolveNodeSize(node, nodeInternals && nodeInternals[node.id], defNode)
        const nodeRect = {
            x: node.position.x,
            y: node.position.y,
            width: w,
            height: h,
        }
        return rectsOverlap(rect, nodeRect)
    })
}

/**
 * Check if two rectangles overlap.
 */
function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
    )
}

/**
 * Clamp a position within a coordinate extent.
 */
export function clampPosition(position, extent) {
    if (!extent) return position
    return {
        x: Math.max(extent[0][0], Math.min(extent[1][0], position.x)),
        y: Math.max(extent[0][1], Math.min(extent[1][1], position.y)),
    }
}

/**
 * Snap a position to the nearest grid point.
 * @param {{ x: number, y: number }} position
 * @param {number|null} gridSize - Grid cell size (single number for both axes)
 */
export function snapPosition(position, gridSize) {
    if (!gridSize) return position
    return {
        x: Math.round(position.x / gridSize) * gridSize,
        y: Math.round(position.y / gridSize) * gridSize,
    }
}

/**
 * 四角縮放代數(NodeWrapper 縮放手勢之純計算): 右/下角改寬高, 左/上角以對邊固定(位置隨之移動)。
 * @param {'top-left'|'top-right'|'bottom-left'|'bottom-right'} edge
 * @param {{x:number,y:number,width:number,height:number}} start 起始幾何
 * @param {{dx:number,dy:number}} delta 畫布座標位移
 * @param {{snap?:number,minSize?:number}} [opt] snap>0 時尺寸吸附格線(最小一格), 否則最小 minSize
 * @returns {{width:number,height:number,x:number,y:number}}
 */
export function computeResize(edge, start, delta, opt) {
    const o = opt || {}
    const snap = o.snap || 0
    const minSize = o.minSize || 10
    const snapVal = (v) => snap ? Math.max(snap, Math.round(v / snap) * snap) : Math.max(minSize, Math.round(v))
    const dx = delta.dx || 0
    const dy = delta.dy || 0
    let width = start.width
    let height = start.height
    let x = start.x
    let y = start.y
    const left = edge === 'top-left' || edge === 'bottom-left'
    const top = edge === 'top-left' || edge === 'top-right'
    if (left) {
        width = snapVal(start.width - dx)
        x = start.x + (start.width - width)
    }
    else width = snapVal(start.width + dx)
    if (top) {
        height = snapVal(start.height - dy)
        y = start.y + (start.height - height)
    }
    else height = snapVal(start.height + dy)
    return { width, height, x, y }
}
