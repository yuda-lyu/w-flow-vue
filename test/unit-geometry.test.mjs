//getDiamondEdgePoint / getEllipseEdgePoint / getTriangleEdgePoint / rectsOverlap 現為 geometry.mjs 之內部函式
//(仍存在且仍被使用, 只是不再 export), 故改由公開入口 getHandlePosition / getOverlappingNodes 驗證其行為
import {
    getHandlePosition,
    getOverlappingNodes,
    clampPosition, snapPosition, resolveNodeSize } from '../src/js/geometry.mjs'

describe('resolveNodeSize(D4 單一尺寸來源)', () => {
    test('優先序: live > node 明確數值 > defNode > NODE_DEFAULTS; 非正數/非數值跳過', () => {
        expect(resolveNodeSize({ width: 120, height: 50 }, { width: 130, height: 55 }, { width: 200, height: 80 })).toEqual({ width: 130, height: 55 })
        expect(resolveNodeSize({ width: 120, height: 50 }, { width: 0, height: 0 }, { width: 200, height: 80 })).toEqual({ width: 120, height: 50 })
        expect(resolveNodeSize({ width: '10em' }, null, { width: 200, height: 80 })).toEqual({ width: 200, height: 80 })
        expect(resolveNodeSize({}, null, {})).toEqual({ width: 100, height: 40 })
        expect(resolveNodeSize(null, undefined, undefined)).toEqual({ width: 100, height: 40 })
    })
})

describe('geometry', () => {
    const node = { id: '1', position: { x: 100, y: 50 }, width: 150, height: 40 }

    describe('getHandlePosition', () => {
        test('top handle is at top center', () => {
            const pos = getHandlePosition(node, 'top', {})
            expect(pos).toEqual({ x: 175, y: 50 })
        })

        test('bottom handle is at bottom center', () => {
            const pos = getHandlePosition(node, 'bottom', {})
            expect(pos).toEqual({ x: 175, y: 90 })
        })

        test('left handle is at left center', () => {
            const pos = getHandlePosition(node, 'left', {})
            expect(pos).toEqual({ x: 100, y: 70 })
        })

        test('right handle is at right center', () => {
            const pos = getHandlePosition(node, 'right', {})
            expect(pos).toEqual({ x: 250, y: 70 })
        })

        test('uses nodeInternals dimensions if provided', () => {
            const pos = getHandlePosition(
                { id: '1', position: { x: 0, y: 0 } },
                'bottom',
                { width: 200, height: 60 }
            )
            expect(pos).toEqual({ x: 100, y: 60 })
        })

        test('無尺寸時回退 NODE_DEFAULTS(100x40, 與佈局/形狀面/路由同一來源)', () => {
            const pos = getHandlePosition({ id: '1', position: { x: 0, y: 0 } }, 'bottom', {})
            expect(pos).toEqual({ x: 50, y: 40 })
        })
        test('defNode 尺寸(opt.defNodeWidth/Height)優先於 NODE_DEFAULTS', () => {
            const pos = getHandlePosition({ id: '1', position: { x: 0, y: 0 } }, 'bottom', {}, { width: 200, height: 80 })
            expect(pos).toEqual({ x: 100, y: 80 })
        })
    })

    describe('getHandlePosition — diamond', () => {
        const diamond = { id: 'd', position: { x: 0, y: 0 }, width: 100, height: 100, shape: 'diamond', type: 'input' }

        test('top handle is at top vertex', () => {
            const pos = getHandlePosition(diamond, 'top', {})
            expect(pos.x).toBe(50)
            expect(pos.y).toBe(0)
        })

        test('bottom handle is at bottom vertex', () => {
            const pos = getHandlePosition(diamond, 'bottom', {})
            expect(pos.x).toBe(50)
            expect(pos.y).toBe(100)
        })
    })

    describe('getHandlePosition — ellipse', () => {
        const ellipse = { id: 'e', position: { x: 0, y: 0 }, width: 200, height: 100, shape: 'ellipse', type: 'input' }

        test('right handle is at rightmost point', () => {
            const pos = getHandlePosition(ellipse, 'right', {})
            expect(pos.x).toBeCloseTo(200, 0)
            expect(pos.y).toBeCloseTo(50, 0)
        })

        test('left handle is at leftmost point', () => {
            const pos = getHandlePosition(ellipse, 'left', {})
            expect(pos.x).toBeCloseTo(0, 0)
            expect(pos.y).toBeCloseTo(50, 0)
        })

        test('top handle is at topmost point', () => {
            const pos = getHandlePosition(ellipse, 'top', {})
            expect(pos.x).toBeCloseTo(100, 0)
            expect(pos.y).toBeCloseTo(0, 0)
        })
    })

    describe('getHandlePosition — triangle', () => {
        const tri = { id: 't', position: { x: 0, y: 0 }, width: 100, height: 100, shape: 'triangle-up' }

        test('top handle (apex) is at top center', () => {
            const pos = getHandlePosition(tri, 'top', {})
            expect(pos.x).toBeCloseTo(50, 0)
            expect(pos.y).toBeCloseTo(0, 0)
        })

        test('bottom handle (base) is at bottom midpoint', () => {
            const pos = getHandlePosition(tri, 'bottom', {})
            expect(pos.x).toBe(50)
            expect(pos.y).toBe(100)
        })
    })

    //各形狀之連接點: 四邊各一, 位置由 geometry.sideAnchorFraction 決定(規劃 §5.1; 28 格跨層驗證於 unit-port-geometry)

    describe('getHandlePosition — diamond 四頂點', () => {
        const diamond = { id: 'd', shape: 'diamond', position: { x: 0, y: 0 }, width: 100, height: 100 }

        test('四邊連接點即四頂點(外接矩形四邊中點)', () => {
            expect(getHandlePosition(diamond, 'top', {})).toEqual({ x: 50, y: 0 })
            expect(getHandlePosition(diamond, 'right', {})).toEqual({ x: 100, y: 50 })
            expect(getHandlePosition(diamond, 'bottom', {})).toEqual({ x: 50, y: 100 })
            expect(getHandlePosition(diamond, 'left', {})).toEqual({ x: 0, y: 50 })
        })
    })

    describe('getHandlePosition — ellipse ', () => {
        const ellipse = { id: 'e', shape: 'ellipse', position: { x: 0, y: 0 }, width: 200, height: 100 }

        test('top 為橢圓頂點', () => {
            const p = getHandlePosition(ellipse, 'top', {})
            expect(p.x).toBeCloseTo(100, 0)
            expect(p.y).toBeCloseTo(0, 0)
        })

        test('right 為橢圓右頂點', () => {
            const p = getHandlePosition(ellipse, 'right', {})
            expect(p.x).toBeCloseTo(200, 0)
            expect(p.y).toBeCloseTo(50, 0)
        })

        test('各方位之點皆落在橢圓邊界上', () => {
            //橢圓方程式: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 = 1
            const cx = 100; const cy = 50; const rx = 100; const ry = 50
            ;['top', 'bottom', 'left', 'right'].forEach((side) => {
                const p = getHandlePosition(ellipse, side, {})
                const dx = (p.x - cx) / rx
                const dy = (p.y - cy) / ry
                expect(dx * dx + dy * dy).toBeCloseTo(1, 1)
            })
        })
    })

    describe('getHandlePosition — triangle 各朝向 ', () => {
        const tri = (shape) => ({ id: 't', shape, position: { x: 0, y: 0 }, width: 100, height: 100 })

        test('triangle(朝上): top 側為頂點', () => {
            const p = getHandlePosition(tri('triangle-up'), 'top', {})
            expect(p.x).toBeCloseTo(50, 0)
            expect(p.y).toBeCloseTo(0, 0)
        })

        test('triangle(朝上): bottom 側為底邊中點', () => {
            const p = getHandlePosition(tri('triangle-up'), 'bottom', {})
            expect(p.x).toBeCloseTo(50, 0)
            expect(p.y).toBeCloseTo(100, 0)
        })

        test('triangle-right: right 側為右頂點', () => {
            const p = getHandlePosition(tri('triangle-right'), 'right', {})
            expect(p.x).toBeCloseTo(100, 0)
            expect(p.y).toBeCloseTo(50, 0)
        })

        test('triangle-down: bottom 側為下頂點', () => {
            const p = getHandlePosition(tri('triangle-down'), 'bottom', {})
            expect(p.x).toBeCloseTo(50, 0)
            expect(p.y).toBeCloseTo(100, 0)
        })

        test('triangle-left: left 側為左頂點', () => {
            const p = getHandlePosition(tri('triangle-left'), 'left', {})
            expect(p.x).toBeCloseTo(0, 0)
            expect(p.y).toBeCloseTo(50, 0)
        })

        test('斜邊上之連接點為斜邊中點(外接矩形 1/4、3/4), 不在外接矩形邊上', () => {
            expect(getHandlePosition(tri('triangle-up'), 'left', {})).toEqual({ x: 25, y: 50 })
            expect(getHandlePosition(tri('triangle-up'), 'right', {})).toEqual({ x: 75, y: 50 })
            expect(getHandlePosition(tri('triangle-down'), 'left', {})).toEqual({ x: 25, y: 50 })
            expect(getHandlePosition(tri('triangle-right'), 'top', {})).toEqual({ x: 50, y: 25 })
            expect(getHandlePosition(tri('triangle-right'), 'bottom', {})).toEqual({ x: 50, y: 75 })
            expect(getHandlePosition(tri('triangle-left'), 'top', {})).toEqual({ x: 50, y: 25 })
        })
    })

    describe('矩形重疊判定 (內部 rectsOverlap, 經 getOverlappingNodes 驗證)', () => {
        const nodeAt = (x, y, w, h) => ({ id: 'n', position: { x, y }, width: w, height: h })

        test('相交者回傳該節點', () => {
            const rect = { x: 50, y: 50, width: 100, height: 100 }
            expect(getOverlappingNodes(rect, [nodeAt(0, 0, 100, 100)], {})).toHaveLength(1)
        })

        test('不相交者不回傳', () => {
            const rect = { x: 100, y: 100, width: 50, height: 50 }
            expect(getOverlappingNodes(rect, [nodeAt(0, 0, 50, 50)], {})).toHaveLength(0)
        })

        test('僅邊緣相接不算重疊', () => {
            const rect = { x: 50, y: 0, width: 50, height: 50 }
            expect(getOverlappingNodes(rect, [nodeAt(0, 0, 50, 50)], {})).toHaveLength(0)
        })
    })

    describe('getOverlappingNodes', () => {
        const nodes = [
            { id: '1', position: { x: 0, y: 0 }, width: 100, height: 50 },
            { id: '2', position: { x: 200, y: 200 }, width: 100, height: 50 },
            { id: '3', position: { x: 50, y: 20 }, width: 100, height: 50 },
        ]

        test('returns overlapping nodes', () => {
            const rect = { x: 10, y: 10, width: 80, height: 80 }
            const result = getOverlappingNodes(rect, nodes, {})
            expect(result.map(n => n.id)).toEqual(['1', '3'])
        })
    })

    describe('clampPosition', () => {
        test('clamps to extent', () => {
            const extent = [[0, 0], [100, 100]]
            expect(clampPosition({ x: -10, y: 50 }, extent)).toEqual({ x: 0, y: 50 })
            expect(clampPosition({ x: 50, y: 150 }, extent)).toEqual({ x: 50, y: 100 })
        })

        test('returns original if no extent', () => {
            expect(clampPosition({ x: -10, y: 50 }, null)).toEqual({ x: -10, y: 50 })
        })
    })

    describe('snapPosition', () => {
        test('snaps to grid', () => {
            expect(snapPosition({ x: 17, y: 23 }, 15)).toEqual({ x: 15, y: 30 })
        })

        test('returns original if no grid', () => {
            expect(snapPosition({ x: 17, y: 23 }, null)).toEqual({ x: 17, y: 23 })
        })

        test('snaps negative positions', () => {
            expect(snapPosition({ x: -7, y: -22 }, 10)).toEqual({ x: -10, y: -20 })
        })
    })
})
