/**
 * viewport.mjs 純函式契約:
 * V1 computeFitView: 包絡(含 padding)落入容器且置中; zoom 受 maxZoom 上限; padding 0 合法; 零尺寸包絡不產生 Infinity。
 * V2 screenToFlow ∘ flowToScreen 恆等。
 * V3 zoomAroundPoint: 焦點下之畫布點縮放前後不動。
 * V4 clampZoom: 上界 zoomMax; 下界 min(zoomMin, current)(fitView 低於 zoomMin 後滾輪不跳回)。
 * V5 resolveContainerSize: 逐軸回退(寬 0 不迫使高回退); nodesBounds 略過 hidden, 空集合 null。
 * V6 computeCenterView 使指定畫布點落於容器中央。
 */
import { nodesBounds, resolveContainerSize, computeFitView, screenToFlow, flowToScreen, zoomAroundPoint, clampZoom, computeCenterView, easeInOutCubic } from '../src/js/viewport.mjs'

const container = { width: 800, height: 600 }

describe('V1 computeFitView', () => {
    const bounds = { minX: 100, minY: 200, maxX: 1100, maxY: 700 }
    test('包絡落入容器且置中', () => {
        const vp = computeFitView(bounds, container, { padding: 50, maxZoom: 2 })
        const tl = flowToScreen({ x: bounds.minX, y: bounds.minY }, vp)
        const br = flowToScreen({ x: bounds.maxX, y: bounds.maxY }, vp)
        expect(tl.x).toBeGreaterThanOrEqual(0); expect(tl.y).toBeGreaterThanOrEqual(0)
        expect(br.x).toBeLessThanOrEqual(container.width); expect(br.y).toBeLessThanOrEqual(container.height)
        expect(tl.x + (container.width - br.x)).toBeCloseTo(2 * (tl.x), 6) //左右留白相等
        expect(tl.y).toBeCloseTo(container.height - br.y, 6)
        expect(vp.zoom).toBeCloseTo(Math.min(800 / 1100, 600 / 600), 10)
    })
    test('padding 0 合法且 zoom 大於 padding 50', () => {
        const z0 = computeFitView(bounds, container, { padding: 0 }).zoom
        const z50 = computeFitView(bounds, container, { padding: 50 }).zoom
        expect(z0).toBeGreaterThan(z50)
    })
    test('maxZoom 上限; 零尺寸包絡不產生 Infinity', () => {
        const small = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
        expect(computeFitView(small, container, { padding: 0, maxZoom: 2 }).zoom).toBe(2)
        const pt = computeFitView({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, container, { padding: 0, maxZoom: 3 })
        expect(isFinite(pt.zoom)).toBe(true)
        expect(pt.zoom).toBe(3)
    })
    test('容器 0 或 bounds null 回 null', () => {
        expect(computeFitView(null, container)).toBeNull()
        expect(computeFitView(bounds, { width: 0, height: 600 })).toBeNull()
    })
})

describe('V2/V3 座標與縮放公式', () => {
    const vp = { x: 37, y: -12, zoom: 1.7 }
    test('screenToFlow ∘ flowToScreen 恆等', () => {
        const p = { x: 123.4, y: -56.7 }
        const r = screenToFlow(flowToScreen(p, vp), vp)
        expect(r.x).toBeCloseTo(p.x, 9); expect(r.y).toBeCloseTo(p.y, 9)
    })
    test('zoomAroundPoint 焦點不動', () => {
        const focal = { x: 300, y: 200 }
        const before = screenToFlow(focal, vp)
        const after = screenToFlow(focal, zoomAroundPoint(vp, focal, 0.6))
        expect(after.x).toBeCloseTo(before.x, 9); expect(after.y).toBeCloseTo(before.y, 9)
    })
})

describe('V4 clampZoom', () => {
    test('上界; 下界取 min(zoomMin, current)', () => {
        expect(clampZoom(5, 0.5, 2, 1)).toBe(2)
        expect(clampZoom(0.1, 0.5, 2, 1)).toBe(0.5)
        expect(clampZoom(0.1, 0.5, 2, 0.3)).toBe(0.3)
        expect(clampZoom(0.35, 0.5, 2, 0.3)).toBe(0.35)
    })
})

describe('V5 容器與包絡', () => {
    test('resolveContainerSize 逐軸回退', () => {
        expect(resolveContainerSize({ width: 0, height: 500 }, container)).toEqual({ width: 800, height: 500 })
        expect(resolveContainerSize(null, container)).toEqual(container)
        expect(resolveContainerSize({ width: NaN, height: -1 }, container)).toEqual(container)
    })
    test('nodesBounds 略過 hidden; 空集合 null; 尺寸走 resolveNodeSize', () => {
        const nodes = [
            { id: 'a', position: { x: 10, y: 20 }, width: 100, height: 40 },
            { id: 'h', position: { x: 9999, y: 9999 }, hidden: true },
            { id: 'b', position: { x: 300, y: 100 } },
        ]
        expect(nodesBounds(nodes, { b: { width: 50, height: 30 } })).toEqual({ minX: 10, minY: 20, maxX: 350, maxY: 130 })
        expect(nodesBounds([], {})).toBeNull()
        expect(nodesBounds([{ id: 'h', position: { x: 0, y: 0 }, hidden: true }], {})).toBeNull()
    })
})

describe('V6 computeCenterView / easing', () => {
    test('指定畫布點落於容器中央', () => {
        const vp = computeCenterView({ x: 150, y: 70 }, container, 2)
        expect(flowToScreen({ x: 150, y: 70 }, vp)).toEqual({ x: 400, y: 300 })
    })
    test('easeInOutCubic 端點與中點', () => {
        expect(easeInOutCubic(0)).toBe(0); expect(easeInOutCubic(1)).toBe(1); expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9)
    })
})
