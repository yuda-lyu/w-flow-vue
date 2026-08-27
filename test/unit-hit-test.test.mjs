/**
 * hit 分類與「affordance 不代表宿主」契約之驗收(spec/流程_互動契約.md §3; hitTest.mjs)。
 *
 * 規格:
 * T1 classifyHit 由內而外: 齒輪(含 anchor)/四角/把手/轉折點/工具列先於 node/edge; 皆無則 canvas; flowRoot 之外不計。
 * T2 按住連線本體(interaction path / label)拖曳不平移畫布(修正前實測會平移); 按畫布空白平移。
 * T3 工具列上之 dblclick / contextmenu 不發 canvas-dblclick / pane-context-menu。
 * T4 節點齒輪/把手/四角上之 dblclick / contextmenu 不發 node-double-click / node-context-menu(與邊對稱; 修正前實測會發)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import { classifyHit, isAffordanceHit, isCanvasBlank } from '../src/js/hitTest.mjs'

const mkOpt = () => ({
    nodes: [
        { id: '1', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', name: 'N2', position: { x: 300, y: 0 }, width: 100, height: 40 },
    ],
    conns: [{ id: 'e1', from: '1', to: '2', name: 'L', points: [[150, 100]] }],
    //本檔以 hover 使齒輪出現後測 hit 分類, 顯式指定 hover 模式(預設 dblclick)
    nodesSettingsTrigger: 'hover',
    connsSettingsTrigger: 'hover',
})
const mountFlow = () => mount(WFlowVue, { propsData: { opt: mkOpt() }, attachTo: document.body })
const hover = async (w, sel) => { await w.find(sel).trigger('mouseenter') }

describe('T1 classifyHit', () => {
    test('由內而外分類與 flowRoot 邊界', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        const root = w.vm.$el
        await hover(w, '.vue-flow__node[data-id="1"]')
        expect(classifyHit(w.find('.vue-flow__node[data-id="1"] .vue-flow__node-settings svg').element, root)).toBe('node-gear')
        expect(classifyHit(w.find('.vue-flow__node[data-id="1"] .vue-flow__resize').element, root)).toBe('resize')
        expect(classifyHit(w.find('.vue-flow__node[data-id="1"] .vue-flow__handle').element, root)).toBe('handle')
        expect(classifyHit(w.find('.vue-flow__node[data-id="1"] .vue-flow__node-body').element, root)).toBe('node')
        expect(classifyHit(w.find('.vue-flow__edge-waypoint').element, root)).toBe('waypoint')
        expect(classifyHit(w.find('.vue-flow__edge-interaction').element, root)).toBe('edge')
        expect(classifyHit(w.find('.vue-flow__edge-label').element, root)).toBe('edge')
        expect(classifyHit(w.find('.vue-flow__panel').element, root)).toBe('panel')
        expect(classifyHit(w.find('.vue-flow').element, root)).toBe('canvas')
        expect(classifyHit(null, root)).toBe('canvas')
        //flowRoot 之外的同名元素不算
        const foreign = document.createElement('div')
        foreign.className = 'vue-flow__node'
        document.body.appendChild(foreign)
        expect(classifyHit(foreign, root)).toBe('canvas')
        foreign.remove()
        expect(isAffordanceHit('handle')).toBe(true)
        expect(isAffordanceHit('node')).toBe(false)
        expect(isCanvasBlank(w.find('.vue-flow').element, root)).toBe(true)
        w.destroy()
    })
})

describe('T2 按線本體不平移', () => {
    test('interaction path / label 之 mousedown 不啟動 pan; 畫布空白啟動', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await w.find('.vue-flow__edge-interaction').trigger('mousedown', { button: 0 })
        expect(w.vm.isPanning).toBe(false)
        expect(w.vm.activeGesture).toBe(null)
        await w.find('.vue-flow__edge-label').trigger('mousedown', { button: 0 })
        expect(w.vm.isPanning).toBe(false)
        await w.find('.vue-flow').trigger('mousedown', { button: 0 })
        expect(w.vm.isPanning).toBe(true)
        expect(w.vm.activeGesture).toBe('pan')
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        expect(w.vm.isPanning).toBe(false)
        expect(w.vm.activeGesture).toBe(null)
        w.destroy()
    })
})

describe('T3 工具列不代表畫布', () => {
    test('panel 之 dblclick / contextmenu 不發畫布事件; 畫布空白照發', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await w.find('.vue-flow__panel').trigger('dblclick')
        await w.find('.vue-flow__panel').trigger('contextmenu')
        expect(w.emitted('canvas-dblclick')).toBeFalsy()
        expect(w.emitted('pane-context-menu')).toBeFalsy()
        await w.find('.vue-flow').trigger('dblclick')
        await w.find('.vue-flow').trigger('contextmenu')
        expect(w.emitted('canvas-dblclick')).toHaveLength(1)
        expect(w.emitted('pane-context-menu')).toHaveLength(1)
        w.destroy()
    })
})

describe('T4 節點 affordance 不代表節點(與邊對稱)', () => {
    test.each([
        ['齒輪', '.vue-flow__node[data-id="1"] .vue-flow__node-settings'],
        ['把手', '.vue-flow__node[data-id="1"] .vue-flow__handle--bottom'],
        ['四角', '.vue-flow__node[data-id="1"] .vue-flow__resize'],
    ])('%s 之 dblclick / contextmenu 不發事件', async (_l, sel) => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await hover(w, '.vue-flow__node[data-id="1"]')
        await w.find(sel).trigger('dblclick')
        await w.find(sel).trigger('contextmenu')
        expect(w.emitted('node-double-click')).toBeFalsy()
        expect(w.emitted('node-context-menu')).toBeFalsy()
        //節點本體照發
        await w.find('.vue-flow__node[data-id="1"] .vue-flow__node-body').trigger('dblclick')
        await w.find('.vue-flow__node[data-id="1"] .vue-flow__node-body').trigger('contextmenu')
        expect(w.emitted('node-double-click')).toHaveLength(1)
        expect(w.emitted('node-context-menu')).toHaveLength(1)
        w.destroy()
    })
})
