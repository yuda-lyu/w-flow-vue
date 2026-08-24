/**
 * anchorPolicy 純函式驗收 —— 錨點語義之正式契約(單一來源)。
 *
 * 契約:
 *   source: conn.fromPosition → node.toPosition → defNode.toPosition → 'bottom'
 *   target: conn.toPosition   → node.fromPosition → defNode.fromPosition → 'top'
 *   Fixed = conn 自帶該端方位(永遠優先); Auto = 跟隨節點/defNode/內建預設。
 *   把手集合: 預設 Auto 把手永遠存在且排最前; Fixed 錨點(≠預設側)附加; 同側共用。
 */
import {
    nodeSourceSide, nodeTargetSide,
    resolveSourceAnchor, resolveTargetAnchor,
    sourceHandleSides, targetHandleSides,
    nodeSameSide,
} from '../src/js/anchorPolicy.mjs'

describe('解析順序(source 端)', () => {
    test('conn.fromPosition 最優先(Fixed)', () => {
        expect(resolveSourceAnchor({ fromPosition: 'left' }, { toPosition: 'right' }, { toPosition: 'top' }))
            .toEqual({ side: 'left', binding: 'fixed', origin: 'edge' })
    })
    test('無 conn 層 → node.toPosition(Auto)', () => {
        expect(resolveSourceAnchor({}, { toPosition: 'right' }, { toPosition: 'top' }))
            .toEqual({ side: 'right', binding: 'auto', origin: 'node' })
    })
    test('無 node 層 → defNode.toPosition(Auto)', () => {
        expect(resolveSourceAnchor({}, {}, { toPosition: 'right' }))
            .toEqual({ side: 'right', binding: 'auto', origin: 'configured-default' })
    })
    test('全無 → 內建 bottom', () => {
        expect(resolveSourceAnchor({}, {}, {}))
            .toEqual({ side: 'bottom', binding: 'auto', origin: 'builtin-default' })
        expect(resolveSourceAnchor(null, null, null).side).toBe('bottom')
    })
})

describe('解析順序(target 端, 對稱)', () => {
    test('conn.toPosition 最優先', () => {
        expect(resolveTargetAnchor({ toPosition: 'left' }, { fromPosition: 'right' }, {}).side).toBe('left')
        expect(resolveTargetAnchor({ toPosition: 'left' }, {}, {}).binding).toBe('fixed')
    })
    test('層層回退至內建 top', () => {
        expect(resolveTargetAnchor({}, { fromPosition: 'right' }, {}).side).toBe('right')
        expect(resolveTargetAnchor({}, {}, { fromPosition: 'left' }).origin).toBe('configured-default')
        expect(resolveTargetAnchor({}, {}, {})).toEqual({ side: 'top', binding: 'auto', origin: 'builtin-default' })
    })
})

describe('有效方位(節點層)', () => {
    test('node → defNode → 內建', () => {
        expect(nodeSourceSide({ toPosition: 'left' }, { toPosition: 'right' })).toBe('left')
        expect(nodeSourceSide({}, { toPosition: 'right' })).toBe('right')
        expect(nodeSourceSide({}, {})).toBe('bottom')
        expect(nodeTargetSide({}, { fromPosition: 'left' })).toBe('left')
        expect(nodeTargetSide({}, {})).toBe('top')
    })
})

describe('把手集合', () => {
    const node = { id: 'n1' }
    test('無邊: 僅預設 Auto 把手', () => {
        expect(sourceHandleSides(node, [], {})).toEqual([{ side: 'bottom', binding: 'auto' }])
    })
    test('Fixed 錨點(≠預設側)附加為 fixed 把手, 預設 Auto 仍在最前', () => {
        const conns = [{ from: 'n1', to: 'x', fromPosition: 'left' }]
        expect(sourceHandleSides(node, conns, {})).toEqual([
            { side: 'bottom', binding: 'auto' },
            { side: 'left', binding: 'fixed' },
        ])
    })
    test('既有邊全為 Fixed 時, 預設 Auto 把手仍存在(不可消失)', () => {
        const conns = [
            { from: 'n1', to: 'x', fromPosition: 'left' },
            { from: 'n1', to: 'y', fromPosition: 'right' },
        ]
        const hs = sourceHandleSides(node, conns, {})
        expect(hs[0]).toEqual({ side: 'bottom', binding: 'auto' })
        expect(hs).toHaveLength(3)
    })
    test('Fixed 錨點恰為預設側: 共用同一把手(維持 auto, 新拖出仍為 Auto)', () => {
        const conns = [{ from: 'n1', to: 'x', fromPosition: 'bottom' }]
        expect(sourceHandleSides(node, conns, {})).toEqual([{ side: 'bottom', binding: 'auto' }])
    })
    test('Auto 邊(無錨點)不產生額外把手', () => {
        const conns = [{ from: 'n1', to: 'x' }]
        expect(sourceHandleSides(node, conns, {})).toEqual([{ side: 'bottom', binding: 'auto' }])
    })
    test('他節點之邊不計入', () => {
        const conns = [{ from: 'other', to: 'n1', fromPosition: 'left' }]
        expect(sourceHandleSides(node, conns, {})).toEqual([{ side: 'bottom', binding: 'auto' }])
    })
    test('target 側對稱: 依 conn.toPosition 附加', () => {
        const conns = [{ from: 'x', to: 'n1', toPosition: 'right' }]
        expect(targetHandleSides(node, conns, {})).toEqual([
            { side: 'top', binding: 'auto' },
            { side: 'right', binding: 'fixed' },
        ])
    })
    test('defNode 影響預設把手方位', () => {
        expect(sourceHandleSides(node, [], { toPosition: 'right' })).toEqual([{ side: 'right', binding: 'auto' }])
    })
})

describe('same-side(含 defNode 層)', () => {
    test('basic 且出入同側 → true', () => {
        expect(nodeSameSide({ type: 'basic', toPosition: 'top', fromPosition: 'top' }, {})).toBe(true)
    })
    test('經 defNode 補齊後同側亦成立(與把手/邊解析同一基準)', () => {
        expect(nodeSameSide({ type: 'basic' }, { toPosition: 'top', fromPosition: 'top' })).toBe(true)
        expect(nodeSameSide({ type: 'basic', toPosition: 'top' }, { fromPosition: 'top' })).toBe(true)
    })
    test('非 basic 一律 false; 預設 bottom/top 不同側', () => {
        expect(nodeSameSide({ type: 'input', toPosition: 'top', fromPosition: 'top' }, {})).toBe(false)
        expect(nodeSameSide({ type: 'basic' }, {})).toBe(false)
    })
})
