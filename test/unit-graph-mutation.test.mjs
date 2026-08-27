/**
 * graphMutation 核心之驗收(無框架純函式)。
 *
 * 規格(WFlowVue.vue 檔頭「Deleting」節、graphMutation.mjs 檔頭):
 * G1 previewDelete 無副作用; 直接指定之節點/連線解析為圖內物件。
 * G2 刪節點時其相鄰邊(from 或 to 命中)一律連帶, 不論邊之 deletable(完整性優先); 依圖內順序, 去重。
 * G3 直接指定且同時被連帶命中之邊只列一次(列於直接指定, 不重列於 cascades)。
 * G4 不存在之 id → notFound, 不中斷其餘。
 * G5 deletable:false 之直接指定 → excluded; 但若同時被連帶命中則仍刪且不列 excluded(excluded 只放最終未刪者)。
 * G6 cascades 描述因果: 兩端皆被刪之邊單一歸屬於 from 端。
 * G7 requested 去重, 忽略 null/undefined; empty 於 requested 為空時為 true。
 * G8 applyDelete 以 id 重新解析並就地 splice(陣列 identity 不變), 回傳實際移除之物件, 不存在者略過。
 * G10 findDuplicateIds 只列重複者且各一次; snapshotDeep 與來源脫鉤。
 * G11 id 為 opaque identity: 數字 id 以嚴格相等比對, 不轉字串。
 */
import { previewDelete, applyDelete, findDuplicateIds, snapshotDeep } from '../src/js/graphMutation.mjs'

const mk = () => ({
    nodes: [
        { id: '1', name: 'N1' },
        { id: '2', name: 'N2' },
        { id: '3', name: 'N3' },
        { id: '4', name: 'N4', deletable: false },
    ],
    conns: [
        { id: 'e1-2', from: '1', to: '2' },
        { id: 'e2-3', from: '2', to: '3' },
        { id: 'e3-4', from: '3', to: '4', deletable: false },
        { id: 'e1-3', from: '1', to: '3' },
    ],
})

describe('G1 previewDelete 無副作用且解析為圖內物件', () => {
    test('不改動 graph, nodes/conns 為圖內同一物件', () => {
        const g = mk()
        const before = JSON.stringify(g)
        const p = previewDelete(g, { nodeIds: ['2'], connIds: ['e1-3'] })
        expect(JSON.stringify(g)).toBe(before)
        expect(p.nodes[0]).toBe(g.nodes[1])
        expect(p.conns[0]).toBe(g.conns[3])
    })
})

describe('G2/G3/G6 連帶與去重', () => {
    test('刪節點連帶其全部相鄰邊, 依圖內順序', () => {
        const p = previewDelete(mk(), { nodeIds: ['2'] })
        expect(p.nodeIds).toEqual(['2'])
        expect(p.connIds).toEqual(['e1-2', 'e2-3'])
        expect(p.cascades).toEqual([{ nodeId: '2', connIds: ['e1-2', 'e2-3'] }])
    })
    test('deletable:false 之相鄰邊仍被連帶(完整性優先), 不列 excluded', () => {
        const p = previewDelete(mk(), { nodeIds: ['3'] })
        expect(p.connIds).toEqual(['e2-3', 'e3-4', 'e1-3'])
        expect(p.excluded.connIds).toEqual([])
    })
    test('直接指定且被連帶命中之邊只列一次, 列於直接指定而不進 cascades', () => {
        const p = previewDelete(mk(), { nodeIds: ['2'], connIds: ['e2-3'] })
        expect(p.connIds).toEqual(['e2-3', 'e1-2'])
        expect(p.cascades).toEqual([{ nodeId: '2', connIds: ['e1-2'] }])
    })
    test('兩端皆被刪之邊單一歸屬於 from 端', () => {
        const p = previewDelete(mk(), { nodeIds: ['1', '2'] })
        expect(p.connIds).toEqual(['e1-2', 'e2-3', 'e1-3'])
        expect(p.cascades).toEqual([
            { nodeId: '1', connIds: ['e1-2', 'e1-3'] },
            { nodeId: '2', connIds: ['e2-3'] },
        ])
    })
})

describe('G4/G5 對帳: notFound 與 excluded', () => {
    test('不存在之 id 歸 notFound, 其餘照常', () => {
        const p = previewDelete(mk(), { nodeIds: ['nope', '1'], connIds: ['zzz'] })
        expect(p.notFound).toEqual({ nodeIds: ['nope'], connIds: ['zzz'] })
        expect(p.nodeIds).toEqual(['1'])
    })
    test('deletable:false 直接指定 → excluded, 不刪', () => {
        const p = previewDelete(mk(), { nodeIds: ['4'], connIds: ['e3-4'] })
        expect(p.nodeIds).toEqual([])
        expect(p.connIds).toEqual([])
        expect(p.excluded).toEqual({ nodeIds: ['4'], connIds: ['e3-4'] })
    })
    test('直接指定被擋之邊若同時被連帶命中, 仍刪且不列 excluded', () => {
        const p = previewDelete(mk(), { nodeIds: ['3'], connIds: ['e3-4'] })
        expect(p.connIds).toContain('e3-4')
        expect(p.excluded.connIds).toEqual([])
    })
})

describe('G7 requested 正規化', () => {
    test('去重並忽略 null/undefined; empty 判定', () => {
        const p = previewDelete(mk(), { nodeIds: ['1', '1', null, undefined], connIds: ['e1-3', 'e1-3'] })
        expect(p.requested).toEqual({ nodeIds: ['1'], connIds: ['e1-3'] })
        expect(p.empty).toBe(false)
        expect(previewDelete(mk(), {}).empty).toBe(true)
        expect(previewDelete(mk(), { nodeIds: [null] }).empty).toBe(true)
    })
})

describe('G8 applyDelete 就地套用', () => {
    test('splice 原陣列(identity 不變), 回傳實際移除者, 不存在者略過', () => {
        const g = mk()
        const nodesRef = g.nodes
        const connsRef = g.conns
        const r = applyDelete(g, { nodeIds: ['2', 'nope'], connIds: ['e1-2', 'e2-3', 'ghost'] })
        expect(g.nodes).toBe(nodesRef)
        expect(g.conns).toBe(connsRef)
        expect(g.nodes.map(n => n.id)).toEqual(['1', '3', '4'])
        expect(g.conns.map(c => c.id)).toEqual(['e3-4', 'e1-3'])
        expect(r.nodes.map(n => n.id)).toEqual(['2'])
        expect(r.conns.map(c => c.id)).toEqual(['e1-2', 'e2-3'])
    })
    test('applyDelete 不自行計算 cascade(只刪 plan 指定者)', () => {
        const g = mk()
        applyDelete(g, { nodeIds: ['2'] })
        expect(g.conns.map(c => c.id)).toEqual(['e1-2', 'e2-3', 'e3-4', 'e1-3'])
    })
})

describe('G10 findDuplicateIds / snapshotDeep', () => {
    test('只列重複者且各一次', () => {
        expect(findDuplicateIds([{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'a' }, null])).toEqual(['a'])
        expect(findDuplicateIds([])).toEqual([])
    })
    test('snapshotDeep 與來源脫鉤', () => {
        const src = [{ id: '1', position: { x: 1, y: 2 } }]
        const s = snapshotDeep(src)
        s[0].position.x = 99
        expect(src[0].position.x).toBe(1)
    })
})

describe('G11 id 為 opaque identity', () => {
    test('數字 id 嚴格相等, 不與字串互轉', () => {
        const g = { nodes: [{ id: 1 }, { id: 2 }], conns: [{ id: 10, from: 1, to: 2 }] }
        const p = previewDelete(g, { nodeIds: [1, '2'] })
        expect(p.nodeIds).toEqual([1])
        expect(p.notFound.nodeIds).toEqual(['2'])
        expect(p.connIds).toEqual([10])
    })
})
