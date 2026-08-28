/**
 * domGesture.mjs(document 層手勢工具)契約:
 * D1 啟動掛 mousemove/mouseup/blur 與全域游標; mouseup / blur / buttons-lost 各以對應 reason 恰終止一次, 之後監聽與游標樣式皆移除。
 * D2 dispose: 主動收尾不呼叫 onEnd, 回傳是否確實收到進行中手勢; 重複呼叫安全。
 * D3 requirePrimary=false 時 mousemove 之 buttons=0 不終止(label 追蹤等純觀察用途)。
 * D4 gestureBlockedReason 三段判準順序 multiselect → gesture → button; crossedThreshold 任一軸 >= 3。
 * D5 geometry.computeResize 四角代數(含 snap / 最小尺寸), 左/上角以對邊固定。
 */
import { startDocumentGesture, installGlobalCursor, gestureBlockedReason, crossedThreshold, DRAG_THRESHOLD_PX } from '../src/js/domGesture.mjs'
import { computeResize } from '../src/js/geometry.mjs'

const cursorStyles = () => [...document.head.querySelectorAll('style[data-vf-cursor]')]
const move = (buttons, x = 0, y = 0) => document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons, clientX: x, clientY: y }))
const up = () => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

describe('D1 終止原因與收尾', () => {
    test.each([
        ['mouseup', () => up()],
        ['blur', () => window.dispatchEvent(new Event('blur'))],
        ['buttons-lost', () => move(0)],
    ])('%s → onEnd 一次, 監聽與游標移除', (reason, fire) => {
        const ends = []
        const moves = []
        const g = startDocumentGesture({ cursor: 'move', onMove: (e) => moves.push(e.clientX), onEnd: (r) => ends.push(r) })
        expect(cursorStyles().length).toBe(1)
        move(1, 5, 5)
        expect(moves).toEqual([5])
        fire()
        expect(ends).toEqual([reason])
        expect(g.isActive()).toBe(false)
        expect(cursorStyles().length).toBe(0)
        //已終止: 後續事件不再觸發
        move(1, 9, 9); up(); window.dispatchEvent(new Event('blur'))
        expect(moves).toEqual([5])
        expect(ends).toEqual([reason])
        expect(g.dispose()).toBe(false)
    })
})

describe('D2 dispose', () => {
    test('主動收尾不呼叫 onEnd; 回傳值; 重複安全', () => {
        const ends = []
        const g = startDocumentGesture({ cursor: 'nwse-resize', onEnd: (r) => ends.push(r) })
        expect(g.dispose()).toBe(true)
        expect(g.dispose()).toBe(false)
        expect(ends).toEqual([])
        expect(cursorStyles().length).toBe(0)
        up()
        expect(ends).toEqual([])
    })
    test('installGlobalCursor 成對', () => {
        const off = installGlobalCursor('grab')
        expect(cursorStyles().length).toBe(1)
        expect(cursorStyles()[0].textContent).toContain('grab')
        off(); off()
        expect(cursorStyles().length).toBe(0)
        expect(typeof installGlobalCursor(null)).toBe('function')
    })
})

describe('D3 requirePrimary=false', () => {
    test('buttons=0 之 mousemove 不終止', () => {
        const ends = []
        const moves = []
        const g = startDocumentGesture({ requirePrimary: false, onMove: () => moves.push(1), onEnd: (r) => ends.push(r) })
        move(0)
        expect(moves).toEqual([1]); expect(ends).toEqual([])
        g.dispose()
    })
})

describe('D4 守衛與門檻', () => {
    test('gestureBlockedReason 順序', () => {
        expect(gestureBlockedReason({ button: 0, multiSelectActive: false, activeGesture: null })).toBeNull()
        expect(gestureBlockedReason({ button: 2, multiSelectActive: true, activeGesture: 'drag' })).toBe('multiselect')
        expect(gestureBlockedReason({ button: 2, multiSelectActive: false, activeGesture: 'drag' })).toBe('gesture')
        expect(gestureBlockedReason({ button: 2, multiSelectActive: false, activeGesture: null })).toBe('button')
        expect(gestureBlockedReason({ multiSelectActive: false, activeGesture: null })).toBeNull()
    })
    test('crossedThreshold', () => {
        expect(DRAG_THRESHOLD_PX).toBe(3)
        expect(crossedThreshold(0, 0, 2, 2)).toBe(false)
        expect(crossedThreshold(0, 0, 3, 0)).toBe(true)
        expect(crossedThreshold(10, 10, 10, 7)).toBe(true)
        expect(crossedThreshold(0, 0, 4, 0, 5)).toBe(false)
    })
})

describe('D5 computeResize', () => {
    const start = { x: 100, y: 50, width: 120, height: 60 }
    test('四角: 右/下增大, 左/上以對邊固定', () => {
        expect(computeResize('bottom-right', start, { dx: 10, dy: 5 }, { snap: 0, minSize: 10 })).toEqual({ width: 130, height: 65, x: 100, y: 50 })
        expect(computeResize('top-left', start, { dx: 10, dy: 5 }, { snap: 0, minSize: 10 })).toEqual({ width: 110, height: 55, x: 110, y: 55 })
        expect(computeResize('top-right', start, { dx: -20, dy: -10 }, { snap: 0, minSize: 10 })).toEqual({ width: 100, height: 70, x: 100, y: 40 })
        expect(computeResize('bottom-left', start, { dx: -20, dy: -10 }, { snap: 0, minSize: 10 })).toEqual({ width: 140, height: 50, x: 80, y: 50 })
    })
    test('snap 與最小尺寸', () => {
        expect(computeResize('bottom-right', start, { dx: 7, dy: -58 }, { snap: 20, minSize: 10 })).toEqual({ width: 120, height: 20, x: 100, y: 50 })
        expect(computeResize('bottom-right', start, { dx: -200, dy: -200 }, { snap: 0, minSize: 10 })).toEqual({ width: 10, height: 10, x: 100, y: 50 })
        expect(computeResize('top-left', start, { dx: 200, dy: 200 }, { snap: 0, minSize: 10 })).toEqual({ width: 10, height: 10, x: 210, y: 100 })
    })
})
