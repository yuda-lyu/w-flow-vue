/**
 * 節點樣式之共用解析(NodeWrapper 與各節點元件/把手共用同一基準)
 */

export function isSvgShape(node) {
    const s = node && node.shape
    return s === 'diamond' || s === 'ellipse' || s === 'triangle' || s === 'triangle-right' || s === 'triangle-down' || s === 'triangle-left'
}

/**
 * 節點外框(CSS border)寬度(px): 矩形=節點/預設之 edgeWidth; SVG 形狀(菱形/橢圓/三角)之外框由 SVG stroke 繪製,
 * 容器本身 border 為 0——使 padding box 與外框盒重合, 形狀 stroke、把手圓心、連線端點三者同以外框盒為基準
 */
export function nodeBorderWidth(node, defNode) {
    if (isSvgShape(node)) return 0
    const d = defNode || {}
    if (node && node.edgeWidth !== undefined) return Number(node.edgeWidth) || 0
    if (d.edgeWidth !== undefined) return Number(d.edgeWidth) || 0
    return 1
}

/**
 * 把手樣式(CSS 變數): 由 defNode 之 handleSource* 與 handleTarget* 解析, 供 Handle 以 inline style 注入
 * --vf-hs 尺寸 / --vf-hface 面色 / --vf-hedge 框線色 / --vf-hew 框線寬 / --vf-hb 節點外框寬(定位扣除量)
 */
export function handleStyleVars(type, defNode, nodeBorder) {
    const d = defNode || {}
    const k = type === 'target' ? 'handleTarget' : 'handleSource'
    const size = d[k + 'Size']
    const ew = d[k + 'EdgeWidth']
    return {
        '--vf-hs': (size !== undefined && size !== null ? size : 10) + 'px',
        '--vf-hface': d[k + 'FaceColor'] || (type === 'target' ? '#ffffff' : '#555555'),
        '--vf-hedge': d[k + 'EdgeColor'] || (type === 'target' ? '#1a1918' : '#ffffff'),
        '--vf-hew': (ew !== undefined && ew !== null ? ew : 1) + 'px',
        '--vf-hb': (nodeBorder || 0) + 'px',
    }
}
