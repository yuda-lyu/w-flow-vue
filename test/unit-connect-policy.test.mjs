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
 */
import { buildConnectionCandidate, assessGraphConnection, assessConnection } from '../src/js/connectPolicy.mjs'
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
    test('方向語義: 落點為 source 把手即拒絕(不進圖層判定)', () => {
        expect(assessConnection(ep('b1', 'source'), ep('b2', 'source'), { nodes, conns: [] }))
            .toEqual({ valid: false, reason: 'target-not-target', connection: null })
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
