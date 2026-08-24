/**
 * 錨點政策(anchor policy)—— 連接點方位語義之單一來源。
 *
 * 語義分層(Auto/Fixed 中間介面):
 * - Fixed: conn 自帶 fromPosition/toPosition, 永遠優先(逐邊明確固定)。
 * - Auto:  conn 不帶該端方位, 動態跟隨 節點設定 → defNode 設定 → 內建預設。
 *
 * 解析順序(正式契約):
 *   source 端: conn.fromPosition → sourceNode.toPosition → defNode.toPosition → 'bottom'
 *   target 端: conn.toPosition   → targetNode.fromPosition → defNode.fromPosition → 'top'
 *
 * why 單一來源: 此規則先前散落於 EdgeWrapper / DefaultNode / InputNode / OutputNode / geometry
 * 五處且彼此不一致(EdgeWrapper 漏看 defNode, 造成 defNodeToPosition 設定下「把手畫在 right、
 * 邊卻從 bottom 出發」之分家), 規則一變要改五處, 漏一處即為下一個隱性 bug。
 *
 * why Auto/Fixed 以「把手綁定」宣告而非「方位比較」推測: 方位相等是結果不是意圖——
 * 使用者可能明確選了恰好等於預設的方位; 且既有邊全為 Fixed 時預設把手可能不在畫面上,
 * 「唯一把手=預設」之假設不成立。故由把手自身宣告 binding(預設把手=auto, 逐邊固定把手=fixed),
 * 建線持久化只看 binding。
 */

export const SOURCE_FALLBACK = 'bottom'
export const TARGET_FALLBACK = 'top'

/** 節點之有效 source 方位(Auto 邊之出發側; 不含 conn 層) */
export function nodeSourceSide(node, defNode) {
    const n = node || {}
    const d = defNode || {}
    return n.toPosition || d.toPosition || SOURCE_FALLBACK
}

/** 節點之有效 target 方位(Auto 邊之進入側; 不含 conn 層) */
export function nodeTargetSide(node, defNode) {
    const n = node || {}
    const d = defNode || {}
    return n.fromPosition || d.fromPosition || TARGET_FALLBACK
}

/**
 * 解析一條邊之 source 端錨點。
 * @returns {{ side: string, binding: 'auto'|'fixed', origin: 'edge'|'node'|'configured-default'|'builtin-default' }}
 */
export function resolveSourceAnchor(conn, sourceNode, defNode) {
    const c = conn || {}
    if (c.fromPosition) {
        return { side: c.fromPosition, binding: 'fixed', origin: 'edge' }
    }
    const n = sourceNode || {}
    if (n.toPosition) {
        return { side: n.toPosition, binding: 'auto', origin: 'node' }
    }
    const d = defNode || {}
    if (d.toPosition) {
        return { side: d.toPosition, binding: 'auto', origin: 'configured-default' }
    }
    return { side: SOURCE_FALLBACK, binding: 'auto', origin: 'builtin-default' }
}

/**
 * 解析一條邊之 target 端錨點。
 * @returns {{ side: string, binding: 'auto'|'fixed', origin: string }}
 */
export function resolveTargetAnchor(conn, targetNode, defNode) {
    const c = conn || {}
    if (c.toPosition) {
        return { side: c.toPosition, binding: 'fixed', origin: 'edge' }
    }
    const n = targetNode || {}
    if (n.fromPosition) {
        return { side: n.fromPosition, binding: 'auto', origin: 'node' }
    }
    const d = defNode || {}
    if (d.fromPosition) {
        return { side: d.fromPosition, binding: 'auto', origin: 'configured-default' }
    }
    return { side: TARGET_FALLBACK, binding: 'auto', origin: 'builtin-default' }
}

/**
 * 節點應顯示之 source 把手集合。
 * 規則: 預設 Auto 把手永遠存在且排最前(否則既有邊全為 Fixed 時, 使用者無把手可拉 Auto 邊);
 *       各出邊之 Fixed 錨點(≠預設側)為附加之 fixed 把手;
 *       Fixed 錨點恰為預設側時共用同一把手(視覺同位, 新拖出的邊仍為 Auto)。
 * @returns {Array<{ side: string, binding: 'auto'|'fixed' }>}
 */
export function sourceHandleSides(node, conns, defNode) {
    const def = nodeSourceSide(node, defNode)
    const out = [{ side: def, binding: 'auto' }]
    const id = node && node.id
    for (const c of (conns || [])) {
        if (!c || c.from !== id || !c.fromPosition) continue
        if (c.fromPosition === def) continue
        if (out.some(h => h.side === c.fromPosition)) continue
        out.push({ side: c.fromPosition, binding: 'fixed' })
    }
    return out
}

/** 節點應顯示之 target 把手集合(規則對稱 sourceHandleSides) */
export function targetHandleSides(node, conns, defNode) {
    const def = nodeTargetSide(node, defNode)
    const out = [{ side: def, binding: 'auto' }]
    const id = node && node.id
    for (const c of (conns || [])) {
        if (!c || c.to !== id || !c.toPosition) continue
        if (c.toPosition === def) continue
        if (out.some(h => h.side === c.toPosition)) continue
        out.push({ side: c.toPosition, binding: 'fixed' })
    }
    return out
}

/**
 * basic 節點之出入點是否落在同一側(供 geometry 之 same-side 錯開佈局)。
 * 併入 defNode 層, 與把手/邊解析同一基準(修正先前 geometry 只看 node 層之不一致)。
 */
export function nodeSameSide(node, defNode) {
    const n = node || {}
    if (n.type !== 'basic') return false
    return nodeSourceSide(n, defNode) === nodeTargetSide(n, defNode)
}
