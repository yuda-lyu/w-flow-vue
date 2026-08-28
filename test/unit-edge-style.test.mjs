/**
 * edgeStyle.mjs / edgePath 共用解析之純函式契約:
 * S1 computeConnStyle: 線色/線寬與 edgeMarker.resolveLineStyle 同一來源(寬 0 合法); 選取態 +1px; dasharray 邊 > defConn; conn.style 保留。
 * S2 computeEdgeClasses: 型別 class 走 effectiveEdgeType(conn → defConn → CONN_DEFAULTS); animated 走 effectiveAnimated; conn.class 字串/陣列皆併入。
 * S3 parseWaypoints(嚴格): 兩種寫法皆可; 任一點無效 → null; 空/非陣列 → null。getPathFunction 未知型別回 bezier。
 * S4 anchorPolicy.sideNormal 為方位→法向量單一來源(edgePath 與 stepRouting 共用)。
 */
import { computeConnStyle, computeEdgeClasses, computeLabelStyle, effectiveEdgeType, effectiveAnimated } from '../src/js/edgeStyle.mjs'
import { resolveLineStyle } from '../src/js/edgeMarker.mjs'
import { parseWaypoints, getPathFunction, getBezierPath, getStepPath } from '../src/js/edgePath.mjs'
import { sideNormal } from '../src/js/anchorPolicy.mjs'
import { CONN_DEFAULTS } from '../src/js/defaults.mjs'

describe('S1 computeConnStyle', () => {
    test('與 resolveLineStyle 同一來源; 選取 +1; 寬 0 合法', () => {
        const dc = { edgeColor: '#123456', edgeWidth: 3, edgeDasharray: '4 2' }
        const c = { style: { opacity: 0.5 }, edgeWidth: 0 }
        const s = computeConnStyle(c, dc, false)
        const line = resolveLineStyle(c, dc)
        expect(s.stroke).toBe(line.color)
        expect(s.strokeWidth).toBe(0)
        expect(s.strokeDasharray).toBe('4 2')
        expect(s.opacity).toBe(0.5)
        expect(computeConnStyle(c, dc, true).strokeWidth).toBe(1)
        expect(computeConnStyle({ edgeDasharray: '' }, dc, false).strokeDasharray).toBeUndefined()
        expect(computeConnStyle({}, {}, false).stroke).toBe(CONN_DEFAULTS.edgeColor)
    })
})

describe('S2 classes / type / animated / label', () => {
    test('type 解析順序與 class 組裝', () => {
        expect(effectiveEdgeType({}, {})).toBe(CONN_DEFAULTS.type)
        expect(effectiveEdgeType({}, { type: 'step' })).toBe('step')
        expect(effectiveEdgeType({ type: 'straight' }, { type: 'step' })).toBe('straight')
        const cls = computeEdgeClasses({ class: 'x', animated: false }, { type: 'step', animated: true }, { selected: true, hovered: false })
        expect(cls).toContain('vue-flow__edge-step')
        expect(cls).toContain('x')
        expect(cls[cls.length - 1]).toEqual({ 'vue-flow__edge--selected': true, 'vue-flow__edge--animated': false, 'vue-flow__edge--hovered': false })
        expect(computeEdgeClasses({ class: ['a', 'b'] }, {}, {})).toEqual(expect.arrayContaining(['a', 'b']))
        expect(effectiveAnimated({}, { animated: true })).toBe(true)
        expect(effectiveAnimated({ animated: 0 }, { animated: true })).toBe(false)
    })
    test('labelStyle 字級/字色', () => {
        expect(computeLabelStyle({ fontSize: 14 }, { fontColor: '#abc' })).toEqual({ fontSize: '14px', color: '#abc' })
        expect(computeLabelStyle({}, {})).toEqual({})
    })
})

describe('S3 parseWaypoints / getPathFunction', () => {
    test('嚴格解析', () => {
        expect(parseWaypoints([[1, 2], { x: 3, y: 4 }])).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }])
        expect(parseWaypoints([[1, 2], { x: 'a', y: 4 }])).toBeNull()
        expect(parseWaypoints([])).toBeNull()
        expect(parseWaypoints('nope')).toBeNull()
    })
    test('路徑函式對照表', () => {
        expect(getPathFunction('bezier')).toBe(getBezierPath)
        expect(getPathFunction('step')).toBe(getStepPath)
        expect(getPathFunction('unknown')).toBe(getBezierPath)
    })
})

describe('S4 sideNormal', () => {
    test('四方位與非法值', () => {
        expect(sideNormal('top')).toEqual({ x: 0, y: -1 })
        expect(sideNormal('right')).toEqual({ x: 1, y: 0 })
        expect(sideNormal('bottom')).toEqual({ x: 0, y: 1 })
        expect(sideNormal('left')).toEqual({ x: -1, y: 0 })
        expect(sideNormal('zzz')).toEqual({ x: 0, y: 1 })
    })
})
