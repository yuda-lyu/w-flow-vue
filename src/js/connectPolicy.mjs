/**
 * 建線可行性政策(framework-free domain)。契約見 spec/流程_互動契約.md §4。
 *
 * - 節點四邊連接點無連出/連入之分: 任一把手皆可出發, 落點為「他節點之任一把手」;
 *   方向 = 出發 → 落點(出發端為 from, 落點端為 to), 兩端方位即各自所在之邊。
 * - 候選 connection 形狀: { from, to, fromPosition, toPosition }; 宿主 validator / connect 事件收同形狀。
 * - preview(拖曳中 hover 判定)與 commit(放開建立)共用同一候選建構與判定器, 相同 endpoint 對必得相同結論。
 * - endpoint descriptor(由 handleDom.mjs 自 DOM 正規化): { nodeId, position, connectable, element }
 * - reason 優先序: no-endpoint → unknown-handle(方位非四值) → self → not-connectable →
 *   圖層級(missing-node → duplicate → custom)。
 */
import { isSide } from './anchorPolicy.mjs'

/**
 * 由出發/落點 endpoint 建構候選 connection(preview 與 commit 共用, 不可各自手組)。
 */
export function buildConnectionCandidate(originEp, targetEp) {
    return {
        from: originEp.nodeId,
        to: targetEp.nodeId,
        fromPosition: originEp.position,
        toPosition: targetEp.position,
    }
}

/**
 * 圖層級判定: connection 對圖(nodes/conns)與 custom validator 是否合法。
 * 回傳 { valid, reason }; reason ∈ 'no-endpoint'|'self'|'missing-node'|'duplicate'|'custom'|null
 */
export function assessGraphConnection(connection, nodes, conns, validator) {
    if (!connection || !connection.from || !connection.to) return { valid: false, reason: 'no-endpoint' }
    //自我連線不允許
    if (connection.from === connection.to) return { valid: false, reason: 'self' }
    //端點必須存在於圖中: 缺任一端即不合法(防 DOM 撿到他 flow/已刪節點之殘影)
    const fromNode = (nodes || []).find(n => n.id === connection.from)
    const toNode = (nodes || []).find(n => n.id === connection.to)
    if (!fromNode || !toNode) return { valid: false, reason: 'missing-node' }
    //同向重複邊不允許(方向圖: A→B 已存在時 B→A 仍允許); 方位不參與判定——邊是節點對之關係, 方位是呈現屬性
    const duplicate = (conns || []).find(e => e.from === connection.from && e.to === connection.to)
    if (duplicate) return { valid: false, reason: 'duplicate' }
    if (validator && !validator(connection)) return { valid: false, reason: 'custom' }
    return { valid: true, reason: null }
}

/**
 * 出發/落點能力層判定; 不可配對時回 { reason }, 可配對回 {}。
 * 順序: no-endpoint → unknown-handle → self → not-connectable。
 */
export function pairEndpoints(origin, target) {
    if (!origin || !target) return { reason: 'no-endpoint' }
    if (!isSide(origin.position) || !isSide(target.position)) return { reason: 'unknown-handle' }
    //同節點之任何把手(含出發把手自身)皆為自我連線
    if (origin.nodeId === target.nodeId) return { reason: 'self' }
    if (origin.connectable === false || target.connectable === false) return { reason: 'not-connectable' }
    return {}
}

/**
 * 完整判定: 能力層 → 候選建構 → 圖層級判定。
 * 回傳 { valid, reason, connection }; connection 於能力層即拒絕時為 null。
 */
export function assessConnection(origin, target, { nodes, conns, validator } = {}) {
    if (!origin || !target) return { valid: false, reason: 'no-endpoint', connection: null }
    const p = pairEndpoints(origin, target)
    if (p.reason) return { valid: false, reason: p.reason, connection: null }
    const connection = buildConnectionCandidate(origin, target)
    const r = assessGraphConnection(connection, nodes, conns, validator)
    return { valid: r.valid, reason: r.reason, connection }
}
