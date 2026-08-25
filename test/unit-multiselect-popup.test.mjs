/**
 * 多選鍵按下時抑制資訊 popup 之驗收(複選模式契約之 popup 開啟入口部分;
 * 模式整體——affordance 隱藏/手勢守衛/效能——見 unit-multiselect-mode)。
 *
 * 需求:按住多選鍵=複選模式, 模式中不得開啟任何 popup(資訊+設定, 含程式化 API 入口),
 * 已開者於進入模式時關閉(關閉行為見 unit-multiselect-mode)。
 *
 * 實作要點(此測試即在鎖住這些前提):
 * - 以 WPopup 之 :value + @input 取代 v-model, 於 handler 攔截開啟請求;
 *   WPopup 非 isolated 時 trigger 只 $emit 請求, 實際開啟權在 v-model 擁有者。
 * - 不可改用 editable 抑制: editable 會連 evHide 與外部點擊關閉一併擋掉, 使已開之 popup 關不掉。
 * - 多選鍵狀態由 WFlowVue 以 getMultiSelectActive getter 注入(inject), 不於子元件讀 event.shiftKey,
 *   否則宿主改 opt.multiSelectionKeyCode 後兩處判準會分岔;
 *   用 getter 而非 prop——此值只影響行為不影響渲染輸出, prop 會使按/放複選鍵時全部 wrapper 白重渲染一輪。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeWrapper from '../src/components/nodes/NodeWrapper.vue'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'

const sampleNodes = [
    { id: '1', type: 'input', name: 'Node 1', description: 'desc 1', position: { x: 50, y: 50 }, width: 100, height: 40 },
    { id: '2', type: 'output', name: 'Node 2', description: 'desc 2', position: { x: 300, y: 300 }, width: 100, height: 40 },
]
const sampleConns = [
    { id: 'e1-2', from: '1', to: '2', name: 'conn 1-2', description: 'conn desc' },
    //無 name 但有 description: hasInfoPopup 之另一條成立路徑
    { id: 'e2-1', from: '2', to: '1', description: 'only desc' },
]

function createWrapper(optOverrides = {}) {
    return mount(WFlowVue, {
        propsData: {
            opt: {
                nodes: JSON.parse(JSON.stringify(sampleNodes)),
                conns: JSON.parse(JSON.stringify(sampleConns)),
                ...optOverrides,
            },
        },
        attachTo: document.body,
    })
}

const nodeWrapperOf = (w, id) => w.findAllComponents(NodeWrapper).wrappers.find(c => c.vm.node.id === id)
const edgeWrapperOf = (w, id) => w.findAllComponents(EdgeWrapper).wrappers.find(c => c.vm.conn.id === id)

//模擬 WPopup 送出之開關請求(非 isolated 時 trigger 只 emit, 由 v-model 擁有者裁決)
const popupRequest = (cmp, val) => cmp.vm.onInfoPopupInput(val)

const pressMultiSelect = async (w, on) => {
    w.vm.keysPressed = on ? { Shift: true } : {}
    await w.vm.$nextTick()
}

describe('節點資訊 popup 之多選抑制', () => {
    test('未按多選鍵: popup 照常開啟', async () => {
        const w = createWrapper()
        const nw = nodeWrapperOf(w, '1')
        popupRequest(nw, true)
        expect(nw.vm.infoPopupShow).toBe(true)
        w.destroy()
    })

    test('按住多選鍵: popup 不得開啟', async () => {
        const w = createWrapper()
        await pressMultiSelect(w, true)
        const nw = nodeWrapperOf(w, '1')
        expect(nw.vm.getMultiSelectActive()).toBe(true)
        popupRequest(nw, true)
        expect(nw.vm.infoPopupShow).toBe(false)
        w.destroy()
    })

    test('popup 已開時按住多選鍵: 仍可關閉(不得用 editable 抑制而關不掉)', async () => {
        const w = createWrapper()
        const nw = nodeWrapperOf(w, '1')
        popupRequest(nw, true)
        expect(nw.vm.infoPopupShow).toBe(true)
        await pressMultiSelect(w, true)
        popupRequest(nw, false)
        expect(nw.vm.infoPopupShow).toBe(false)
        w.destroy()
    })

    test('按住多選鍵時程式化 openInfoPopup() 亦拒開(回傳false; 複選模式所有開啟入口一致封鎖)', async () => {
        const w = createWrapper()
        await pressMultiSelect(w, true)
        const nw = nodeWrapperOf(w, '1')
        expect(nw.vm.openInfoPopup()).toBe(false)
        expect(nw.vm.infoPopupShow).toBe(false)
        //放開後 API 恢復可用
        await pressMultiSelect(w, false)
        expect(nw.vm.openInfoPopup()).toBe(true)
        expect(nw.vm.infoPopupShow).toBe(true)
        w.destroy()
    })

    test('放開多選鍵後恢復可開啟', async () => {
        const w = createWrapper()
        await pressMultiSelect(w, true)
        const nw = nodeWrapperOf(w, '1')
        popupRequest(nw, true)
        expect(nw.vm.infoPopupShow).toBe(false)
        await pressMultiSelect(w, false)
        expect(nw.vm.getMultiSelectActive()).toBe(false)
        popupRequest(nw, true)
        expect(nw.vm.infoPopupShow).toBe(true)
        w.destroy()
    })
})

describe('連線資訊 popup 之多選抑制(兩條開啟路徑都要擋)', () => {
    test('路徑一(WPopup trigger): 按住多選鍵不得開啟', async () => {
        const w = createWrapper()
        await pressMultiSelect(w, true)
        const ew = edgeWrapperOf(w, 'e1-2')
        popupRequest(ew, true)
        expect(ew.vm.infoPopupShow).toBe(false)
        w.destroy()
    })

    test('路徑二(onClick 直接開啟): 按住多選鍵不得開啟, 但 conn-click 仍發出', async () => {
        const w = createWrapper()
        await pressMultiSelect(w, true)
        const ew = edgeWrapperOf(w, 'e1-2')
        ew.vm.onClick({ clientX: 0, clientY: 0 })
        expect(ew.vm.infoPopupShow).toBe(false)
        expect(ew.emitted('conn-click')).toHaveLength(1)
        w.destroy()
    })

    test('路徑二未按多選鍵: 照常開啟', () => {
        const w = createWrapper()
        const ew = edgeWrapperOf(w, 'e1-2')
        ew.vm.onClick({ clientX: 0, clientY: 0 })
        expect(ew.vm.infoPopupShow).toBe(true)
        w.destroy()
    })

    test('無 name 但有 description 之連線同樣受抑制', async () => {
        const w = createWrapper()
        const ew = edgeWrapperOf(w, 'e2-1')
        expect(ew.vm.hasInfoPopup).toBe(true)
        await pressMultiSelect(w, true)
        ew.vm.onClick({ clientX: 0, clientY: 0 })
        expect(ew.vm.infoPopupShow).toBe(false)
        w.destroy()
    })
})

describe('多選鍵判準來自 opt, 不寫死 Shift', () => {
    test('自訂 multiSelectionKeyCode: 只有該鍵生效, Shift 不得誤擋', async () => {
        const w = createWrapper({ multiSelectionKeyCode: 'Control' })
        const nw = nodeWrapperOf(w, '1')

        //按 Shift 不應觸發抑制(判準已改為 Control)
        w.vm.keysPressed = { Shift: true }
        await w.vm.$nextTick()
        expect(nw.vm.getMultiSelectActive()).toBe(false)
        popupRequest(nw, true)
        expect(nw.vm.infoPopupShow).toBe(true)

        //按 Control 才抑制
        popupRequest(nw, false)
        w.vm.keysPressed = { Control: true }
        await w.vm.$nextTick()
        expect(nw.vm.getMultiSelectActive()).toBe(true)
        popupRequest(nw, true)
        expect(nw.vm.infoPopupShow).toBe(false)
        w.destroy()
    })

    test('multiSelectEnabled=false: 按多選鍵不抑制(維持一般點擊行為)', async () => {
        const w = createWrapper({ multiSelectEnabled: false })
        await pressMultiSelect(w, true)
        const nw = nodeWrapperOf(w, '1')
        expect(nw.vm.getMultiSelectActive()).toBe(false)
        popupRequest(nw, true)
        expect(nw.vm.infoPopupShow).toBe(true)
        w.destroy()
    })
})

describe('設定 popup 於複選模式中一併拒開(宿主裁定: 複選中齒輪隱藏, 統一為選取操作)', () => {
    //舊契約「設定popup不受多選抑制」已被宿主裁定推翻: 按住複選鍵=複選操作, 齒輪隱藏且不可開
    test('按住多選鍵: 節點設定 popup 開啟請求被拒', async () => {
        const w = createWrapper()
        await pressMultiSelect(w, true)
        const nw = nodeWrapperOf(w, '1')
        nw.vm.onSettingsPopupInput(true)
        expect(nw.vm.settingsPopupShow).toBe(false)
        w.destroy()
    })

    test('按住多選鍵: 連線設定 popup 開啟請求被拒; 放開後恢復', async () => {
        const w = createWrapper()
        await pressMultiSelect(w, true)
        const ew = edgeWrapperOf(w, 'e1-2')
        ew.vm.onSettingsPopupInput(true)
        expect(ew.vm.settingsPopupShow).toBe(false)
        await pressMultiSelect(w, false)
        ew.vm.onSettingsPopupInput(true)
        expect(ew.vm.settingsPopupShow).toBe(true)
        w.destroy()
    })
})
