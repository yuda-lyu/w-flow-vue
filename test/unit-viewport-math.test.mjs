/**
 * viewport.mjs 純函式契約:
 * V1 computeFitView: 包絡落入「容器扣 padding 後之可視區」且置中; zoom 受 maxZoom 上限; padding 0 合法; 零尺寸包絡不產生 Infinity。
 * V7 padding 為 CSS 像素(不隨 zoom 縮放): 同一 padding 下, 圖形放大 10 倍後四邊實際邊距不變。
 * V8 resolvePadding(數值/物件逐邊回退)與不可行 padding 縮限(單軸兩側和 > 軸長-1 → 等比縮至軸長-1, 內容仍可見)。
 * V2 screenToFlow ∘ flowToScreen 恆等。
 * V3 zoomAroundPoint: 焦點下之畫布點縮放前後不動。
 * V4 clampZoom: 上界 zoomMax; 下界 min(zoomMin, current)(fitView 低於 zoomMin 後滾輪不跳回)。
 * V5 resolveContainerSize: 逐軸回退(寬 0 不迫使高回退); nodesBounds 略過 hidden, 空集合 null。
 * V6 computeCenterView 使指定畫布點落於容器中央。
 */
import { nodesBounds, resolveContainerSize, computeFitView, resolvePadding, screenToFlow, flowToScreen, zoomAroundPoint, clampZoom, computeCenterView, easeInOutCubic } from '../src/js/viewport.mjs'

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
        //padding 為螢幕像素: 可視區 = 容器扣四邊 padding, zoom = min(可視區 / 包絡原尺寸)
        expect(vp.zoom).toBeCloseTo(Math.min((800 - 100) / 1000, (600 - 100) / 500), 10)
        //受限軸(此處為 x)之實際螢幕邊距恰為 padding
        expect(tl.x).toBeCloseTo(50, 6)
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

describe('V7 padding 為 CSS 像素, 不隨 zoom 縮放', () => {
    const margins = (b) => {
        const vp = computeFitView(b, container, { padding: 50, maxZoom: 2 })
        const tl = flowToScreen({ x: b.minX, y: b.minY }, vp)
        const br = flowToScreen({ x: b.maxX, y: b.maxY }, vp)
        return { zoom: vp.zoom, left: tl.x, top: tl.y, right: container.width - br.x, bottom: container.height - br.y }
    }
    test('圖形放大 10 倍(zoom 隨之變小)後, 受限軸之螢幕邊距仍為 padding', () => {
        const m1 = margins({ minX: 0, minY: 0, maxX: 1000, maxY: 500 })
        const m10 = margins({ minX: 0, minY: 0, maxX: 10000, maxY: 5000 })
        expect(m10.zoom).toBeLessThan(m1.zoom / 5) //確為更小之 zoom
        for (const k of ['left', 'right']) {
            expect(m1[k]).toBeCloseTo(50, 6)
            expect(m10[k]).toBeCloseTo(50, 6) //舊語義此處會縮成 50*zoom
        }
    })
    test('非受限軸留白 >= padding 且上下對稱', () => {
        const m = margins({ minX: 0, minY: 0, maxX: 1000, maxY: 100 })
        expect(m.top).toBeGreaterThan(50)
        expect(m.top).toBeCloseTo(m.bottom, 6)
    })
})

describe('V8 padding 正規化與不可行 padding 縮限', () => {
    test('resolvePadding: 數值/物件/非法逐邊回退', () => {
        expect(resolvePadding(20)).toEqual({ top: 20, right: 20, bottom: 20, left: 20 })
        expect(resolvePadding(undefined, 50)).toEqual({ top: 50, right: 50, bottom: 50, left: 50 })
        expect(resolvePadding(-5, 50)).toEqual({ top: 50, right: 50, bottom: 50, left: 50 })
        expect(resolvePadding('10', 50)).toEqual({ top: 50, right: 50, bottom: 50, left: 50 })
        expect(resolvePadding(0, 50)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
        //物件之缺漏邊逐一回退 fallback 之同一邊(fallback 為物件時取其同一邊 → fitView(arg) 之 patch 語義)
        expect(resolvePadding({ left: 120 }, 50)).toEqual({ top: 50, right: 50, bottom: 50, left: 120 })
        expect(resolvePadding({ left: 120 }, { left: 10, top: 8, right: 8, bottom: 8 })).toEqual({ top: 8, right: 8, bottom: 8, left: 120 })
        expect(resolvePadding({ left: 120 }, 0)).toEqual({ top: 0, right: 0, bottom: 0, left: 120 })
    })
    test('不可行 padding(對稱/左大/右大): 等比縮至軸長-1, zoom 為正有限值且內容中心仍在容器內', () => {
        const b = { minX: 0, minY: 0, maxX: 1000, maxY: 500 }
        const center = { x: 500, y: 250 }
        for (const padding of [5000, { left: 9000, right: 500, top: 10, bottom: 10 }, { left: 100, right: 9000, top: 10, bottom: 10 }]) {
            const vp = computeFitView(b, container, { padding })
            expect(vp).not.toBeNull()
            expect(isFinite(vp.zoom)).toBe(true)
            expect(vp.zoom).toBeGreaterThan(0)
            //包絡中心 = 可視區中心, 縮限保證可視區落於容器內 → 內容不會整個被推出畫面
            const c = flowToScreen(center, vp)
            expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThanOrEqual(container.width)
            expect(c.y).toBeGreaterThanOrEqual(0); expect(c.y).toBeLessThanOrEqual(container.height)
        }
    })
    test('預設 50 遇小容器(80×60): 兩側和 100 > 79 → 縮限後仍 fit 於容器內', () => {
        const b = { minX: 0, minY: 0, maxX: 1000, maxY: 500 }
        const small = { width: 80, height: 60 }
        const vp = computeFitView(b, small, { padding: 50 })
        expect(vp.zoom).toBeGreaterThan(0)
        const c = flowToScreen({ x: 500, y: 250 }, vp)
        expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThanOrEqual(small.width)
        expect(c.y).toBeGreaterThanOrEqual(0); expect(c.y).toBeLessThanOrEqual(small.height)
    })
    test('可行 padding 不被縮限(僅真不可行時介入)', () => {
        const b = { minX: 0, minY: 0, maxX: 1000, maxY: 500 }
        const vp = computeFitView(b, container, { padding: { top: 10, right: 10, bottom: 10, left: 200 }, maxZoom: 2 })
        const tl = flowToScreen({ x: b.minX, y: b.minY }, vp)
        const br = flowToScreen({ x: b.maxX, y: b.maxY }, vp)
        expect(tl.x).toBeCloseTo(200, 6)
        expect(container.width - br.x).toBeCloseTo(10, 6)
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
