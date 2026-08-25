/**
 * 建線可行性政策(framework-free domain)。
 *
 * 契約:
 * - preview(拖曳中 hover 判定)與 commit(放開建立)必須共用同一候選建構與同一判定器,
 *   對相同 endpoint 對必得出相同結論(不變量, 由測試鎖定)。
 * - endpoint descriptor 形狀(由 DOM adapter 正規化, 見 handleDom.mjs):
 *   { nodeId, handleId, type: 'source'|'target', position, binding: 'auto'|'fixed', connectable, element }
 * - 候選 connection 之錨點烙印遵循 anchorPolicy 之 Auto/Fixed 語義:
 *   僅 binding='fixed' 之把手烙印方位, Auto 把手拉出/接入之邊動態跟隨節點設定。
 * - custom validator(funValidConnCreating)收到「與 commit 完全相同形狀」之候選
 *   (含已烙印之 fromPosition/toPosition), 須為同步純函式; 於 hover 目標變更與放開時各呼叫一次。
 */

/**
 * 由出發/目標 endpoint 建構候選 connection(preview 與 commit 共用, 不可各自手組)。
 */
export function buildConnectionCandidate(origin, target) {
    return {
        from: origin.nodeId,
        to: target.nodeId,
        ...(origin.binding === 'fixed' && origin.position ? { fromPosition: origin.position } : {}),
        ...(target.binding === 'fixed' && target.position ? { toPosition: target.position } : {}),
    }
}

/**
 * 圖層級判定: connection 形狀對圖(nodes/conns)與 custom validator 是否合法。
 * 回傳 { valid, reason }; reason ∈ 'no-endpoint'|'missing-node'|'self'|'from-output'|'to-input'|'duplicate'|'custom'|null
 */
export function assessGraphConnection(connection, nodes, conns, validator) {
    if (!connection || !connection.from || !connection.to) return { valid: false, reason: 'no-endpoint' }
    //自我連線不允許
    if (connection.from === connection.to) return { valid: false, reason: 'self' }
    //端點必須存在於圖中: 缺任一端即不合法(防 DOM 撿到他 flow/已刪節點之殘影)
    const fromNode = (nodes || []).find(n => n.id === connection.from)
    const toNode = (nodes || []).find(n => n.id === connection.to)
    if (!fromNode || !toNode) return { valid: false, reason: 'missing-node' }
    //節點種類語義: input(僅出點)不可作為連線終點, output(僅入點)不可作為連線起點
    if (fromNode.type === 'output') return { valid: false, reason: 'from-output' }
    if (toNode.type === 'input') return { valid: false, reason: 'to-input' }
    //同向重複邊不允許(方向圖: A→B 已存在時 B→A 仍允許; 同向即使 handles/方位不同亦算重複)
    const duplicate = (conns || []).find(e => e.from === connection.from && e.to === connection.to)
    if (duplicate) return { valid: false, reason: 'duplicate' }
    if (validator && !validator(connection)) return { valid: false, reason: 'custom' }
    return { valid: true, reason: null }
}

/**
 * 完整判定: handle 能力 → 候選建構 → 圖層級判定。
 * 回傳 { valid, reason, connection }; connection 於能力層即拒絕時為 null。
 */
export function assessConnection(origin, target, { nodes, conns, validator } = {}) {
    if (!origin || !target) return { valid: false, reason: 'no-endpoint', connection: null }
    //方向語義(strict): 只能自 source 出發、落於 target
    if (origin.type !== 'source') return { valid: false, reason: 'origin-not-source', connection: null }
    if (target.type !== 'target') return { valid: false, reason: 'target-not-target', connection: null }
    if (origin.connectable === false || target.connectable === false) {
        return { valid: false, reason: 'not-connectable', connection: null }
    }
    const connection = buildConnectionCandidate(origin, target)
    const r = assessGraphConnection(connection, nodes, conns, validator)
    return { valid: r.valid, reason: r.reason, connection }
}
