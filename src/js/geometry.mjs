import { nodeShape } from './nodeStyle.mjs'

/**
 * 連接點幾何 —— 單一事實來源(把手渲染 nodeStyle.handlePlacementStyle 與邊端點 getHandlePosition 同用 sideAnchorFraction)。
 *
 * 契約(spec/流程_互動契約.md §4.1): 節點四邊各一連接點, 位於形狀「該邊」之中點——
 *   矩形/菱形/橢圓: 外接矩形四邊中點(菱形為四頂點, 橢圓為四極點)
 *   三角形: 頂點所在邊=頂點; 底邊=底邊中點; 兩斜邊=斜邊中點(仍落在外接矩形之 1/4 或 3/4 處)
 * 射出方向恆為外接矩形該邊之法向量(由 side 決定, 與點位無關), 三角形斜邊上之連接點亦水平/垂直射出。
 */

const RECT_FRACTION = {
    top: { fx: 0.5, fy: 0 },
    right: { fx: 1, fy: 0.5 },
    bottom: { fx: 0.5, fy: 1 },
    left: { fx: 0, fy: 0.5 },
}
//三角形: 斜邊中點落在外接矩形之 1/4、3/4(上下向三角形斜邊在左右; 左右向三角形斜邊在上下)
const TRI_VERTICAL_FRACTION = { ...RECT_FRACTION, left: { fx: 0.25, fy: 0.5 }, right: { fx: 0.75, fy: 0.5 } }
const TRI_HORIZONTAL_FRACTION = { ...RECT_FRACTION, top: { fx: 0.5, fy: 0.25 }, bottom: { fx: 0.5, fy: 0.75 } }

/**
 * 形狀 × 邊 → 連接點於外接矩形之比例座標 { fx, fy } ∈ [0,1]
 */
export function sideAnchorFraction(shape, side) {
    let table = RECT_FRACTION
    if (shape === 'triangle' || shape === 'triangle-down') table = TRI_VERTICAL_FRACTION
    else if (shape === 'triangle-right' || shape === 'triangle-left') table = TRI_HORIZONTAL_FRACTION
    return table[side] || table.bottom
}

/**
 * 節點某邊連接點之畫布絕對座標(邊端點與把手圓心同一基準)。
 * @param {Object} node
 * @param {string} side 'top'|'right'|'bottom'|'left'
 * @param {Object} [nodeInternals] 量測尺寸 { width, height }(優先於 node.width/height)
 * @param {Object} [defNode] 節點預設(形狀之 defNode 層, 經 nodeStyle.nodeShape 單一解析)
 */
export function getHandlePosition(node, side, nodeInternals, defNode) {
    const internals = nodeInternals || {}
    const w = (internals.width) || node.width || 150
    const h = (internals.height) || node.height || 40
    const f = sideAnchorFraction(nodeShape(node, defNode), side)
    return { x: node.position.x + w * f.fx, y: node.position.y + h * f.fy }
}

/**
 * Get all nodes that overlap with a given rectangle.
 */
export function getOverlappingNodes(rect, nodes, nodeInternals) {
    return nodes.filter(node => {
        const internals = (nodeInternals && nodeInternals[node.id]) || {}
        const w = internals.width || node.width || 150
        const h = internals.height || node.height || 40
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
