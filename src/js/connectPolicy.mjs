/**
 * 建線可行性政策(framework-free domain)。契約見 spec/流程_互動契約.md §4。
 *
 * - 雙向出發、嚴格配對(對齊 React Flow ConnectionMode.Strict + Handle isConnectableStart 預設 true):
 *   出發可為 source 或 target 把手; 落點必須是「他節點之異類把手」。
 * - 候選 connection 一律正規化為 { from: source 端節點, to: target 端節點 }, 與出發方向無關,
 *   宿主 validator / connect 事件收到之形狀與單向時代完全相同。
 * - preview(拖曳中 hover 判定)與 commit(放開建立)共用同一候選建構與判定器, 相同 endpoint 對必得相同結論。
 * - endpoint descriptor(由 handleDom.mjs 自 DOM 正規化):
 *   { nodeId, handleId, type: 'source'|'target', position, connectable, element }
 * - 候選只有 { from, to }: 邊沒有自己的方位(方位由兩端節點決定, anchorPolicy), 建線不寫入任何方位。
 * - reason 優先序: no-endpoint → unknown-handle → self → same-kind → not-connectable →
 *   圖層級(missing-node → from-output → to-input → duplicate → custom)。
 */
import { nodeType } from './anchorPolicy.mjs'

/**
 * 由 source 端/target 端 endpoint 建構候選 connection(preview 與 commit 共用, 不可各自手組)。
 * 參數已是正規化後之角色(非出發/落點), 由 assessConnection 負責配對。
 */
export function buildConnectionCandidate(sourceEp, targetEp) {
    return { from: sourceEp.nodeId, to: targetEp.nodeId }
}

/**
 * 圖層級判定: connection 形狀對圖(nodes/conns)與 custom validator 是否合法。
 * 回傳 { valid, reason }; reason ∈ 'no-endpoint'|'missing-node'|'self'|'from-output'|'to-input'|'duplicate'|'custom'|null
 */
export function assessGraphConnection(connection, nodes, conns, validator, defNode) {
    if (!connection || !connection.from || !connection.to) return { valid: false, reason: 'no-endpoint' }
    //自我連線不允許
    if (connection.from === connection.to) return { valid: false, reason: 'self' }
    //端點必須存在於圖中: 缺任一端即不合法(防 DOM 撿到他 flow/已刪節點之殘影)
    const fromNode = (nodes || []).find(n => n.id === connection.from)
    const toNode = (nodes || []).find(n => n.id === connection.to)
    if (!fromNode || !toNode) return { valid: false, reason: 'missing-node' }
    //節點種類語義(有效型別經 anchorPolicy.nodeType 單一解析): input(僅出點)不可作為終點, output(僅入點)不可作為起點
    if (nodeType(fromNode, defNode) === 'output') return { valid: false, reason: 'from-output' }
    if (nodeType(toNode, defNode) === 'input') return { valid: false, reason: 'to-input' }
    //同向重複邊不允許(方向圖: A→B 已存在時 B→A 仍允許; 同向即使 handles/方位不同亦算重複)
    const duplicate = (conns || []).find(e => e.from === connection.from && e.to === connection.to)
    if (duplicate) return { valid: false, reason: 'duplicate' }
    if (validator && !validator(connection)) return { valid: false, reason: 'custom' }
    return { valid: true, reason: null }
}

const isHandleType = (t) => t === 'source' || t === 'target'

/**
 * 出發/落點配對 → 正規化為 { sourceEp, targetEp }; 不可配對時回 { reason }。
 * 能力層順序: unknown-handle → self → same-kind → not-connectable。
 */
export function pairEndpoints(origin, target) {
    if (!origin || !target) return { reason: 'no-endpoint' }
    if (!isHandleType(origin.type) || !isHandleType(target.type)) return { reason: 'unknown-handle' }
    //同節點之任何把手(含出發把手自身)皆為自我連線: 先於同類判定(拖回自己同類把手回 self, 非 same-kind)
    if (origin.nodeId === target.nodeId) return { reason: 'self' }
    if (origin.type === target.type) return { reason: 'same-kind' }
    if (origin.connectable === false || target.connectable === false) return { reason: 'not-connectable' }
    return origin.type === 'source'
        ? { sourceEp: origin, targetEp: target }
        : { sourceEp: target, targetEp: origin }
}

/**
 * 完整判定: 配對/能力層 → 候選建構 → 圖層級判定。
 * 回傳 { valid, reason, connection }; connection 於能力層即拒絕時為 null。
 * origin/target 之 type 任一組合皆可(source→target 或 target→source), 結果 connection 已正規化。
 */
export function assessConnection(origin, target, { nodes, conns, validator, defNode } = {}) {
    if (!origin || !target) return { valid: false, reason: 'no-endpoint', connection: null }
    const p = pairEndpoints(origin, target)
    if (p.reason) return { valid: false, reason: p.reason, connection: null }
    const connection = buildConnectionCandidate(p.sourceEp, p.targetEp)
    const r = assessGraphConnection(connection, nodes, conns, validator, defNode)
    return { valid: r.valid, reason: r.reason, connection }
}
