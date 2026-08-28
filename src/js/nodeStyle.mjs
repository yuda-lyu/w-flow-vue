/**
 * 節點樣式之共用解析(NodeWrapper 與 NodeBody/把手共用同一基準)
 */
import { sideAnchorFraction } from './shapeAnchor.mjs'
import { resolveNodeSize } from './geometry.mjs'

export const SHAPES = ['rectangle', 'diamond', 'ellipse', 'triangle', 'triangle-right', 'triangle-down', 'triangle-left']

/**
 * 節點有效形狀(單一來源): node.shape → defNode.shape → 'rectangle'; 非法值視為未給。
 * 節點面(NodeFace)、外框判定、把手佈局(NodePorts)、邊端點(geometry)皆須經此解析, 否則 defNodeShape 設定時各層分家。
 */
export function nodeShape(node, defNode) {
    const n = (node && node.shape) || ''
    if (SHAPES.indexOf(n) >= 0) return n
    const d = (defNode && defNode.shape) || ''
    if (SHAPES.indexOf(d) >= 0) return d
    return 'rectangle'
}

export function isTriangleShape(shape) {
    return shape === 'triangle' || shape === 'triangle-right' || shape === 'triangle-down' || shape === 'triangle-left'
}

export function isSvgShape(node, defNode) {
    const s = nodeShape(node, defNode)
    return s !== 'rectangle'
}

/**
 * 節點外框(CSS border)寬度(px): 矩形=節點/預設之 edgeWidth; SVG 形狀(菱形/橢圓/三角)之外框由 SVG stroke 繪製,
 * 容器本身 border 為 0——使 padding box 與外框盒重合, 形狀 stroke、把手圓心、連線端點三者同以外框盒為基準
 */
export function nodeBorderWidth(node, defNode) {
    if (isSvgShape(node, defNode)) return 0
    const d = defNode || {}
    if (node && node.edgeWidth !== undefined) return Number(node.edgeWidth) || 0
    if (d.edgeWidth !== undefined) return Number(d.edgeWidth) || 0
    return 1
}

/**
 * 把手樣式(CSS 變數): 由 defNode 之 handle* 解析, 供 Handle 以 inline style 注入
 * --vf-hs 尺寸 / --vf-hface 面色 / --vf-hedge 框線色 / --vf-hew 框線寬
 */
export function handleStyleVars(defNode) {
    const d = defNode || {}
    return {
        '--vf-hs': (d.handleSize !== undefined && d.handleSize !== null ? d.handleSize : 10) + 'px',
        '--vf-hface': d.handleFaceColor || '#555555',
        '--vf-hedge': d.handleEdgeColor || '#ffffff',
        '--vf-hew': (d.handleEdgeWidth !== undefined && d.handleEdgeWidth !== null ? d.handleEdgeWidth : 1) + 'px',
    }
}

/**
 * 把手定位(inline style): 圓心 = 節點外框盒上 sideAnchorFraction 所指之點(與 geometry.getHandlePosition 同一 fraction)。
 * 把手為節點 padding box 內之絕對定位元素, 以百分比取 fraction, 落在外框盒邊上者再外推節點外框寬(nodeBorder);
 * translate(-50%,-50%) 置中, 故 hover 放大時圓心不動。
 */
export function handlePlacementStyle(shape, side, nodeBorder) {
    const f = sideAnchorFraction(shape, side)
    const b = Number(nodeBorder) || 0
    const px = (v) => `${(v * 100).toFixed(4).replace(/\.?0+$/, '')}%`
    const shift = (v) => (v === 0 ? -b : (v === 1 ? b : 0))
    const left = shift(f.fx) ? `calc(${px(f.fx)} + ${shift(f.fx)}px)` : px(f.fx)
    const top = shift(f.fy) ? `calc(${px(f.fy)} + ${shift(f.fy)}px)` : px(f.fy)
    return { left, top, transform: 'translate(-50%, -50%)' }
}

/**
 * 三角形節點之文字位移(往形狀重心方向): 使 label 落在三角形內部而非外接矩形中心
 */
export function labelOffsetStyle(node, defNode) {
    const s = nodeShape(node, defNode)
    if (!isTriangleShape(s)) return null
    const { width: w, height: h } = resolveNodeSize(node, null, defNode)
    let x = 0
    let y = 0
    if (s === 'triangle-right') x = Math.round(-w / 6)
    else if (s === 'triangle-down') y = Math.round(-h / 6)
    else if (s === 'triangle-left') x = Math.round(w / 6)
    else y = Math.round(h / 6)
    return { transform: `translate(${x}px, ${y}px)` }
}
