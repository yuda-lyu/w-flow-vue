/**
 * 圖台尺寸變更(opt.width/height)之視口補正與 resize 事件(WFlowVue JSDoc @event resize; 契約 §9):
 * Z1 recenterForResize 純函式: 舊容器中心之畫布點於新容器仍居中; zoom 不變。
 * Z2 變寬/變高: viewport 平移半差值; 發 resize 一次, payload { width, height, oldWidth, oldHeight, viewport }; 同值不發。
 * Z3 使用者情境: 節點 a 置中後改寬/高 → 節點 a 中心仍位於新圖中心。
 * Z4 初始化前(空節點)之 resize 不視為使用者改動 viewport: 之後首次填入節點仍自動 fit。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import { recenterForResize, screenToFlow, flowToScreen } from '../src/js/viewport.mjs'

const nodes = () => [
    { id: 'a', name: 'A', position: { x: 100, y: 80 }, width: 100, height: 40 },
    { id: 'b', name: 'B', position: { x: 500, y: 400 }, width: 100, height: 40 },
]
const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt: { width: 800, height: 600, nodes: nodes(), conns: [], ...opt } }, attachTo: document.body })
const tick = async (w, n = 2) => { for (let i = 0; i < n; i++) await w.vm.$nextTick() }

describe('Z1 recenterForResize', () => {
    test('舊中心畫布點居於新中心; zoom 不變', () => {
        const vp = { x: 37, y: -12, zoom: 1.6 }
        const oldSize = { width: 800, height: 600 }
        const newSize = { width: 500, height: 900 }
        const nv = recenterForResize(vp, oldSize, newSize)
        const oldCenterFlow = screenToFlow({ x: 400, y: 300 }, vp)
        expect(flowToScreen(oldCenterFlow, nv)).toEqual({ x: 250, y: 450 })
        expect(nv.zoom).toBe(1.6)
    })
})

describe('Z2 resize 事件與補正', () => {
    test('變寬: x 平移半差值; payload 完整; 同值不發; 變高: y 平移', async () => {
        const w = mountFlow({})
        await tick(w, 3)
        const vp0 = { ...w.vm.viewport }
        const centerFlow = screenToFlow({ x: 400, y: 300 }, vp0)
        w.vm.opt.width = 400
        await tick(w)
        expect(w.vm.viewport.x).toBeCloseTo(vp0.x - 200, 9)
        expect(w.vm.viewport.zoom).toBe(vp0.zoom)
        expect(flowToScreen(centerFlow, w.vm.viewport).x).toBeCloseTo(200, 9)
        const ev = w.emitted('resize')
        expect(ev).toHaveLength(1)
        expect(ev[0][0]).toMatchObject({ width: 400, height: 600, oldWidth: 800, oldHeight: 600 })
        expect(ev[0][0].viewport).toEqual({ ...w.vm.viewport })
        //同值重設不發
        w.vm.opt.width = 400
        await tick(w)
        expect(w.emitted('resize')).toHaveLength(1)
        //變高: y 平移半差值
        w.vm.opt.height = 900
        await tick(w)
        expect(w.vm.viewport.y).toBeCloseTo(vp0.y + 150, 9)
        expect(w.emitted('resize')).toHaveLength(2)
        expect(w.emitted('resize')[1][0]).toMatchObject({ width: 400, height: 900, oldWidth: 400, oldHeight: 600 })
        w.destroy()
    })
})

describe('Z3 節點 a 置中後改尺寸', () => {
    test('節點 a 中心仍位於新圖中心(寬與高各一次)', async () => {
        const w = mountFlow({})
        await tick(w, 3)
        w.vm.panToNode('a', { duration: 0 })
        const aCenter = { x: 150, y: 100 }
        expect(flowToScreen(aCenter, w.vm.viewport)).toEqual({ x: 400, y: 300 })
        w.vm.opt.width = 300
        await tick(w)
        expect(flowToScreen(aCenter, w.vm.viewport).x).toBeCloseTo(150, 9)
        w.vm.opt.height = 300
        await tick(w)
        expect(flowToScreen(aCenter, w.vm.viewport).y).toBeCloseTo(150, 9)
        w.destroy()
    })
})

describe('Z4 與初始 fit 之互動', () => {
    test('空節點時 resize 不阻斷之後的首次填入 fit', async () => {
        const w = mountFlow({ nodes: [] })
        await tick(w, 3)
        w.vm.opt.width = 400
        await tick(w)
        expect(w.emitted('resize')).toHaveLength(1)
        w.vm.opt.nodes = nodes()
        await tick(w, 3)
        //仍自動 fit(viewport 不再是單純平移後之原點視口)
        expect(w.vm.viewport.zoom).toBeLessThan(1)
        w.destroy()
    })
})
