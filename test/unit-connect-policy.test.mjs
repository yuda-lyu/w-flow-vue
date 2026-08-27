/**
 * connectPolicy 純函式驗收(建線可行性政策之 domain 層)。
 *
 * 規格:
 * P1 buildConnectionCandidate: 錨點烙印遵循 Auto/Fixed 語義——僅 binding='fixed' 烙印方位。
 * P2 assessGraphConnection: 端點缺漏/不存在、自我連線、output 起點、input 終點、同向重複、
 *    custom validator, 逐項拒絕並回報 reason; 全過即 valid。
 * P3 反向邊契約: A→B 已存在時 B→A 仍允許(方向圖語義, 鎖定現狀)。
 * P4 assessConnection: 能力層(方向語義/connectable)先於圖層; candidate 形狀與 commit 完全一致,
 *    custom validator 收到含已烙印方位之完整形狀。
 * P5 isValidConnection(graph.mjs)委派本政策: 端點不存在即 false(舊版誤判為 true 之修正)。
 * P6 雙向出發正規化(spec/流程_互動契約.md §4): 自 target 出發落於 source, 候選仍為 { from: source 端, to: target 端 };
 *    Fixed 錨點依端點角色烙印(target 端把手之 position → toPosition), 與出發方向無關。
 * P7 reason 優先序: unknown-handle → self(同節點任何把手, 含拖回出發把手自身與同類) → same-kind → not-connectable → 圖層級。
 * P8 output.target → input.source 之反向出發: 正規化後 input→output 合法(不得因反向而漏判/誤判)。
 */
import { buildConnectionCandidate, assessGraphConnection, assessConnection, pairEndpoints } from '../src/js/connectPolicy.mjs'
import { isValidConnection } from '../src/js/graph'

const nodes = [
    { id: 'i1', type: 'input' },
    { id: 'b1', type: 'basic' },
    { id: 'b2' }, //type 未指定=basic
    { id: 'o1', type: 'output' },
]
const ep = (nodeId, type, extra = {}) => ({ nodeId, type, position: null, binding: 'auto', connectable: true, handleId: null, element: null, ...extra })

describe('P1 候選建構之 Auto/Fixed 烙印', () => {
    test('雙 Auto: 不烙印任何方位', () => {
        expect(buildConnectionCandidate(ep('b1', 'source'), ep('b2', 'target')))
            .toEqual({ from: 'b1', to: 'b2' })
    })
    test('出發 Fixed: 烙印 fromPosition', () => {
        expect(buildConnectionCandidate(ep('b1', 'source', { binding: 'fixed', position: 'left' }), ep('b2', 'target')))
            .toEqual({ from: 'b1', to: 'b2', fromPosition: 'left' })
    })
    test('落點 Fixed: 烙印 toPosition', () => {
        expect(buildConnectionCandidate(ep('b1', 'source'), ep('b2', 'target', { binding: 'fixed', position: 'right' })))
            .toEqual({ from: 'b1', to: 'b2', toPosition: 'right' })
    })
})

describe('P2 圖層級判定逐項拒絕', () => {
    test('端點缺漏: no-endpoint', () => {
        expect(assessGraphConnection({ from: '', to: 'b2' }, nodes, [])).toEqual({ valid: false, reason: 'no-endpoint' })
        expect(assessGraphConnection(null, nodes, [])).toEqual({ valid: false, reason: 'no-endpoint' })
    })
    test('自我連線: self', () => {
        expect(assessGraphConnection({ from: 'b1', to: 'b1' }, nodes, [])).toEqual({ valid: false, reason: 'self' })
    })
    test('端點不存在於圖中: missing-node', () => {
        expect(assessGraphConnection({ from: 'b1', to: 'ghost' }, nodes, [])).toEqual({ valid: false, reason: 'missing-node' })
        expect(assessGraphConnection({ from: 'ghost', to: 'b1' }, nodes, [])).toEqual({ valid: false, reason: 'missing-node' })
    })
    test('output 不可作為起點 / input 不可作為終點', () => {
        expect(assessGraphConnection({ from: 'o1', to: 'b1' }, nodes, [])).toEqual({ valid: false, reason: 'from-output' })
        expect(assessGraphConnection({ from: 'b1', to: 'i1' }, nodes, [])).toEqual({ valid: false, reason: 'to-input' })
    })
    test('同向重複: duplicate(即使方位不同亦算)', () => {
        const conns = [{ id: 'e1', from: 'b1', to: 'b2', fromPosition: 'left' }]
        expect(assessGraphConnection({ from: 'b1', to: 'b2' }, nodes, conns)).toEqual({ valid: false, reason: 'duplicate' })
    })
    test('custom validator 拒絕: custom', () => {
        expect(assessGraphConnection({ from: 'b1', to: 'b2' }, nodes, [], () => false)).toEqual({ valid: false, reason: 'custom' })
    })
    test('全過即 valid', () => {
        expect(assessGraphConnection({ from: 'i1', to: 'b2' }, nodes, [])).toEqual({ valid: true, reason: null })
    })
})

describe('P3 反向邊契約(鎖定現狀)', () => {
    test('A→B 已存在時, B→A 仍允許', () => {
        const conns = [{ id: 'e1', from: 'b1', to: 'b2' }]
        expect(assessGraphConnection({ from: 'b2', to: 'b1' }, nodes, conns)).toEqual({ valid: true, reason: null })
    })
})

describe('P4 完整判定: 能力層先於圖層, validator 收到完整形狀', () => {
    test('endpoint 缺: no-endpoint', () => {
        expect(assessConnection(null, ep('b2', 'target'), { nodes, conns: [] }))
            .toEqual({ valid: false, reason: 'no-endpoint', connection: null })
    })
    test('配對語義: 他節點之同類把手即拒絕 same-kind(不進圖層判定; 雙向皆然)', () => {
        expect(assessConnection(ep('b1', 'source'), ep('b2', 'source'), { nodes, conns: [] }))
            .toEqual({ valid: false, reason: 'same-kind', connection: null })
        expect(assessConnection(ep('b1', 'target'), ep('b2', 'target'), { nodes, conns: [] }))
            .toEqual({ valid: false, reason: 'same-kind', connection: null })
    })
    test('connectable=false 拒絕', () => {
        expect(assessConnection(ep('b1', 'source'), ep('b2', 'target', { connectable: false }), { nodes, conns: [] }))
            .toEqual({ valid: false, reason: 'not-connectable', connection: null })
    })
    test('validator 收到含已烙印方位之完整候選(與 commit 同形狀)', () => {
        const seen = []
        const validator = (c) => { seen.push(c); return true }
        const r = assessConnection(
            ep('b1', 'source', { binding: 'fixed', position: 'left' }),
            ep('b2', 'target', { binding: 'fixed', position: 'right' }),
            { nodes, conns: [], validator },
        )
        expect(r.valid).toBe(true)
        expect(seen).toEqual([{ from: 'b1', to: 'b2', fromPosition: 'left', toPosition: 'right' }])
        expect(r.connection).toEqual({ from: 'b1', to: 'b2', fromPosition: 'left', toPosition: 'right' })
    })
})

describe('P5 isValidConnection 委派政策', () => {
    test('端點不存在即 false(舊版漏洞修正)', () => {
        expect(isValidConnection({ from: 'ghost', to: 'b1' }, nodes, [])).toBe(false)
    })
    test('合法連線仍為 true(相容)', () => {
        expect(isValidConnection({ from: 'b1', to: 'b2' }, nodes, [])).toBe(true)
    })
    test('自我連線/重複邊仍為 false(相容)', () => {
        expect(isValidConnection({ from: 'b1', to: 'b1' }, nodes, [])).toBe(false)
        expect(isValidConnection({ from: 'b1', to: 'b2' }, nodes, [{ from: 'b1', to: 'b2' }])).toBe(false)
    })
})

describe('P6 雙向出發正規化', () => {
    test('自 b2.target 出發落於 b1.source → { from: b1, to: b2 }', () => {
        const r = assessConnection(ep('b2', 'target'), ep('b1', 'source'), { nodes, conns: [] })
        expect(r).toEqual({ valid: true, reason: null, connection: { from: 'b1', to: 'b2' } })
    })
    test('Fixed 錨點依端點角色烙印: 出發之 target 把手 position → toPosition', () => {
        const r = assessConnection(
            ep('b2', 'target', { binding: 'fixed', position: 'right' }),
            ep('b1', 'source', { binding: 'fixed', position: 'left' }),
            { nodes, conns: [] },
        )
        expect(r.connection).toEqual({ from: 'b1', to: 'b2', fromPosition: 'left', toPosition: 'right' })
    })
    test('反向出發與正向出發對同一對端點得相同候選(validator 形狀不變)', () => {
        const seen = []
        const validator = (c) => { seen.push(c); return true }
        assessConnection(ep('b1', 'source'), ep('b2', 'target'), { nodes, conns: [], validator })
        assessConnection(ep('b2', 'target'), ep('b1', 'source'), { nodes, conns: [], validator })
        expect(seen[0]).toEqual(seen[1])
    })
    test('反向出發之重複邊仍被擋', () => {
        const r = assessConnection(ep('b2', 'target'), ep('b1', 'source'), { nodes, conns: [{ from: 'b1', to: 'b2' }] })
        expect(r).toEqual({ valid: false, reason: 'duplicate', connection: { from: 'b1', to: 'b2' } })
    })
})

describe('P7 reason 優先序', () => {
    test('unknown-handle 先於一切能力層', () => {
        expect(pairEndpoints(ep('b1', null), ep('b1', 'source'))).toEqual({ reason: 'unknown-handle' })
        expect(assessConnection(ep('b1', 'source'), ep('b2', 'weird'), { nodes, conns: [] }).reason).toBe('unknown-handle')
    })
    test('self 先於 same-kind: 拖回自己節點任何把手(含出發把手自身、同類、異類)皆 self', () => {
        expect(pairEndpoints(ep('b1', 'source'), ep('b1', 'source'))).toEqual({ reason: 'self' })
        expect(pairEndpoints(ep('b1', 'source'), ep('b1', 'target'))).toEqual({ reason: 'self' })
        expect(pairEndpoints(ep('b1', 'target'), ep('b1', 'target'))).toEqual({ reason: 'self' })
        expect(pairEndpoints(ep('b1', 'target'), ep('b1', 'source'))).toEqual({ reason: 'self' })
    })
    test('same-kind 先於 not-connectable; not-connectable 先於圖層級', () => {
        expect(pairEndpoints(ep('b1', 'source'), ep('b2', 'source', { connectable: false }))).toEqual({ reason: 'same-kind' })
        expect(assessConnection(ep('o1', 'target'), ep('i1', 'source', { connectable: false }), { nodes, conns: [] }).reason).toBe('not-connectable')
    })
})

describe('P8 output/input 節點之反向出發', () => {
    test('自 o1.target 出發落於 i1.source → 正規化 i1→o1 合法', () => {
        const r = assessConnection(ep('o1', 'target'), ep('i1', 'source'), { nodes, conns: [] })
        expect(r).toEqual({ valid: true, reason: null, connection: { from: 'i1', to: 'o1' } })
    })
    test('自 i1.source 出發落於 o1.target 與上例得相同候選', () => {
        const r = assessConnection(ep('i1', 'source'), ep('o1', 'target'), { nodes, conns: [] })
        expect(r.connection).toEqual({ from: 'i1', to: 'o1' })
    })
})
