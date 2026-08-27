/**
 * 方位由節點決定之元件層行為驗收(anchorPolicy 契約之可執行翻譯; spec/流程_互動契約.md §4)。
 *
 * 規格:
 * B1 拖曳建線 → conn 只有 { id, from, to }, 不含任何方位欄位。
 * B2 改節點 To Handle → 該節點全部出邊之出發方位、與其把手, 一併跟隨。
 * B3 conn 資料即使帶 fromPosition/toPosition 亦不被讀取: 邊方位仍由節點決定。
 * B4 defNode 層: 宿主設 defNodeToPosition 而節點未設時, 邊之出發方位與把手同側。
 * B5 每個節點每種把手恰一個(basic: source+target 各一; input: 僅 source; output: 僅 target)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'

const mkOpt = (extra = {}) => ({
    nodes: [
        { id: '1', type: 'input', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', type: 'output', name: 'N2', position: { x: 300, y: 200 }, width: 100, height: 40 },
        { id: '3', type: 'basic', name: 'N3', position: { x: 0, y: 200 }, width: 100, height: 40 },
    ],
    conns: [],
    ...extra,
})

const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })

const handleEls = (nodeId, type) => [...document.querySelectorAll(`.vue-flow__node[data-id="${nodeId}"] .vue-flow__handle[data-handle-type="${type}"]`)]
const dragCreate = async (w, fromNodeId, toNodeId) => {
    handleEls(fromNodeId, 'source')[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    document.elementFromPoint = () => handleEls(toNodeId, 'target')[0]
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 320, clientY: 210 }))
    await w.vm.$nextTick()
}

afterEach(() => {
    document.elementFromPoint = () => null
})

describe('B1 建線之 conn 不含方位欄位', () => {
    test('自把手拖曳建線: conn 只有 id/from/to', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        await dragCreate(w, '1', '2')
        expect(w.vm.conns).toHaveLength(1)
        expect(Object.keys(w.vm.conns[0]).sort()).toEqual(['from', 'id', 'to'])
        w.destroy()
    })
})

describe('B2 To Handle 跟隨', () => {
    test('拖曳建線後改 To Handle=right: 邊出發方位與把手一併跟隨', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        await dragCreate(w, '1', '2')
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        expect(ew.vm.sourcePosition).toBe('bottom')

        w.vm.onNodeSettingsUpdate({ node: { id: '1' }, key: 'toPosition', value: 'right' })
        await w.vm.$nextTick()
        await w.vm.$nextTick()
        expect(ew.vm.sourcePosition).toBe('right')
        expect(handleEls('1', 'source').map(h => h.dataset.handlePosition)).toEqual(['right'])
        w.destroy()
    })
})

describe('B3 conn 之方位欄位不被讀取', () => {
    test('conn.fromPosition=left / toPosition=right: 邊方位仍由節點決定, 不多長把手', async () => {
        const w = mountFlow(mkOpt({ conns: [{ id: 'e1-2', from: '1', to: '2', fromPosition: 'left', toPosition: 'right' }] }))
        await w.vm.$nextTick()
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        expect(ew.vm.sourcePosition).toBe('bottom')
        expect(ew.vm.targetPosition).toBe('top')
        expect(handleEls('1', 'source')).toHaveLength(1)
        expect(handleEls('2', 'target')).toHaveLength(1)
        w.vm.onNodeSettingsUpdate({ node: { id: '1' }, key: 'toPosition', value: 'right' })
        await w.vm.$nextTick()
        expect(ew.vm.sourcePosition).toBe('right')
        w.destroy()
    })
})

describe('B4 defNode 層', () => {
    test('defNodeToPosition=right 且節點未設: 邊出發方位與把手同為 right', async () => {
        const w = mountFlow(mkOpt({
            defNodeToPosition: 'right',
            conns: [{ id: 'e1-2', from: '1', to: '2' }],
        }))
        await w.vm.$nextTick()
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        expect(handleEls('1', 'source').map(h => h.dataset.handlePosition)).toEqual(['right'])
        expect(ew.vm.sourcePosition).toBe('right')
        w.destroy()
    })
})

describe('B5 每節點每種把手恰一個', () => {
    test('input 僅 source, output 僅 target, basic 各一', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        expect(handleEls('1', 'source')).toHaveLength(1)
        expect(handleEls('1', 'target')).toHaveLength(0)
        expect(handleEls('2', 'source')).toHaveLength(0)
        expect(handleEls('2', 'target')).toHaveLength(1)
        expect(handleEls('3', 'source')).toHaveLength(1)
        expect(handleEls('3', 'target')).toHaveLength(1)
        w.destroy()
    })
})
