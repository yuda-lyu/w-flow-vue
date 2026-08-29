/**
 * 初始化視口(opt.fitViewOnInit, 預設 true; WFlowVue JSDoc):
 * I1 預設: 首幀根帶 vue-flow--pending; 下一 tick 已以實測尺寸 fit(viewport = computeFitView 結果, 容器 rect 0×0 時逐軸回退 opt 寬高);
 *    pending 解除後之下一 tick 才發 init, 且只發一次; 之後根無 pending。
 * I2 fitViewOnInit=false: 沿用 center/zoom; init 同樣於首幀後發、只發一次。
 * I3 初始化時無節點: pending 立即解除; 之後首次填入節點 → fit 一次; 若使用者已改動 viewport 則不 fit。
 * I4 fitViewPadding: 0 合法; fitView(0) 之 zoom 大於 fitView(50); fitView() 無參數取 opt.fitViewPadding。
 * I5 zoom 上限用 opt.zoomMax(小圖不會被放大超過)。
 * I6 padding 契約: 0 = 貼邊(受限軸邊距 0, 節點可入工具區下); 物件為對 opt 解析值之逐邊 patch; fit 不為選單讓位。
 * I7 fit 低於 zoomMin 後之縮放下界流程(整合): zoomOut 不動 → zoomIn 可升 → 越過 zoomMin 後下界恢復。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import { nodesBounds, computeFitView } from '../src/js/viewport.mjs'

const nodes = () => [
    { id: 'a', name: 'A', position: { x: 1000, y: 800 }, width: 100, height: 40 },
    { id: 'b', name: 'B', position: { x: 1600, y: 1300 }, width: 100, height: 40 },
]
const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt: { width: 800, height: 600, nodes: nodes(), conns: [], ...opt } }, attachTo: document.body })
const tick = async (w, n = 2) => { for (let i = 0; i < n; i++) await w.vm.$nextTick() }
const expected = (w, padding) => computeFitView(nodesBounds(w.vm.nodes, w.vm.nodeInternals, w.vm.defNode), { width: 800, height: 600 }, { padding, maxZoom: w.vm.zoomMax })

describe('I1 預設 fit-on-init', () => {
    test('首幀 pending → fit → 解除 → init 一次', async () => {
        const w = mountFlow({})
        expect(w.classes()).toContain('vue-flow--pending')
        expect(w.attributes('aria-busy')).toBe('true')
        expect(w.emitted('init')).toBeFalsy()
        await w.vm.$nextTick()
        //fit 已完成、pending 已解除, init 於再下一 tick
        expect(w.classes()).not.toContain('vue-flow--pending')
        const exp = expected(w, 50)
        expect(w.vm.viewport.zoom).toBeCloseTo(exp.zoom, 9)
        expect(w.vm.viewport.x).toBeCloseTo(exp.x, 9)
        expect(w.vm.viewport.y).toBeCloseTo(exp.y, 9)
        expect(w.vm.viewport.zoom).toBeGreaterThan(0)
        expect(w.vm.viewport.zoom).toBeLessThan(1)
        await w.vm.$nextTick()
        expect(w.emitted('init')).toHaveLength(1)
        await tick(w, 3)
        expect(w.emitted('init')).toHaveLength(1)
        expect(w.attributes('aria-busy')).toBeUndefined()
        w.destroy()
    })
})

describe('I2 fitViewOnInit=false', () => {
    test('center/zoom 直接套用; init 於首幀後發一次', async () => {
        const w = mountFlow({ fitViewOnInit: false, center: [50, 100], zoom: 1.5 })
        expect(w.vm.viewport).toEqual({ x: 50, y: 100, zoom: 1.5 })
        expect(w.emitted('init')).toBeFalsy()
        await tick(w, 2)
        expect(w.vm.viewport).toEqual({ x: 50, y: 100, zoom: 1.5 })
        expect(w.emitted('init')).toHaveLength(1)
        expect(w.classes()).not.toContain('vue-flow--pending')
        w.destroy()
    })
})

describe('I3 初始化無節點', () => {
    test('pending 立即解除; 首次填入節點 fit 一次', async () => {
        const w = mountFlow({ nodes: [] })
        await tick(w, 2)
        expect(w.classes()).not.toContain('vue-flow--pending')
        expect(w.emitted('init')).toHaveLength(1)
        expect(w.vm.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
        w.vm.opt.nodes = nodes()
        await w.vm.$nextTick()
        await w.vm.$nextTick()
        const exp = expected(w, 50)
        expect(w.vm.viewport.zoom).toBeCloseTo(exp.zoom, 9)
        expect(w.classes()).not.toContain('vue-flow--pending')
        //之後再填入不再 fit
        const z = w.vm.viewport.zoom
        w.vm.opt.nodes = [...nodes(), { id: 'c', name: 'C', position: { x: 5000, y: 5000 }, width: 100, height: 40 }]
        await tick(w, 2)
        expect(w.vm.viewport.zoom).toBe(z)
        w.destroy()
    })
    test('使用者已改動 viewport 則填入節點不 fit', async () => {
        const w = mountFlow({ nodes: [] })
        await tick(w, 2)
        w.vm.zoomIn()
        const vp = { ...w.vm.viewport }
        w.vm.opt.nodes = nodes()
        await tick(w, 2)
        expect(w.vm.viewport).toEqual(vp)
        w.destroy()
    })
})

describe('I4/I5 padding 與 zoomMax', () => {
    test('padding 0 合法; 無參數取 opt.fitViewPadding', async () => {
        const w = mountFlow({ fitViewPadding: 0 })
        await tick(w, 2)
        const z0 = w.vm.viewport.zoom
        expect(z0).toBeCloseTo(expected(w, 0).zoom, 9)
        w.vm.fitView(50)
        expect(w.vm.viewport.zoom).toBeLessThan(z0)
        w.vm.fitView()
        expect(w.vm.viewport.zoom).toBeCloseTo(z0, 9)
        w.destroy()
    })
    test('小圖 fit 之 zoom 受 zoomMax 上限', async () => {
        const w = mountFlow({ zoomMax: 1.5, nodes: [{ id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 10, height: 10 }] })
        await tick(w, 2)
        expect(w.vm.viewport.zoom).toBe(1.5)
        const w2 = mountFlow({ zoomMax: 3, nodes: [{ id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 10, height: 10 }] })
        await tick(w2, 2)
        expect(w2.vm.viewport.zoom).toBe(3)
        w.destroy(); w2.destroy()
    })
})

describe('I6 padding 契約(0 = 貼邊; 物件為逐邊 patch; 不為選單讓位)', () => {
    //寬受限圖形(2000×1000 於 800×600 容器): 受限軸(x)之螢幕邊距恰為該邊 padding
    const wideNodes = () => [{ id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 2000, height: 1000 }]
    const leftMargin = (w) => w.vm.viewport.x
    const rightMargin = (w) => 800 - (2000 * w.vm.viewport.zoom + w.vm.viewport.x)

    test('fitView(0): 受限軸貼邊(邊距 0, 節點可入工具區下——留白一律由 padding 決定)', async () => {
        const w = mountFlow({ nodes: wideNodes() })
        await tick(w, 2)
        w.vm.fitView(0)
        expect(leftMargin(w)).toBeCloseTo(0, 9)
        expect(rightMargin(w)).toBeCloseTo(0, 9)
        w.destroy()
    })
    test('opt.fitViewPadding = 0: 初始 fit 即貼邊', async () => {
        const w = mountFlow({ fitViewPadding: 0, nodes: wideNodes() })
        await tick(w, 2)
        expect(leftMargin(w)).toBeCloseTo(0, 9)
        expect(rightMargin(w)).toBeCloseTo(0, 9)
        w.destroy()
    })
    test('未給 → 預設 50: 受限軸邊距 50(> 工具區右緣 40, 預設不遮)', async () => {
        const w = mountFlow({ nodes: wideNodes() })
        await tick(w, 2)
        expect(leftMargin(w)).toBeCloseTo(50, 9)
        expect(rightMargin(w)).toBeCloseTo(50, 9)
        w.destroy()
    })
    test('fitView({left:120}) 為對 opt 解析值之逐邊 patch(opt 未給 → 其餘邊 50; opt=0 → 其餘邊 0)', async () => {
        const w = mountFlow({ nodes: wideNodes() })
        await tick(w, 2)
        w.vm.fitView({ left: 120 })
        expect(leftMargin(w)).toBeCloseTo(120, 9)
        expect(rightMargin(w)).toBeCloseTo(50, 9)
        const w2 = mountFlow({ fitViewPadding: 0, nodes: wideNodes() })
        await tick(w2, 2)
        w2.vm.fitView({ left: 120 })
        expect(w2.vm.viewport.x).toBeCloseTo(120, 9)
        expect(800 - (2000 * w2.vm.viewport.zoom + w2.vm.viewport.x)).toBeCloseTo(0, 9)
        w.destroy(); w2.destroy()
    })
    test('opt 為物件: 缺漏邊回退 50', async () => {
        const w = mountFlow({ fitViewPadding: { left: 120 }, nodes: wideNodes() })
        await tick(w, 2)
        expect(leftMargin(w)).toBeCloseTo(120, 9)
        expect(rightMargin(w)).toBeCloseTo(50, 9)
        w.destroy()
    })
})

describe('I7 fit 低於 zoomMin 後之縮放下界流程(整合)', () => {
    test('zoomOut 不動 → zoomIn 可升 → 越過 zoomMin 後下界恢復 zoomMin', async () => {
        //fit zoom = (800-100)/2000 = 0.35 < zoomMin 0.5
        const w = mountFlow({ nodes: [{ id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 2000, height: 1000 }] })
        await tick(w, 2)
        const z0 = w.vm.viewport.zoom
        expect(z0).toBeCloseTo(0.35, 9)
        w.vm.zoomOut()
        expect(w.vm.viewport.zoom).toBeCloseTo(z0, 9) //下界 = min(zoomMin, current) = current → 不再下探
        w.vm.zoomIn()
        expect(w.vm.viewport.zoom).toBeCloseTo(z0 * 1.2, 9) //仍 < zoomMin, 但向上恢復允許
        w.vm.zoomIn()
        w.vm.zoomIn()
        expect(w.vm.viewport.zoom).toBeGreaterThan(0.5) //已越過 zoomMin
        for (let i = 0; i < 10; i++) w.vm.zoomOut()
        expect(w.vm.viewport.zoom).toBeCloseTo(0.5, 9) //下界恢復 zoomMin, 不再回到 fit 之低值
        w.destroy()
    })
})
