//getDiamondEdgePoint / getEllipseEdgePoint / getTriangleEdgePoint / rectsOverlap 現為 geometry.mjs 之內部函式
//(仍存在且仍被使用, 只是不再 export), 故改由公開入口 getHandlePosition / getOverlappingNodes 驗證其行為
import {
    getHandlePosition,
    getOverlappingNodes,
    clampPosition, snapPosition
} from '../src/js/geometry'

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

        test('defaults to 150x40 if no dimensions', () => {
            const pos = getHandlePosition({ id: '1', position: { x: 0, y: 0 } }, 'bottom', {})
            expect(pos).toEqual({ x: 75, y: 40 })
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
        const tri = { id: 't', position: { x: 0, y: 0 }, width: 100, height: 100, shape: 'triangle', type: 'input' }

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

    //以下四組原本直接呼叫已內部化之 getDiamondEdgePoint / getEllipseEdgePoint /
    //getTriangleEdgePoint / rectsOverlap, 改為經公開入口驗證同一批行為。
    //註: 舊測試之 ratio 0 與 ratio 1 為公開 API 無法產生之值
    //(getHandlePosition 僅產生 0.5, 或 sameSide 時之 0.33/0.67), 該兩組斷言不可達, 故不保留。

    describe('getHandlePosition — diamond same-side (內部 getDiamondEdgePoint)', () => {
        //diamond 需 sameSide(type='basic' 且 toPosition===fromPosition)才會走菱形邊緣運算
        const diamond = {
            id: 'd', shape: 'diamond', type: 'basic',
            position: { x: 0, y: 0 }, width: 100, height: 100,
            toPosition: 'top', fromPosition: 'top',
        }

        test('target 與 source 落在同側之不同點', () => {
            const pt = getHandlePosition(diamond, 'top', {}, 'target')
            const ps = getHandlePosition(diamond, 'top', {}, 'source')
            expect(pt).not.toEqual(ps)
        })

        test('兩點皆落在菱形邊上(到中心之曼哈頓距離為定值)', () => {
            //菱形邊之方程式: |x-cx|/(w/2) + |y-cy|/(h/2) = 1
            const onEdge = (p) => Math.abs(p.x - 50) / 50 + Math.abs(p.y - 50) / 50
            expect(onEdge(getHandlePosition(diamond, 'top', {}, 'target'))).toBeCloseTo(1, 5)
            expect(onEdge(getHandlePosition(diamond, 'top', {}, 'source'))).toBeCloseTo(1, 5)
        })
    })

    describe('getHandlePosition — ellipse (內部 getEllipseEdgePoint)', () => {
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

    describe('getHandlePosition — triangle 各朝向 (內部 getTriangleEdgePoint)', () => {
        const tri = (shape) => ({ id: 't', shape, position: { x: 0, y: 0 }, width: 100, height: 100 })

        test('triangle(朝上): top 側為頂點', () => {
            const p = getHandlePosition(tri('triangle'), 'top', {})
            expect(p.x).toBeCloseTo(50, 0)
            expect(p.y).toBeCloseTo(0, 0)
        })

        test('triangle(朝上): bottom 側為底邊中點', () => {
            const p = getHandlePosition(tri('triangle'), 'bottom', {})
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
