/**
 * anchorPolicy 純函式驗收 —— 方位之單一來源是連線(spec/流程_互動契約.md §4)。
 *
 * 契約:
 *   from 端: conn.fromPosition → defConn.fromPosition → 'bottom'
 *   to 端:   conn.toPosition   → defConn.toPosition   → 'top'
 *   非四值之方位視為未給; oppositeSide 為對邊; 模組不讀取節點資料。
 */
import * as ap from '../src/js/anchorPolicy.mjs'

const { connSourceSide, connTargetSide, oppositeSide, isSide, SIDES } = ap

describe('方位集合', () => {
    test('SIDES 恰四值, isSide 只認四值', () => {
        expect(SIDES).toEqual(['top', 'right', 'bottom', 'left'])
        for (const s of SIDES) expect(isSide(s)).toBe(true)
        expect(isSide('center')).toBe(false)
        expect(isSide('')).toBe(false)
        expect(isSide(null)).toBe(false)
    })
    test('oppositeSide 兩兩互為對邊; 非法值回 top', () => {
        expect(oppositeSide('top')).toBe('bottom')
        expect(oppositeSide('bottom')).toBe('top')
        expect(oppositeSide('left')).toBe('right')
        expect(oppositeSide('right')).toBe('left')
        expect(oppositeSide('x')).toBe('top')
    })
})

describe('from 端解析', () => {
    test('conn.fromPosition 優先', () => {
        expect(connSourceSide({ fromPosition: 'right' }, { fromPosition: 'top' })).toBe('right')
    })
    test('無 conn 層 → defConn.fromPosition', () => {
        expect(connSourceSide({}, { fromPosition: 'right' })).toBe('right')
    })
    test('全無 → 內建 bottom', () => {
        expect(connSourceSide({}, {})).toBe('bottom')
        expect(connSourceSide(null, null)).toBe('bottom')
    })
    test('非法值視為未給', () => {
        expect(connSourceSide({ fromPosition: 'center' }, { fromPosition: 'left' })).toBe('left')
        expect(connSourceSide({ fromPosition: '' }, {})).toBe('bottom')
    })
})

describe('to 端解析', () => {
    test('conn.toPosition → defConn.toPosition → top', () => {
        expect(connTargetSide({ toPosition: 'left' }, { toPosition: 'right' })).toBe('left')
        expect(connTargetSide({}, { toPosition: 'right' })).toBe('right')
        expect(connTargetSide({}, {})).toBe('top')
    })
})

describe('模組不提供節點層解析', () => {
    test('無 nodeType / nodeSourceSide / nodeTargetSide / nodeSameSide 匯出', () => {
        expect(ap.nodeType).toBeUndefined()
        expect(ap.nodeSourceSide).toBeUndefined()
        expect(ap.nodeTargetSide).toBeUndefined()
        expect(ap.nodeSameSide).toBeUndefined()
    })
})
