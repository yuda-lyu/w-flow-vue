/**
 * 方位由連線持有之元件層行為驗收(anchorPolicy 契約之可執行翻譯; spec/流程_互動契約.md §4)。
 *
 * 規格:
 * B1 拖曳建線 → conn = { id, from, to, fromPosition, toPosition, markerTo:'arrowclosed' }; from=出發節點, fromPosition=出發邊, to=落點節點, toPosition=落點邊; to 端自動實心箭頭。
 * B2 改連線 From Anchor → 該邊出發方位改道; 節點把手不動(四把手恆在)。
 * B3 節點資料即使帶 toPosition/fromPosition/type 亦不被讀取: 邊方位仍由連線決定, 把手仍為四個。
 * B4 defConn 層: 宿主設 defConnFromPosition/defConnToPosition 而連線未設時, 邊兩端取之。
 * B5 每個節點恰四個把手(top/right/bottom/left 各一), 無連出/連入之分。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'

const mkOpt = (extra = {}) => ({
    nodes: [
        { id: '1', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', name: 'N2', position: { x: 300, y: 200 }, width: 100, height: 40 },
        { id: '3', name: 'N3', position: { x: 0, y: 200 }, width: 100, height: 40 },
    ],
    conns: [],
    ...extra,
})

const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })

const handleEls = (nodeId, side) => [...document.querySelectorAll(`.vue-flow__node[data-id="${nodeId}"] .vue-flow__handle${side ? `[data-handle-position="${side}"]` : ''}`)]
const dragCreate = async (w, fromNodeId, fromSide, toNodeId, toSide) => {
    handleEls(fromNodeId, fromSide)[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    document.elementFromPoint = () => handleEls(toNodeId, toSide)[0]
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 320, clientY: 210 }))
    await w.vm.$nextTick()
}

afterEach(() => {
    document.elementFromPoint = () => null
})

describe('B1 建線之 conn 持有兩端方位', () => {
    test('自 1.right 拖至 2.left: conn = { id, from:1, to:2, fromPosition:right, toPosition:left }', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        await dragCreate(w, '1', 'right', '2', 'left')
        expect(w.vm.conns).toHaveLength(1)
        const c = w.vm.conns[0]
        expect(Object.keys(c).sort()).toEqual(['from', 'fromPosition', 'id', 'markerTo', 'to', 'toPosition'])
        //拖曳建線之新邊 to 端自動實心箭頭
        expect(c).toMatchObject({ from: '1', to: '2', fromPosition: 'right', toPosition: 'left', markerTo: 'arrowclosed' })
        expect(w.emitted('connect')[0][0]).toEqual({ from: '1', to: '2', fromPosition: 'right', toPosition: 'left' })
        w.destroy()
    })
    test('反向拖曳(自 2.top 至 1.bottom)即 2→1: 方向 = 出發 → 落點', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        await dragCreate(w, '2', 'top', '1', 'bottom')
        expect(w.vm.conns[0]).toMatchObject({ from: '2', to: '1', fromPosition: 'top', toPosition: 'bottom' })
        w.destroy()
    })
})

describe('B2 From Anchor 跟隨', () => {
    test('建線後改 conn.fromPosition=left: 邊出發方位改道, 節點把手不變', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        await dragCreate(w, '1', 'bottom', '2', 'top')
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        expect(ew.vm.sourcePosition).toBe('bottom')
        const dBefore = ew.vm.pathData.path
        w.vm.onConnSettingsUpdate({ conn: { id: w.vm.conns[0].id }, key: 'fromPosition', value: 'left' })
        await w.vm.$nextTick()
        await w.vm.$nextTick()
        expect(ew.vm.sourcePosition).toBe('left')
        expect(ew.vm.pathData.path).not.toBe(dBefore)
        expect(handleEls('1').map(h => h.dataset.handlePosition).sort()).toEqual(['bottom', 'left', 'right', 'top'])
        w.destroy()
    })
})

describe('B3 節點之方位/型別欄位不被讀取', () => {
    test('node.toPosition/fromPosition/type 存在: 邊方位仍由 conn 決定, 把手仍四個', async () => {
        const w = mountFlow(mkOpt({
            nodes: [
                { id: '1', type: 'input', toPosition: 'left', fromPosition: 'right', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
                { id: '2', type: 'output', toPosition: 'left', fromPosition: 'right', name: 'N2', position: { x: 300, y: 200 }, width: 100, height: 40 },
            ],
            conns: [{ id: 'e1-2', from: '1', to: '2', fromPosition: 'top', toPosition: 'bottom' }],
        }))
        await w.vm.$nextTick()
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        expect(ew.vm.sourcePosition).toBe('top')
        expect(ew.vm.targetPosition).toBe('bottom')
        expect(handleEls('1')).toHaveLength(4)
        expect(handleEls('2')).toHaveLength(4)
        //節點設定更新入口拒絕已移除欄位(allowlist): 不寫回、不影響邊
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        w.vm.onNodeSettingsUpdate({ node: { id: '1' }, key: 'toPosition', value: 'right' })
        await w.vm.$nextTick()
        expect(w.vm.nodes[0].toPosition).toBe('left') //原資料不被覆寫
        expect(ew.vm.sourcePosition).toBe('top')
        warn.mockRestore()
        w.destroy()
    })
})

describe('B4 defConn 層', () => {
    test('defConnFromPosition=right / defConnToPosition=left 且連線未設: 邊兩端取之', async () => {
        const w = mountFlow(mkOpt({
            defConnFromPosition: 'right',
            defConnToPosition: 'left',
            conns: [{ id: 'e1-2', from: '1', to: '2' }],
        }))
        await w.vm.$nextTick()
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        expect(ew.vm.sourcePosition).toBe('right')
        expect(ew.vm.targetPosition).toBe('left')
        w.destroy()
    })
    test('全無: bottom → top', async () => {
        const w = mountFlow(mkOpt({ conns: [{ id: 'e1-2', from: '1', to: '2' }] }))
        await w.vm.$nextTick()
        const ew = w.findAllComponents(EdgeWrapper).at(0)
        expect(ew.vm.sourcePosition).toBe('bottom')
        expect(ew.vm.targetPosition).toBe('top')
        w.destroy()
    })
})

describe('B5 每節點恰四把手', () => {
    test('每節點 top/right/bottom/left 各一, 無 source/target 標記', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        for (const id of ['1', '2', '3']) {
            expect(handleEls(id).map(h => h.dataset.handlePosition).sort()).toEqual(['bottom', 'left', 'right', 'top'])
        }
        expect(document.querySelectorAll('[data-handle-type], .vue-flow__handle--source, .vue-flow__handle--target')).toHaveLength(0)
        w.destroy()
    })
})
