import { calculateStepPoints, clearStepCache } from '../src/js/stepRouting'

describe('step-routing', () => {
    beforeEach(() => {
        clearStepCache()
    })

    describe('calculateStepPoints', () => {
        test('returns array of points', () => {
            const pts = calculateStepPoints(100, 50, 'bottom', 300, 250, 'top', 20)
            expect(Array.isArray(pts)).toBe(true)
            expect(pts.length).toBeGreaterThanOrEqual(2)
        })

        test('first point matches source', () => {
            const pts = calculateStepPoints(100, 50, 'bottom', 300, 250, 'top', 20)
            expect(pts[0].x).toBe(100)
            expect(pts[0].y).toBe(50)
        })

        test('last point matches target', () => {
            const pts = calculateStepPoints(100, 50, 'bottom', 300, 250, 'top', 20)
            const last = pts[pts.length - 1]
            expect(last.x).toBe(300)
            expect(last.y).toBe(250)
        })

        test('all points have x and y', () => {
            const pts = calculateStepPoints(0, 0, 'right', 200, 100, 'left', 20)
            pts.forEach(p => {
                expect(typeof p.x).toBe('number')
                expect(typeof p.y).toBe('number')
                expect(isNaN(p.x)).toBe(false)
                expect(isNaN(p.y)).toBe(false)
            })
        })

        test('works with all position combinations', () => {
            const positions = ['top', 'bottom', 'left', 'right']
            positions.forEach(sp => {
                positions.forEach(tp => {
                    const pts = calculateStepPoints(0, 0, sp, 200, 200, tp, 20)
                    expect(pts.length).toBeGreaterThanOrEqual(2)
                    expect(pts[0]).toEqual({ x: 0, y: 0 })
                    expect(pts[pts.length - 1]).toEqual({ x: 200, y: 200 })
                })
            })
        })

        test('avoids node obstacles', () => {
            const nodes = [
                { id: '1', position: { x: 0, y: 0 }, width: 100, height: 40 },
                { id: '2', position: { x: 200, y: 200 }, width: 100, height: 40 },
                { id: 'block', position: { x: 100, y: 80 }, width: 100, height: 100 },
            ]
            const ni = {}
            const pts = calculateStepPoints(
                50, 40, 'bottom', 250, 200, 'top', 20,
                nodes, ni, '1', '2'
            )
            expect(pts.length).toBeGreaterThanOrEqual(2)
            expect(pts[0]).toEqual({ x: 50, y: 40 })
        })

        test('handles same source and target position', () => {
            const pts = calculateStepPoints(100, 100, 'bottom', 100, 300, 'bottom', 20)
            expect(pts.length).toBeGreaterThanOrEqual(2)
        })

        test('handles close source and target', () => {
            const pts = calculateStepPoints(100, 100, 'bottom', 105, 105, 'top', 20)
            expect(pts.length).toBeGreaterThanOrEqual(2)
        })
    })

    describe('clearStepCache', () => {
        test('does not throw', () => {
            expect(() => clearStepCache()).not.toThrow()
        })

        test('can be called multiple times', () => {
            clearStepCache()
            clearStepCache()
            clearStepCache()
        })
    })

})
