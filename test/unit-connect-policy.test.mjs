/**
 * connectPolicy 純函式驗收(建線可行性政策之 domain 層; spec/流程_互動契約.md §4)。
 *
 * 規格:
 * P1 buildConnectionCandidate: { from: 出發節點, to: 落點節點, fromPosition: 出發邊, toPosition: 落點邊 }。
 * P2 assessGraphConnection: 端點缺漏/不存在、自我連線、同向重複、custom validator, 逐項拒絕並回報 reason; 全過即 valid。
 * P3 反向邊契約: A→B 已存在時 B→A 仍允許(方向圖語義)。
 * P4 assessConnection: 能力層(unknown-handle/self/not-connectable)先於圖層; validator 收到與 commit 相同之候選。
 * P5 isValidConnection(graph.mjs)委派本政策: 端點不存在即 false。
 * P6 四把手對稱: 任一出發邊 × 任一落點邊之組合皆合法(他節點), 且候選方位即兩把手所在邊。
 * P7 reason 優先序: no-endpoint → unknown-handle → self(同節點任一把手, 含出發把手自身) → not-connectable → 圖層級。
 * P8 duplicate 不看方位: 同向同節點對即重複, 方位不同亦然。
 */
import { buildConnectionCandidate, assessGraphConnection, assessConnection, pairEndpoints } from '../src/js/connectPolicy.mjs'
import { isValidConnection } from '../src/js/graph'

const nodes = [
    { id: 'a' },
    { id: 'b' },
    { id: 'c', type: 'output' }, //節點 type 不再有語義
]
const ep = (nodeId, position = 'bottom', extra = {}) => ({ nodeId, position, connectable: true, element: null, ...extra })
const SIDES = ['top', 'right', 'bottom', 'left']

describe('P1 候選形狀', () => {
    test('from/to + 兩端方位', () => {
        expect(buildConnectionCandidate(ep('a', 'left'), ep('b', 'right')))
            .toEqual({ from: 'a', to: 'b', fromPosition: 'left', toPosition: 'right' })
    })
})

describe('P2 圖層級判定逐項拒絕', () => {
    test('端點缺漏: no-endpoint', () => {
        expect(assessGraphConnection({ from: '', to: 'b' }, nodes, [])).toEqual({ valid: false, reason: 'no-endpoint' })
        expect(assessGraphConnection(null, nodes, [])).toEqual({ valid: false, reason: 'no-endpoint' })
    })
    test('自我連線: self', () => {
        expect(assessGraphConnection({ from: 'a', to: 'a' }, nodes, [])).toEqual({ valid: false, reason: 'self' })
    })
    test('端點不存在於圖中: missing-node', () => {
        expect(assessGraphConnection({ from: 'a', to: 'ghost' }, nodes, [])).toEqual({ valid: false, reason: 'missing-node' })
        expect(assessGraphConnection({ from: 'ghost', to: 'a' }, nodes, [])).toEqual({ valid: false, reason: 'missing-node' })
    })
    test('同向重複: duplicate', () => {
        const conns = [{ id: 'e1', from: 'a', to: 'b' }]
        expect(assessGraphConnection({ from: 'a', to: 'b' }, nodes, conns)).toEqual({ valid: false, reason: 'duplicate' })
    })
    test('custom validator 拒絕: custom', () => {
        expect(assessGraphConnection({ from: 'a', to: 'b' }, nodes, [], () => false)).toEqual({ valid: false, reason: 'custom' })
    })
    test('全過即 valid; 節點 type 欄位無語義(output 可為起點)', () => {
        expect(assessGraphConnection({ from: 'c', to: 'a' }, nodes, [])).toEqual({ valid: true, reason: null })
        expect(assessGraphConnection({ from: 'a', to: 'c' }, nodes, [])).toEqual({ valid: true, reason: null })
    })
})

describe('P3 反向邊契約', () => {
    test('A→B 已存在時, B→A 仍允許', () => {
        const conns = [{ id: 'e1', from: 'a', to: 'b' }]
        expect(assessGraphConnection({ from: 'b', to: 'a' }, nodes, conns)).toEqual({ valid: true, reason: null })
    })
})

describe('P4 完整判定: 能力層先於圖層, validator 收到完整形狀', () => {
    test('endpoint 缺: no-endpoint', () => {
        expect(assessConnection(null, ep('b'), { nodes, conns: [] }))
            .toEqual({ valid: false, reason: 'no-endpoint', connection: null })
    })
    test('connectable=false 拒絕(任一端)', () => {
        expect(assessConnection(ep('a'), ep('b', 'top', { connectable: false }), { nodes, conns: [] }))
            .toEqual({ valid: false, reason: 'not-connectable', connection: null })
        expect(assessConnection(ep('a', 'top', { connectable: false }), ep('b'), { nodes, conns: [] }).reason).toBe('not-connectable')
    })
    test('validator 收到與 commit 同形狀之候選', () => {
        const seen = []
        const validator = (c) => {
            seen.push(c); return true
        }
        const r = assessConnection(ep('a', 'left'), ep('b', 'right'), { nodes, conns: [], validator })
        expect(r.valid).toBe(true)
        expect(seen).toEqual([{ from: 'a', to: 'b', fromPosition: 'left', toPosition: 'right' }])
        expect(r.connection).toEqual({ from: 'a', to: 'b', fromPosition: 'left', toPosition: 'right' })
    })
    test('能力層拒絕時 connection 為 null, 不呼叫 validator', () => {
        const validator = jest.fn(() => true)
        expect(assessConnection(ep('a'), ep('a', 'top'), { nodes, conns: [], validator }).connection).toBeNull()
        expect(validator).not.toHaveBeenCalled()
    })
})

describe('P5 isValidConnection 委派政策', () => {
    test('端點不存在即 false', () => {
        expect(isValidConnection({ from: 'ghost', to: 'a' }, nodes, [])).toBe(false)
    })
    test('合法連線 true; 自我連線/重複邊 false', () => {
        expect(isValidConnection({ from: 'a', to: 'b' }, nodes, [])).toBe(true)
        expect(isValidConnection({ from: 'a', to: 'a' }, nodes, [])).toBe(false)
        expect(isValidConnection({ from: 'a', to: 'b' }, nodes, [{ from: 'a', to: 'b' }])).toBe(false)
    })
})

describe('P6 四把手對稱: 16 種邊組合皆合法且方位即所在邊', () => {
    const cases = []
    for (const f of SIDES) for (const t of SIDES) cases.push([f, t])
    test.each(cases)('a.%s → b.%s', (f, t) => {
        const r = assessConnection(ep('a', f), ep('b', t), { nodes, conns: [] })
        expect(r).toEqual({ valid: true, reason: null, connection: { from: 'a', to: 'b', fromPosition: f, toPosition: t } })
    })
})

describe('P7 reason 優先序', () => {
    test('unknown-handle 先於一切能力層(方位非四值)', () => {
        expect(pairEndpoints(ep('a', null), ep('a', 'top'))).toEqual({ reason: 'unknown-handle' })
        expect(pairEndpoints(ep('a', 'source'), ep('b', 'top'))).toEqual({ reason: 'unknown-handle' })
        expect(assessConnection(ep('a'), ep('b', 'weird'), { nodes, conns: [] }).reason).toBe('unknown-handle')
    })
    test('self: 拖回自己節點任一把手(含出發把手自身)', () => {
        for (const s of SIDES) expect(pairEndpoints(ep('a', 'bottom'), ep('a', s))).toEqual({ reason: 'self' })
    })
    test('self 先於 not-connectable; not-connectable 先於圖層級', () => {
        expect(pairEndpoints(ep('a'), ep('a', 'top', { connectable: false }))).toEqual({ reason: 'self' })
        expect(assessConnection(ep('a'), ep('ghost', 'top', { connectable: false }), { nodes, conns: [] }).reason).toBe('not-connectable')
    })
    test('可配對時回空物件', () => {
        expect(pairEndpoints(ep('a'), ep('b', 'top'))).toEqual({})
    })
})

describe('P8 duplicate 不看方位', () => {
    test('a→b 已存在(bottom→top): 自 a.right 拉至 b.left 仍 duplicate', () => {
        const conns = [{ id: 'e1', from: 'a', to: 'b', fromPosition: 'bottom', toPosition: 'top' }]
        const r = assessConnection(ep('a', 'right'), ep('b', 'left'), { nodes, conns })
        expect(r.reason).toBe('duplicate')
        expect(r.connection).toEqual({ from: 'a', to: 'b', fromPosition: 'right', toPosition: 'left' })
    })
})
