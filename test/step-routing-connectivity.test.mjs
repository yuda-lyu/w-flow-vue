/**
 * Routing snapshot regression test.
 *
 * 576 combinations: 4 source handles × 4 target handles × 36 angles (10° steps).
 * Each case verifies calculateStepPoints output matches the saved snapshot exactly.
 * If a code change alters any routing result, this test will catch it.
 *
 * To regenerate snapshots after intentional changes:
 *   node --experimental-vm-modules test/generate-routing-snapshots.mjs
 */
import { calculateStepPoints, clearStepCache } from '../src/js/step-routing'
import snapshots from './jsons/routing-snapshots.json'

const NODE_W = 100
const NODE_H = 40
const BUF = 24

describe('routing snapshot regression', () => {
    beforeEach(() => {
        clearStepCache()
    })

    test('snapshot file has 576 cases', () => {
        expect(snapshots.length).toBe(576)
    })

    describe.each(
        snapshots.map((c, i) => [
            `[${i}] ${c.srcPos}→${c.tgtPos} ${c.deg}°`,
            c,
        ])
    )('%s', (_label, c) => {
        test('matches snapshot', () => {
            let nodes = [
                { id: 'A', position: c.aPos, width: NODE_W, height: NODE_H },
                { id: 'B', position: c.bPos, width: NODE_W, height: NODE_H },
            ]
            let pts = calculateStepPoints(
                c.sourceXY.x, c.sourceXY.y, c.srcPos,
                c.targetXY.x, c.targetXY.y, c.tgtPos,
                BUF, nodes, {}, 'A', 'B'
            )
            expect(pts).toEqual(c.pts)
        })

        test('no NaN in points', () => {
            let nodes = [
                { id: 'A', position: c.aPos, width: NODE_W, height: NODE_H },
                { id: 'B', position: c.bPos, width: NODE_W, height: NODE_H },
            ]
            let pts = calculateStepPoints(
                c.sourceXY.x, c.sourceXY.y, c.srcPos,
                c.targetXY.x, c.targetXY.y, c.tgtPos,
                BUF, nodes, {}, 'A', 'B'
            )
            pts.forEach((p, j) => {
                expect(isNaN(p.x)).toBe(false)
                expect(isNaN(p.y)).toBe(false)
            })
        })

        test('first/last points match source/target', () => {
            let nodes = [
                { id: 'A', position: c.aPos, width: NODE_W, height: NODE_H },
                { id: 'B', position: c.bPos, width: NODE_W, height: NODE_H },
            ]
            let pts = calculateStepPoints(
                c.sourceXY.x, c.sourceXY.y, c.srcPos,
                c.targetXY.x, c.targetXY.y, c.tgtPos,
                BUF, nodes, {}, 'A', 'B'
            )
            expect(pts[0].x).toBe(c.sourceXY.x)
            expect(pts[0].y).toBe(c.sourceXY.y)
            expect(pts[pts.length - 1].x).toBe(c.targetXY.x)
            expect(pts[pts.length - 1].y).toBe(c.targetXY.y)
        })
    })
})
