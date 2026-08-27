/**
 * anchorPolicy 純函式驗收 —— 方位之單一來源是節點(spec/流程_互動契約.md §4)。
 *
 * 契約:
 *   source 端(連出): node.toPosition → defNode.toPosition → 'bottom'
 *   target 端(連入): node.fromPosition → defNode.fromPosition → 'top'
 *   邊資料不含方位欄位; 模組不提供任何讀取 conn 方位之介面。
 */
import * as ap from '../src/js/anchorPolicy.mjs'

const { nodeSourceSide, nodeTargetSide, nodeSameSide } = ap

describe('連出側解析', () => {
    test('node.toPosition 優先', () => {
        expect(nodeSourceSide({ toPosition: 'right' }, { toPosition: 'top' })).toBe('right')
    })
    test('無 node 層 → defNode.toPosition', () => {
        expect(nodeSourceSide({}, { toPosition: 'right' })).toBe('right')
    })
    test('全無 → 內建 bottom', () => {
        expect(nodeSourceSide({}, {})).toBe('bottom')
        expect(nodeSourceSide(null, null)).toBe('bottom')
    })
})

describe('連入側解析', () => {
    test('node.fromPosition → defNode.fromPosition → top', () => {
        expect(nodeTargetSide({ fromPosition: 'left' }, { fromPosition: 'right' })).toBe('left')
        expect(nodeTargetSide({}, { fromPosition: 'right' })).toBe('right')
        expect(nodeTargetSide({}, {})).toBe('top')
    })
})

describe('same-side 判定(basic 節點出入同側 → 錯開佈局)', () => {
    test('basic 且同側為 true; 非 basic 恆 false; 併入 defNode 層', () => {
        expect(nodeSameSide({ type: 'basic', toPosition: 'top', fromPosition: 'top' }, {})).toBe(true)
        expect(nodeSameSide({ type: 'basic' }, { toPosition: 'top', fromPosition: 'top' })).toBe(true)
        expect(nodeSameSide({ type: 'basic' }, {})).toBe(false)
        expect(nodeSameSide({ type: 'input', toPosition: 'top', fromPosition: 'top' }, {})).toBe(false)
    })
})

describe('有效型別解析', () => {
    test('node.type → defNode.type → basic', () => {
        expect(ap.nodeType({ type: 'output' }, { type: 'input' })).toBe('output')
        expect(ap.nodeType({}, { type: 'input' })).toBe('input')
        expect(ap.nodeType({}, {})).toBe('basic')
    })
})
