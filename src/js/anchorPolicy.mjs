/**
 * 錨點方位 —— 單一事實來源是「節點」(spec/流程_互動契約.md §4)。
 *
 * 節點決定自己的連出/連入方向; 邊沒有自己的方位: 邊的兩端就是兩端節點之把手所在側, 方向垂直於該節點邊。
 * 解析順序(正式契約):
 *   source 端(連出): sourceNode.toPosition → defNode.toPosition → 'bottom'
 *   target 端(連入): targetNode.fromPosition → defNode.fromPosition → 'top'
 *
 * 邊資料不含方位欄位; 方位只由節點決定, 故本模組只有節點層之解析。
 *
 * why 單一來源在此: 此規則先前散落於 EdgeWrapper / DefaultNode / InputNode / OutputNode / geometry 五處且彼此不一致
 * (EdgeWrapper 漏看 defNode, 造成「把手畫在 right、邊卻從 bottom 出發」之分家), 規則一變要改五處, 漏一處即為下一個隱性 bug。
 */

export const SOURCE_FALLBACK = 'bottom'
export const TARGET_FALLBACK = 'top'

/**
 * 節點之有效型別(單一來源): node.type → defNode.type → 'basic'。
 * 渲染(NodeBody/NodeWrapper)、設定表單、same-side 判定、建線之 input/output 判定皆須經此解析,
 * 否則缺省 type 之節點會在各處被解讀成不同型別(把手畫在 33%/67% 而邊端點算在 50%)。
 */
export function nodeType(node, defNode) {
    const n = node || {}
    const d = defNode || {}
    return n.type || d.type || 'basic'
}

/** 節點之連出側(source 把手所在側 = 其出邊之出發側) */
export function nodeSourceSide(node, defNode) {
    const n = node || {}
    const d = defNode || {}
    return n.toPosition || d.toPosition || SOURCE_FALLBACK
}

/** 節點之連入側(target 把手所在側 = 其入邊之進入側) */
export function nodeTargetSide(node, defNode) {
    const n = node || {}
    const d = defNode || {}
    return n.fromPosition || d.fromPosition || TARGET_FALLBACK
}

/**
 * basic 節點之出入點是否落在同一側(供 geometry 與把手佈局之 same-side 錯開: 入 33% / 出 67%)。
 * 併入 defNode 層, 與把手/邊解析同一基準。
 */
export function nodeSameSide(node, defNode) {
    if (nodeType(node, defNode) !== 'basic') return false
    return nodeSourceSide(node, defNode) === nodeTargetSide(node, defNode)
}
