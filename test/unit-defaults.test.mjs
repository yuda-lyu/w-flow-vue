import { NODE_DEFAULTS, CONN_DEFAULTS } from '../src/js/defaults.mjs'

describe('defaults', () => {
    describe('NODE_DEFAULTS', () => {
        test('has all required keys', () => {
            const keys = [
                'shape', 'width', 'height',
                'fontSize', 'fontSizeMin', 'fontSizeMax', 'fontColor',
                'faceColor', 'edgeColor', 'edgeWidth', 'popupDirection',
                'handleFaceColor', 'handleEdgeColor', 'handleEdgeWidth', 'handleSize',
            ]
            keys.forEach(k => {
                expect(NODE_DEFAULTS).toHaveProperty(k)
            })
        })

        test('no type / direction fields on nodes', () => {
            expect(NODE_DEFAULTS.type).toBeUndefined()
            expect(NODE_DEFAULTS.toPosition).toBeUndefined()
            expect(NODE_DEFAULTS.fromPosition).toBeUndefined()
        })

        test('shape is rectangle', () => {
            expect(NODE_DEFAULTS.shape).toBe('rectangle')
        })

        test('dimensions are positive numbers', () => {
            expect(NODE_DEFAULTS.width).toBeGreaterThan(0)
            expect(NODE_DEFAULTS.height).toBeGreaterThan(0)
        })

        test('fontSizeMin <= fontSize <= fontSizeMax', () => {
            expect(NODE_DEFAULTS.fontSizeMin).toBeLessThanOrEqual(NODE_DEFAULTS.fontSize)
            expect(NODE_DEFAULTS.fontSize).toBeLessThanOrEqual(NODE_DEFAULTS.fontSizeMax)
        })

        test('edgeWidth is a positive number', () => {
            expect(NODE_DEFAULTS.edgeWidth).toBeGreaterThan(0)
        })

        test('popupDirection is valid', () => {
            const valid = ['top', 'bottom', 'left', 'right']
            expect(valid).toContain(NODE_DEFAULTS.popupDirection)
        })

        test('colors are hex strings', () => {
            const hexPattern = /^#[0-9a-fA-F]{6}$/
            expect(NODE_DEFAULTS.fontColor).toMatch(hexPattern)
            expect(NODE_DEFAULTS.faceColor).toMatch(hexPattern)
            expect(NODE_DEFAULTS.edgeColor).toMatch(hexPattern)
        })
    })

    describe('CONN_DEFAULTS', () => {
        test('has all required keys', () => {
            const keys = [
                'type', 'fontSize', 'fontSizeMin', 'fontSizeMax', 'fontColor',
                'edgeColor', 'edgeWidth', 'animated', 'defOffset',
                'fromPosition', 'toPosition',
                'markerFrom', 'markerFromSize', 'markerFromFaceColor',
                'markerTo', 'markerToSize', 'markerToFaceColor',
            ]
            keys.forEach(k => {
                expect(CONN_DEFAULTS).toHaveProperty(k)
            })
        })

        test('type is bezier', () => {
            expect(CONN_DEFAULTS.type).toBe('bezier')
        })

        test('animated is boolean false', () => {
            expect(CONN_DEFAULTS.animated).toBe(false)
        })

        test('fontSizeMin <= fontSize <= fontSizeMax', () => {
            expect(CONN_DEFAULTS.fontSizeMin).toBeLessThanOrEqual(CONN_DEFAULTS.fontSize)
            expect(CONN_DEFAULTS.fontSize).toBeLessThanOrEqual(CONN_DEFAULTS.fontSizeMax)
        })

        test('defOffset is a positive number', () => {
            expect(CONN_DEFAULTS.defOffset).toBeGreaterThan(0)
        })

        test('markers default to none, size 10', () => {
            expect(CONN_DEFAULTS.markerFrom).toBe('')
            expect(CONN_DEFAULTS.markerTo).toBe('')
            expect(CONN_DEFAULTS.markerFromSize).toBe(10)
            expect(CONN_DEFAULTS.markerToSize).toBe(10)
        })

        test('anchor defaults: bottom → top', () => {
            expect(CONN_DEFAULTS.fromPosition).toBe('bottom')
            expect(CONN_DEFAULTS.toPosition).toBe('top')
        })
    })
})
