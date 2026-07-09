import { NODE_DEFAULTS, CONN_DEFAULTS } from '../src/js/defaults'

describe('defaults', () => {
    describe('NODE_DEFAULTS', () => {
        test('has all required keys', () => {
            const keys = [
                'type', 'shape', 'width', 'height',
                'fontSize', 'fontSizeMin', 'fontSizeMax', 'fontColor',
                'faceColor', 'edgeColor', 'edgeWidth',
                'toPosition', 'fromPosition', 'popupDirection',
            ]
            keys.forEach(k => {
                expect(NODE_DEFAULTS).toHaveProperty(k)
            })
        })

        test('type is basic', () => {
            expect(NODE_DEFAULTS.type).toBe('basic')
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

        test('positions are valid', () => {
            const valid = ['top', 'bottom', 'left', 'right']
            expect(valid).toContain(NODE_DEFAULTS.toPosition)
            expect(valid).toContain(NODE_DEFAULTS.fromPosition)
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
                'edgeColor', 'edgeWidth', 'markerEnd', 'animated', 'defOffset',
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

        test('markerEnd is a string', () => {
            expect(typeof CONN_DEFAULTS.markerEnd).toBe('string')
        })
    })
})
