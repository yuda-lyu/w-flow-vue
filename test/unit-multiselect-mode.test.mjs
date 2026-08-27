/**
 * 複選模式(multi-select mode)統一互動契約之驗收(宿主裁定: 按住複選鍵=複選操作,
 * 全部節點統一隱藏設定齒輪/四角縮放/連出入把手, 隱藏所有popup; 不得依點中部位給不同反應)。
 *
 * 規格:
 * M1 模式引擎: 複選鍵按下→根 class .vue-flow--multiselecting; 放開→移除。
 *    locked / multiSelectEnabled=false / elementsSelectable=false 時該鍵無複選語義, 不進入模式。
 * M2 進入模式時關閉所有已開 popup(節點/連線之資訊與設定popup)。
 * M3 模式中之守衛(縱深, CSS隱藏之外的第二層):
 *    - onNodeActivate/onConnActivate 不做 sole-select(選取不變);
 *    - 把手 mousedown 不啟動建線;
 *    - onResizeStart 不啟動縮放(不emit node-activate, 不插入全域游標樣式);
 *    - onWaypointMouseDown 不啟動轉折點拖曳。
 * M4 混合選取契約(明文鎖定): 已有連線選取時, 複選點節點只 toggle 節點, 不清除連線選取;
 *    先單選a再按鍵複選點b → a保留、b加入(宿主回報之目標場景)。
 * M5 鍵盤作用域: 於 input/textarea/contenteditable 內按鍵不觸發畫布快捷鍵——
 *    複選鍵不引擎模式(否則設定表單打大寫即關閉表單), Delete 不刪選取元素。
 * M6 效能: 複選鍵 repeat 不觸發根重渲染; 模式持續中按放其他鍵(keysPressed物件替換)不觸發根重渲染;
 *    真正按/放各至多一次根更新; popup未開之 wrapper 於模式切換時 0 重渲染。
 * M7 手勢優先序: 建線進行中按下複選鍵, 建線不中斷(isConnecting 續為 true), 根同時帶兩 class
 *    (CSS 之 :not(.vue-flow--connecting) 使把手於此情形讓位不隱藏)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeWrapper from '../src/components/nodes/NodeWrapper.vue'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'

const mkOpt = (extra = {}) => ({
    nodes: [
        { id: '1', name: 'N1', description: 'd1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', name: 'N2', description: 'd2', position: { x: 300, y: 0 }, width: 100, height: 40 },
    ],
    conns: [{ id: 'e1-2', from: '1', to: '2', name: 'c', description: 'cd' }],
    nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover', //本檔驗 popup 閘門, 以 hover 模式(資訊 popup 立即開)語義斷言
    ...extra,
})

const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })
const nodeWrapperOf = (w, id) => w.findAllComponents(NodeWrapper).wrappers.find(c => c.vm.node.id === id)
const edgeWrapperOf = (w, id) => w.findAllComponents(EdgeWrapper).wrappers.find(c => c.vm.conn.id === id)

const keyDown = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const keyUp = (key) => document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
const hasModeClass = (w) => w.vm.$el.classList.contains('vue-flow--multiselecting')

beforeEach(() => {
    document.elementFromPoint = () => null
})

describe('M1 模式引擎與退出', () => {
    test('按下複選鍵→根class出現; 放開→移除', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        expect(hasModeClass(w)).toBe(false)
        keyDown('Shift')
        await w.vm.$nextTick()
        expect(w.vm.isMultiSelectActive).toBe(true)
        expect(hasModeClass(w)).toBe(true)
        keyUp('Shift')
        await w.vm.$nextTick()
        expect(hasModeClass(w)).toBe(false)
        w.destroy()
    })

    test('locked / multiSelectEnabled=false / elementsSelectable=false: 不進入模式', async () => {
        for (const extra of [{ locked: true }, { multiSelectEnabled: false }, { elementsSelectable: false }]) {
            const w = mountFlow(mkOpt(extra))
            await w.vm.$nextTick()
            keyDown('Shift')
            await w.vm.$nextTick()
            expect(w.vm.isMultiSelectActive).toBe(false)
            expect(hasModeClass(w)).toBe(false)
            keyUp('Shift')
            w.destroy()
        }
    })
})

describe('M2 進入模式時關閉已開 popup', () => {
    test('節點資訊popup與連線設定popup皆於模式引擎時關閉', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        const nw = nodeWrapperOf(w, '1')
        const ew = edgeWrapperOf(w, 'e1-2')
        nw.vm.onInfoPopupInput(true)
        ew.vm.onSettingsPopupInput(true)
        expect(nw.vm.infoPopupShow).toBe(true)
        expect(ew.vm.settingsPopupShow).toBe(true)

        keyDown('Shift')
        await w.vm.$nextTick()
        expect(nw.vm.infoPopupShow).toBe(false)
        expect(ew.vm.settingsPopupShow).toBe(false)
        keyUp('Shift')
        w.destroy()
    })

    test('節點設定popup與連線資訊popup皆於模式引擎時關閉', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        const nw = nodeWrapperOf(w, '2')
        const ew = edgeWrapperOf(w, 'e1-2')
        nw.vm.onSettingsPopupInput(true)
        expect(nw.vm.settingsPopupShow).toBe(true)
        keyDown('Shift')
        await w.vm.$nextTick()
        expect(nw.vm.settingsPopupShow).toBe(false)

        keyUp('Shift')
        await w.vm.$nextTick()
        ew.vm.onInfoPopupInput(true)
        expect(ew.vm.infoPopupShow).toBe(true)
        keyDown('Shift')
        await w.vm.$nextTick()
        expect(ew.vm.infoPopupShow).toBe(false)
        keyUp('Shift')
        w.destroy()
    })
})

describe('M3 模式中之縱深守衛', () => {
    test('onNodeActivate/onConnActivate 不做 sole-select', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        w.vm.setSelectedNodes(['1'])
        keyDown('Shift')
        await w.vm.$nextTick()
        w.vm.onNodeActivate({ node: { id: '2' } })
        expect(w.vm.selectedNodes).toEqual(['1'])
        w.vm.onConnActivate({ conn: { id: 'e1-2' } })
        expect(w.vm.selectedNodes).toEqual(['1'])
        expect(w.vm.selectedConns).toEqual([])
        keyUp('Shift')
        w.destroy()
    })

    test('把手 mousedown 不啟動建線', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        keyDown('Shift')
        await w.vm.$nextTick()
        const h = w.find('.vue-flow__node[data-id="1"] .vue-flow__handle[data-handle-position="bottom"]')
        h.trigger('mousedown', { button: 0 })
        expect(w.vm.isConnecting).toBe(false)
        keyUp('Shift')
        w.destroy()
    })

    test('onResizeStart 不啟動縮放(不emit node-activate, 無全域游標樣式)', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        const nw = nodeWrapperOf(w, '1')
        keyDown('Shift')
        await w.vm.$nextTick()
        const stylesBefore = document.head.querySelectorAll('style').length
        nw.vm.onResizeStart({ preventDefault: jest.fn(), clientX: 0, clientY: 0 }, 'top-left')
        expect(nw.emitted('node-activate')).toBeFalsy()
        expect(document.head.querySelectorAll('style').length).toBe(stylesBefore)
        keyUp('Shift')
        w.destroy()
    })

    test('onWaypointMouseDown 不啟動轉折點拖曳', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        const ew = edgeWrapperOf(w, 'e1-2')
        keyDown('Shift')
        await w.vm.$nextTick()
        const pd = jest.fn()
        const stylesBefore = document.head.querySelectorAll('style').length
        ew.vm.onWaypointMouseDown(0, { preventDefault: pd, clientX: 0, clientY: 0 })
        expect(pd).not.toHaveBeenCalled()
        expect(document.head.querySelectorAll('style').length).toBe(stylesBefore)
        keyUp('Shift')
        w.destroy()
    })
})

describe('M4 混合選取契約(明文鎖定現狀)', () => {
    test('先單選a, 複選點b → a保留b加入(宿主目標場景); 既有連線選取不被清除', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        w.vm.setSelectedNodes(['1'])
        w.vm.setSelectedConns(['e1-2'])
        keyDown('Shift')
        await w.vm.$nextTick()
        w.vm.onNodeClick({ node: { id: '2' }, event: {} })
        expect(w.vm.selectedNodes).toEqual(['1', '2'])
        expect(w.vm.selectedConns).toEqual(['e1-2']) //連線不參與複選, 亦不被toggle路徑清除
        //再點一次b → 移除
        w.vm.onNodeClick({ node: { id: '2' }, event: {} })
        expect(w.vm.selectedNodes).toEqual(['1'])
        keyUp('Shift')
        w.destroy()
    })
})

describe('M5 鍵盤作用域: 可編輯目標內按鍵不觸發畫布快捷鍵', () => {
    test('input 內按複選鍵不引擎模式; Delete 不刪選取節點', async () => {
        const w = mountFlow(mkOpt({ deleteKeyEnabled: true }))
        await w.vm.$nextTick()
        const input = document.createElement('input')
        document.body.appendChild(input)

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }))
        await w.vm.$nextTick()
        expect(w.vm.isMultiSelectActive).toBe(false)
        expect(hasModeClass(w)).toBe(false)

        w.vm.setSelectedNodes(['1'])
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
        await w.vm.$nextTick()
        expect(w.vm.nodes.some(n => n.id === '1')).toBe(true) //未被誤刪

        //對照組: 事件自 document 發出時 Delete 照常生效
        keyDown('Delete')
        await w.vm.$nextTick()
        expect(w.vm.nodes.some(n => n.id === '1')).toBe(false)
        keyUp('Delete')
        document.body.removeChild(input)
        w.destroy()
    })

    test('畫布按下複選鍵後焦點移入input再放開: 鍵仍被清除(不殘留模式)', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        keyDown('Shift')
        await w.vm.$nextTick()
        expect(hasModeClass(w)).toBe(true)
        const input = document.createElement('input')
        document.body.appendChild(input)
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
        await w.vm.$nextTick()
        expect(w.vm.isMultiSelectActive).toBe(false)
        expect(hasModeClass(w)).toBe(false)
        document.body.removeChild(input)
        w.destroy()
    })
})

describe('M6 效能: 模式切換之渲染成本受控', () => {
    test('repeat與無關按鍵不觸發根重渲染; 真正切換至多一次; wrapper 0次', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        let rootUpdates = 0
        const counts = { node: 0, edge: 0 }
        w.vm.$on('hook:updated', () => { rootUpdates++ })
        w.findAllComponents(NodeWrapper).wrappers.forEach(c => c.vm.$on('hook:updated', () => { counts.node++ }))
        w.findAllComponents(EdgeWrapper).wrappers.forEach(c => c.vm.$on('hook:updated', () => { counts.edge++ }))

        keyDown('Shift')
        await w.vm.$nextTick()
        const afterPress = rootUpdates
        expect(afterPress).toBeLessThanOrEqual(1)

        //OS key-repeat: keysPressed 之守衛使物件不重建
        for (let i = 0; i < 20; i++) keyDown('Shift')
        await w.vm.$nextTick()
        expect(rootUpdates).toBe(afterPress)

        //模式持續中按/放其他鍵: keysPressed 物件替換, 但 scalar 值不變 → 根不重渲染
        keyDown('a')
        await w.vm.$nextTick()
        keyUp('a')
        await w.vm.$nextTick()
        expect(rootUpdates).toBe(afterPress)

        keyUp('Shift')
        await w.vm.$nextTick()
        expect(rootUpdates).toBeLessThanOrEqual(afterPress + 1)
        //popup未開之wrapper: 全程0次
        expect(counts.node).toBe(0)
        expect(counts.edge).toBe(0)
        w.destroy()
    })
})

describe('M7 手勢優先序: 建線中按複選鍵不中斷建線', () => {
    test('拖線中按下Shift: isConnecting維持, 根同時帶connecting與multiselecting', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        const h = w.find('.vue-flow__node[data-id="1"] .vue-flow__handle[data-handle-position="bottom"]')
        h.trigger('mousedown', { button: 0 })
        expect(w.vm.isConnecting).toBe(true)
        keyDown('Shift')
        await w.vm.$nextTick()
        expect(w.vm.isConnecting).toBe(true)
        expect(w.vm.$el.classList.contains('vue-flow--connecting')).toBe(true)
        expect(hasModeClass(w)).toBe(true)
        //收尾
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 10, clientY: 10 }))
        expect(w.vm.isConnecting).toBe(false)
        keyUp('Shift')
        w.destroy()
    })
})
