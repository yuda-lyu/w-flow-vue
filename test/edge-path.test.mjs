import { getBezierPath, getStraightPath, getStepPath, getSmoothStepPath } from '../src/js/edge-path'

describe('edge-path', () => {
    const source = { sourceX: 100, sourceY: 50 }
    const target = { targetX: 300, targetY: 250 }

    describe('getBezierPath', () => {
        test('returns path string starting with M', () => {
            const result = getBezierPath({ ...source, ...target })
            expect(result.path).toMatch(/^M /)
            expect(result.path).toContain('C ')
        })

        test('returns label position', () => {
            const result = getBezierPath({ ...source, ...target })
            expect(typeof result.labelX).toBe('number')
            expect(typeof result.labelY).toBe('number')
        })

        test('label position is between source and target', () => {
            const result = getBezierPath({ ...source, ...target })
            expect(result.labelX).toBeGreaterThanOrEqual(source.sourceX)
            expect(result.labelX).toBeLessThanOrEqual(target.targetX)
        })

        test('supports different positions', () => {
            const r1 = getBezierPath({ ...source, ...target, sourcePosition: 'right', targetPosition: 'left' })
            const r2 = getBezierPath({ ...source, ...target, sourcePosition: 'bottom', targetPosition: 'top' })
            expect(r1.path).not.toBe(r2.path)
        })

        test('supports custom curvature', () => {
            const r1 = getBezierPath({ ...source, ...target, curvature: 0.1 })
            const r2 = getBezierPath({ ...source, ...target, curvature: 0.5 })
            expect(r1.path).not.toBe(r2.path)
        })

        test('handles same position (zero distance)', () => {
            const result = getBezierPath({ sourceX: 100, sourceY: 100, targetX: 100, targetY: 100 })
            expect(result.path).toMatch(/^M /)
        })
    })

    describe('getStraightPath', () => {
        test('returns path with M and L', () => {
            const result = getStraightPath({ ...source, ...target })
            expect(result.path).toBe('M 100,50 L 300,250')
        })

        test('label is at midpoint', () => {
            const result = getStraightPath({ ...source, ...target })
            expect(result.labelX).toBe(200)
            expect(result.labelY).toBe(150)
        })
    })

    describe('getStepPath', () => {
        test('returns path with only M and L commands', () => {
            const result = getStepPath({ ...source, ...target })
            expect(result.path).toMatch(/^M /)
            expect(result.path).toContain('L ')
            expect(result.path).not.toContain('C ')
        })

        test('returns label position', () => {
            const result = getStepPath({ ...source, ...target })
            expect(typeof result.labelX).toBe('number')
            expect(typeof result.labelY).toBe('number')
        })

        test('horizontal source/target produces correct segments', () => {
            const result = getStepPath({
                sourceX: 100,
                sourceY: 50,
                sourcePosition: 'right',
                targetX: 300,
                targetY: 250,
                targetPosition: 'left',
            })
            expect(result.path).toMatch(/^M /)
        })
    })

    describe('getSmoothStepPath', () => {
        test('returns path with Q commands for rounded corners', () => {
            const result = getSmoothStepPath({ ...source, ...target })
            expect(result.path).toContain('Q ')
        })

        test('returns label position', () => {
            const result = getSmoothStepPath({ ...source, ...target })
            expect(typeof result.labelX).toBe('number')
            expect(typeof result.labelY).toBe('number')
        })

        test('supports custom borderRadius', () => {
            const r1 = getSmoothStepPath({ ...source, ...target, borderRadius: 2 })
            const r2 = getSmoothStepPath({ ...source, ...target, borderRadius: 10 })
            expect(r1.path).not.toBe(r2.path)
        })
    })
})
