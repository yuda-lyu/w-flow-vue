import {
    getHandlePosition,
    getDiamondEdgePoint, getEllipseEdgePoint, getTriangleEdgePoint,
    getOverlappingNodes,
    clampPosition, snapPosition, rectsOverlap
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

    describe('getDiamondEdgePoint', () => {
        test('ratio 0 returns left vertex for top side', () => {
            const p = getDiamondEdgePoint(0, 0, 100, 100, 'top', 0)
            expect(p.x).toBeCloseTo(0, 0)
            expect(p.y).toBeCloseTo(50, 0)
        })

        test('ratio 0.5 returns top vertex for top side', () => {
            const p = getDiamondEdgePoint(0, 0, 100, 100, 'top', 0.5)
            expect(p.x).toBeCloseTo(50, 0)
            expect(p.y).toBeCloseTo(0, 0)
        })

        test('ratio 1 returns right vertex for top side', () => {
            const p = getDiamondEdgePoint(0, 0, 100, 100, 'top', 1)
            expect(p.x).toBeCloseTo(100, 0)
            expect(p.y).toBeCloseTo(50, 0)
        })
    })

    describe('getEllipseEdgePoint', () => {
        test('top side ratio 0.5 returns top vertex', () => {
            const p = getEllipseEdgePoint(0, 0, 200, 100, 'top', 0.5)
            expect(p.x).toBeCloseTo(100, 0)
            expect(p.y).toBeCloseTo(0, 0)
        })

        test('right side ratio 0.5 returns right vertex', () => {
            const p = getEllipseEdgePoint(0, 0, 200, 100, 'right', 0.5)
            expect(p.x).toBeCloseTo(200, 0)
            expect(p.y).toBeCloseTo(50, 0)
        })

        test('returns point on ellipse boundary', () => {
            const cx = 100; const cy = 50; const rx = 100; const ry = 50
            const p = getEllipseEdgePoint(0, 0, 200, 100, 'top', 0.3)
            const dx = (p.x - cx) / rx
            const dy = (p.y - cy) / ry
            expect(dx * dx + dy * dy).toBeCloseTo(1, 1)
        })
    })

    describe('getTriangleEdgePoint', () => {
        test('apex side ratio 0.5 returns apex for triangle-up', () => {
            const p = getTriangleEdgePoint(0, 0, 100, 100, 'top', 0.5, 'triangle')
            expect(p.x).toBeCloseTo(50, 0)
            expect(p.y).toBeCloseTo(0, 0)
        })

        test('base side returns linear interpolation', () => {
            const p0 = getTriangleEdgePoint(0, 0, 100, 100, 'bottom', 0, 'triangle')
            const p1 = getTriangleEdgePoint(0, 0, 100, 100, 'bottom', 1, 'triangle')
            expect(p0.x).toBeCloseTo(0, 0)
            expect(p1.x).toBeCloseTo(100, 0)
            expect(p0.y).toBe(p1.y)
        })

        test('triangle-right apex is at right edge', () => {
            const p = getTriangleEdgePoint(0, 0, 100, 100, 'right', 0.5, 'triangle-right')
            expect(p.x).toBeCloseTo(100, 0)
            expect(p.y).toBeCloseTo(50, 0)
        })

        test('triangle-down apex is at bottom center', () => {
            const p = getTriangleEdgePoint(0, 0, 100, 100, 'bottom', 0.5, 'triangle-down')
            expect(p.x).toBeCloseTo(50, 0)
            expect(p.y).toBeCloseTo(100, 0)
        })

        test('triangle-left apex is at left edge', () => {
            const p = getTriangleEdgePoint(0, 0, 100, 100, 'left', 0.5, 'triangle-left')
            expect(p.x).toBeCloseTo(0, 0)
            expect(p.y).toBeCloseTo(50, 0)
        })
    })

    describe('rectsOverlap', () => {
        test('overlapping rects return true', () => {
            const a = { x: 0, y: 0, width: 100, height: 100 }
            const b = { x: 50, y: 50, width: 100, height: 100 }
            expect(rectsOverlap(a, b)).toBe(true)
        })

        test('non-overlapping rects return false', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 }
            const b = { x: 100, y: 100, width: 50, height: 50 }
            expect(rectsOverlap(a, b)).toBe(false)
        })

        test('touching rects (edge) return false', () => {
            const a = { x: 0, y: 0, width: 50, height: 50 }
            const b = { x: 50, y: 0, width: 50, height: 50 }
            expect(rectsOverlap(a, b)).toBe(false)
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
