/**
 * 錨點 Auto/Fixed 語義之元件層行為驗收(anchorPolicy 契約之可執行翻譯)。
 *
 * 規格:
 * B1 自預設(Auto)把手拖曳建線 → conn 不烙印 fromPosition/toPosition。
 * B2 改節點 To Handle → 該節點全部 Auto 出邊之出發方位、與其把手, 一併跟隨(宿主回報之核心場景)。
 * B3 Fixed 邊(conn 自帶方位)不受節點/defNode 設定影響。
 * B4 連線表單改 Auto(清空)後, 該邊恢復跟隨節點設定。
 * B5 defNode 分家修復: 宿主設 defNodeToPosition 而節點未設時, 邊之出發方位與把手同側(先前
 *    EdgeWrapper 漏看 defNode, 把手畫在 defNode 側、邊卻自內建 bottom 出發)。
 * B6 既有邊全為 Fixed 時, 預設 Auto 把手仍存在(可再拉 Auto 邊)。
 * B7 自 Fixed 把手拖曳建線 → 烙印該方位(明確選擇)。
 * B8 批次改 Auto(node-anchors-unfix): 清除該側全部固定錨點並發 update:conns; 對側不受影響。
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

const srcHandleEls = (nodeId) => [...document.querySelectorAll(`.vue-flow__node[data-id="${nodeId}"] .vue-flow__handle[data-handle-type="source"]`)]
const dragCreate = async (w, fromNodeId, toNodeId, pickSide = null) => {
    const hs = srcHandleEls(fromNodeId)
    const el = pickSide ? hs.find(h => h.dataset.handlePosition === pickSide) : hs[0]
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    const tgt = document.querySelector(`.vue-flow__node[data-id="${toNodeId}"] .vue-flow__handle[data-handle-type="target"]`)
    document.elementFromPoint = () => tgt
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 320, clientY: 210 }))
    await w.vm.$nextTick()
}

afterEach(() => {
    document.elementFromPoint = () => null
})

describe('B1 Auto 建線不烙印', () => {
    test('自預設把手拖曳建線: conn 無 fromPosition/toPosition', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        await dragCreate(w, '1', '2')
        expect(w.vm.conns).toHaveLength(1)
        expect('fromPosition' in w.vm.conns[0]).toBe(false)
        expect('toPosition' in w.vm.conns[0]).toBe(false)
        w.destroy()
    })
})

describe('B2 To Handle 跟隨(宿主回報場景)', () => {
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
        const sides = srcHandleEls('1').map(h => h.dataset.handlePosition)
        expect(sides).toEqual(['right'])
        w.destroy()
    })
})

describe('B3 Fixed 邊不受節點設定影響', () => {
    test('conn.fromPosition=left 之邊: 改 To Handle 不動', async () => {
        const w = mountFlow(mkOpt({ conns: [{ id: 'e1-2', from: '1', to: '2', fromPosition: 'left' }] }))
        await w.vm.$nextTick()
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        expect(ew.vm.sourcePosition).toBe('left')
        w.vm.onNodeSettingsUpdate({ node: { id: '1' }, key: 'toPosition', value: 'right' })
        await w.vm.$nextTick()
        expect(ew.vm.sourcePosition).toBe('left')
        w.destroy()
    })
})

describe('B4 連線表單改 Auto 後恢復跟隨', () => {
    test('清除 conn.fromPosition → 跟隨節點 toPosition', async () => {
        const w = mountFlow(mkOpt({ conns: [{ id: 'e1-2', from: '1', to: '2', fromPosition: 'left' }] }))
        await w.vm.$nextTick()
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        w.vm.onNodeSettingsUpdate({ node: { id: '1' }, key: 'toPosition', value: 'right' })
        //連線表單之 Auto 選項: $emit('update','fromPosition', undefined)
        w.vm.onConnSettingsUpdate({ conn: { id: 'e1-2' }, key: 'fromPosition', value: undefined })
        await w.vm.$nextTick()
        expect(ew.vm.sourcePosition).toBe('right')
        w.destroy()
    })
})

describe('B5 defNode 分家修復', () => {
    test('defNodeToPosition=right 且節點未設: 邊出發方位與把手同為 right', async () => {
        const w = mountFlow(mkOpt({
            defNodeToPosition: 'right',
            conns: [{ id: 'e1-2', from: '1', to: '2' }],
        }))
        await w.vm.$nextTick()
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        const sides = srcHandleEls('1').map(h => h.dataset.handlePosition)
        expect(sides).toEqual(['right'])
        //修正前: 把手 right、邊卻自 'bottom' 出發(EdgeWrapper 漏看 defNode)
        expect(ew.vm.sourcePosition).toBe('right')
        w.destroy()
    })
})

describe('B6 全 Fixed 時預設 Auto 把手仍在', () => {
    test('出邊全固定於 left: 預設(bottom)Auto 把手仍渲染', async () => {
        const w = mountFlow(mkOpt({ conns: [{ id: 'e1-2', from: '1', to: '2', fromPosition: 'left' }] }))
        await w.vm.$nextTick()
        const hs = srcHandleEls('1')
        const bySide = Object.fromEntries(hs.map(h => [h.dataset.handlePosition, h.dataset.handleBinding]))
        expect(bySide.bottom).toBe('auto')
        expect(bySide.left).toBe('fixed')
        w.destroy()
    })
})

describe('B7 自 Fixed 把手建線 → 烙印', () => {
    test('自 left(fixed)把手拖曳: 新邊帶 fromPosition=left', async () => {
        const w = mountFlow(mkOpt({ conns: [{ id: 'e0', from: '1', to: '2', fromPosition: 'left' }] }))
        await w.vm.$nextTick()
        await dragCreate(w, '1', '3', 'left')
        expect(w.vm.conns).toHaveLength(2)
        const created = w.vm.conns[1]
        expect(created.fromPosition).toBe('left')
        w.destroy()
    })
})

describe('B8 批次改 Auto', () => {
    test('unfix source 側: 清除全部出邊固定錨點並發 update:conns, 入邊之 toPosition 不動', async () => {
        const w = mountFlow(mkOpt({
            conns: [
                { id: 'ea', from: '1', to: '2', fromPosition: 'left' },
                { id: 'eb', from: '1', to: '3', fromPosition: 'right', toPosition: 'left' },
                { id: 'ec', from: '3', to: '2', fromPosition: 'top' }, //他節點之邊不受影響
            ],
        }))
        await w.vm.$nextTick()
        w.vm.onNodeAnchorsUnfix({ node: { id: '1' }, end: 'source' })
        await w.vm.$nextTick()
        expect('fromPosition' in w.vm.conns[0]).toBe(false)
        expect('fromPosition' in w.vm.conns[1]).toBe(false)
        expect(w.vm.conns[1].toPosition).toBe('left') //對側不動
        expect(w.vm.conns[2].fromPosition).toBe('top') //他節點不動
        expect(w.emitted('update:conns')).toBeTruthy()
        w.destroy()
    })
})
