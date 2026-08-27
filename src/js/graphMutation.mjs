/**
 * graphMutation — 圖資料之變更核心(無框架、無狀態純函式)
 *
 * 邊界(三層架構之最底層):
 * - 只處理 id 解析/去重、連帶(cascade)計算、deletable 政策、就地套用與 change record 產出;
 * - 不碰 Vue instance、$emit、選取、拖曳 ghost、路由 cache——那些屬 WFlowVue 內之 transaction coordinator。
 * - graph = { nodes, conns } 為宿主陣列本身(1.x 維持「宿主陣列就地 mutate」模型), 每次呼叫皆重新解析,
 *   不快取任何狀態; preview 無副作用, apply 才 splice。
 *
 * 政策(1.x 定案):
 * - id 為 opaque identity(嚴格相等比對), 不強制轉字串; 只要求各集合內唯一。
 * - deletable:false 只阻止「被直接指定刪除」; 刪除節點時參照完整性優先, 其相鄰邊不論 deletable 一律連帶移除
 *   (否則留下端點已消失之孤兒邊)。被連帶刪除者列入 deleted 而非 excluded。
 */

const uniq = (arr) => {
    const out = []
    const seen = new Set()
    for (const v of (arr || [])) {
        if (v === undefined || v === null) continue
        if (seen.has(v)) continue
        seen.add(v)
        out.push(v)
    }
    return out
}

/**
 * 預覽刪除(無副作用): 解析目標、套用 deletable 政策、計算連帶邊, 產出可供確認閘門與提交共用之 plan
 *
 * @param {Object} graph { nodes, conns }
 * @param {Object} target { nodeIds=[], connIds=[] }
 * @returns {Object} plan
 *   requested: { nodeIds, connIds }        去重後之直接要求
 *   nodeIds / connIds                       將被刪除之 id(connIds 含連帶, 已去重, 依圖內順序)
 *   nodes / conns                           對應之圖內物件(同上順序; conns = 直接指定者在前、連帶者在後)
 *   cascades: [{ nodeId, connIds }]         各節點連帶刪除之邊(僅列「非直接指定」者)
 *   notFound: { nodeIds, connIds }          直接要求但圖上不存在者
 *   excluded: { nodeIds, connIds }          直接要求但 deletable:false 而最終未刪者
 *   empty: Boolean                          requested 為空
 */
export function previewDelete(graph, target) {
    const nodes = (graph && graph.nodes) || []
    const conns = (graph && graph.conns) || []
    const reqNodeIds = uniq(target && target.nodeIds)
    const reqConnIds = uniq(target && target.connIds)

    const notFound = { nodeIds: [], connIds: [] }
    const excluded = { nodeIds: [], connIds: [] }

    //nodes: 直接指定者
    const delNodes = []
    const delNodeIdSet = new Set()
    for (const id of reqNodeIds) {
        const n = nodes.find(x => x.id === id)
        if (!n) {
            notFound.nodeIds.push(id)
            continue
        }
        if (n.deletable === false) {
            excluded.nodeIds.push(id)
            continue
        }
        delNodes.push(n)
        delNodeIdSet.add(id)
    }

    //conns: 直接指定者
    const delConns = []
    const delConnIdSet = new Set()
    const excludedConnIds = []
    for (const id of reqConnIds) {
        const c = conns.find(x => x.id === id)
        if (!c) {
            notFound.connIds.push(id)
            continue
        }
        if (c.deletable === false) {
            excludedConnIds.push(id)
            continue
        }
        delConns.push(c)
        delConnIdSet.add(id)
    }

    //cascade: 被刪節點之相鄰邊(完整性優先, 不看邊之 deletable); 依圖內順序, 去重
    const cascades = []
    if (delNodeIdSet.size > 0) {
        const perNode = new Map()
        for (const id of delNodeIdSet) perNode.set(id, [])
        for (const c of conns) {
            const hitFrom = delNodeIdSet.has(c.from)
            const hitTo = delNodeIdSet.has(c.to)
            if (!hitFrom && !hitTo) continue
            if (delConnIdSet.has(c.id)) continue //直接指定者不重列於 cascade
            delConns.push(c)
            delConnIdSet.add(c.id)
            //因果歸屬: 兩端皆被刪時歸於 from 端(單一歸屬, 避免同一邊在 cascades 內出現兩次)
            const owner = hitFrom ? c.from : c.to
            perNode.get(owner).push(c.id)
        }
        for (const [nodeId, connIds] of perNode) {
            if (connIds.length > 0) cascades.push({ nodeId, connIds })
        }
    }

    //excluded 只放「最終確實未刪」者: 直接指定被擋之邊若同時被連帶命中, 仍會被刪 → 不列 excluded
    for (const id of excludedConnIds) {
        if (!delConnIdSet.has(id)) excluded.connIds.push(id)
    }

    return {
        requested: { nodeIds: reqNodeIds, connIds: reqConnIds },
        nodeIds: delNodes.map(n => n.id),
        connIds: delConns.map(c => c.id),
        nodes: delNodes,
        conns: delConns,
        cascades,
        notFound,
        excluded,
        empty: reqNodeIds.length === 0 && reqConnIds.length === 0,
    }
}

/**
 * 就地套用刪除: 以 id 重新解析(不信任 preview 當下之物件參照), 自宿主陣列 splice 移除
 *
 * @param {Object} graph { nodes, conns }
 * @param {Object} plan { nodeIds, connIds }(connIds 須已含連帶邊, 本函式不再計算 cascade)
 * @returns {Object} { nodes, conns } 實際被移除之物件(依 plan 之 id 順序; 不存在者略過)
 */
export function applyDelete(graph, plan) {
    const nodes = (graph && graph.nodes) || []
    const conns = (graph && graph.conns) || []
    const removedNodes = []
    const removedConns = []
    for (const id of uniq(plan && plan.nodeIds)) {
        const idx = nodes.findIndex(n => n.id === id)
        if (idx === -1) continue
        removedNodes.push(nodes[idx])
        nodes.splice(idx, 1)
    }
    for (const id of uniq(plan && plan.connIds)) {
        const idx = conns.findIndex(c => c.id === id)
        if (idx === -1) continue
        removedConns.push(conns[idx])
        conns.splice(idx, 1)
    }
    return { nodes: removedNodes, conns: removedConns }
}

/**
 * 找出集合內重複之 id(宿主資料錯誤之防呆; 重複 id 會使一切以 id 為鍵之查找/對帳/Vue key 失效)
 *
 * @param {Array} list
 * @returns {Array} 重複之 id(每個只列一次, 依首次重複出現順序)
 */
export function findDuplicateIds(list) {
    const seen = new Set()
    const dup = new Set()
    for (const it of (list || [])) {
        if (!it) continue
        const id = it.id
        if (seen.has(id)) dup.add(id)
        else seen.add(id)
    }
    return [...dup]
}

/**
 * 深複製快照(與內部狀態脫鉤): 事件為歷史紀錄, 不得因後續畫布變動而失真, 亦防宿主改動事件物件汙染內部。
 * 採 JSON 往返(與 getFlowData 同策略): 函式/undefined 欄位不保留。
 */
export function snapshotDeep(v) {
    return JSON.parse(JSON.stringify(v))
}
