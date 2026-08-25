/**
 * 建線手勢之終止契約驗收。
 *
 * 規格(本檔每條斷言皆為其可執行翻譯):
 * S1 建線期間之暫態(根 class .vue-flow--connecting、出發把手 data-connect-role、hover 把手
 *    data-connect-status)手勢以任何方式結束後皆不得殘留。
 *    殘留之後果具體: 根 class 之樣式含齒輪/縮放把手 opacity:0 與 pointer-events:none,
 *    殘留會使該 flow 齒輪與縮放把手隱形且不可點; 把手殘留 status 標記則顯示錯誤的可連性狀態。
 * S2 建線只能自 source handle 出發; 對 target handle 之 mousedown 不啟動建線(方向語義)。
 * S3 非主鍵不啟動建線(Handle 判 event.button); 建線進行中再次收到 connect-start 亦不得重跑
 *    啟動流程(縱深第二層)。
 * S4 落點判定只能以「放開當下」之座標為準。視窗失焦與 buttons 補收尾皆無此座標,
 *    故該二路徑一律取消建線, 不得建立連線。
 * S5 正常於 target handle 上放開仍須建立連線 —— S1..S4 之修正不得波及正常路徑。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'

//建線期間之 DOM 暫態標記數(出發把手 role + hover 把手 status): 手勢結束後必須歸零
const countMarks = () => document.querySelectorAll('[data-connect-role], [data-connect-status]').length

const sampleNodes = [
    { id: '1', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
    { id: '2', name: 'N2', position: { x: 300, y: 0 }, width: 100, height: 40 },
]

function createWrapper(optOverrides = {}) {
    return mount(WFlowVue, {
        propsData: { opt: { nodes: JSON.parse(JSON.stringify(sampleNodes)), conns: [], ...optOverrides } },
        attachTo: document.body,
    })
}

const sourceHandles = (w) => w.findAll('.vue-flow__handle--source')
const targetHandles = (w) => w.findAll('.vue-flow__handle--target')
const targetHandleElOf = (w, nodeId) => targetHandles(w).wrappers
    .map(x => x.element)
    .find(el => el.closest('.vue-flow__node').dataset.id === nodeId)

const docMouseUp = () => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
//buttons=0 之 mousemove: 代表主鍵已於視窗外放開, 回到文件後之第一次移動
const recoveryMouseMove = (x, y) => document.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true, buttons: 0, clientX: x, clientY: y,
}))

beforeEach(() => {
    //jsdom 無版面故未實作 elementFromPoint; 各例自行指定「游標下是什麼」
    document.elementFromPoint = () => null
})

describe('S1 建線暫態(根class與把手標記)為手勢期間之暫態', () => {
    test('正常放開後不殘留', async () => {
        const w = createWrapper()
        expect(countMarks()).toBe(0)
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(w.vm.isConnecting).toBe(true)
        expect(countMarks()).toBe(1) //出發把手之 origin 標記
        await w.vm.$nextTick()
        expect(w.vm.$el.classList.contains('vue-flow--connecting')).toBe(true)

        docMouseUp()
        expect(w.vm.isConnecting).toBe(false)
        expect(countMarks()).toBe(0)
        await w.vm.$nextTick()
        expect(w.vm.$el.classList.contains('vue-flow--connecting')).toBe(false)
        w.destroy()
    })

    test('建線途中銷毀元件後不殘留', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(countMarks()).toBe(1)

        w.destroy()
        expect(countMarks()).toBe(0)
    })

    test('建線途中視窗失焦後不殘留, 且狀態一併收尾', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(countMarks()).toBe(1)

        window.dispatchEvent(new Event('blur'))
        expect(w.vm.isConnecting).toBe(false)
        expect(w.vm.connectingFrom).toBe(null)
        expect(countMarks()).toBe(0)
        w.destroy()
    })

    test('payload 之節點不存在時不留下狀態與標記', () => {
        const w = createWrapper()
        w.vm.onConnectStart({ nodeId: 'no-such-node', handleType: 'source', handlePosition: 'right' })
        expect(w.vm.isConnecting).toBe(false)
        expect(countMarks()).toBe(0)
        w.destroy()
    })

    test('commit 途中拋錯(validator)仍不得殘留狀態與標記', () => {
        const w = createWrapper({ funValidConnCreating: () => { throw new Error('host validator boom') } })
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        document.elementFromPoint = () => targetHandleElOf(w, '2')
        //endConnect 之清理位於 finally: 拋錯不得黏死建線狀態(原版循序清理會被中斷)。
        //直呼 endConnect 驗證: DOM dispatchEvent 依規格不把 listener 例外拋回呼叫端, 無從斷言
        expect(() => {
            w.vm.endConnect(new MouseEvent('mouseup', { clientX: 320, clientY: 20 }))
        }).toThrow()
        expect(w.vm.isConnecting).toBe(false)
        expect(countMarks()).toBe(0)
        expect(w.vm.conns.length).toBe(0)
        w.destroy()
    })
})

describe('S2 建線只能自 source handle 出發', () => {
    test('對 target handle 之 mousedown 不啟動建線', () => {
        const w = createWrapper()
        targetHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(w.vm.isConnecting).toBe(false)
        expect(countMarks()).toBe(0)
        w.destroy()
    })
})

describe('S3 非主鍵不啟動; 進行中不得重入', () => {
    test('右鍵 mousedown 不啟動建線(Handle 之 button 守衛)', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 2 })
        expect(w.vm.isConnecting).toBe(false)
        expect(countMarks()).toBe(0)
        w.destroy()
    })

    test('進行中他途再送 connect-start 不重跑啟動流程, 起點不被改寫', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        const first = w.vm.connectingFrom.nodeId
        expect(countMarks()).toBe(1)

        //縱深第二層: 即使事件由他途送達(繞過 Handle 之 button 守衛), 重入守衛仍須擋下
        w.vm.onConnectStart({ nodeId: '2', handleType: 'source', handlePosition: 'bottom' })
        expect(w.vm.connectingFrom.nodeId).toBe(first)
        expect(countMarks()).toBe(1)

        docMouseUp()
        expect(countMarks()).toBe(0)
        w.destroy()
    })
})

describe('S4 無有效放開座標之路徑一律取消, 不建立連線', () => {
    test('buttons 補收尾之 mousemove 不得被當作 drop 落點', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })

        //模擬「回到視窗後第一次移動時, 游標恰位於節點2之 target handle 上」
        const tgtEl = targetHandleElOf(w, '2')
        expect(tgtEl).toBeTruthy()
        document.elementFromPoint = () => tgtEl

        recoveryMouseMove(320, 20)

        expect(w.vm.isConnecting).toBe(false)
        expect(w.vm.conns.length).toBe(0)
        expect(w.emitted('connect')).toBeFalsy()
        expect(w.emitted('update:conns')).toBeFalsy()
        expect(countMarks()).toBe(0)
        w.destroy()
    })

    test('取消路徑仍發 connect-end 供宿主收尾自身 UI, 且酬載標明 cancelled', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        window.dispatchEvent(new Event('blur'))
        expect(w.emitted('connect-end')).toHaveLength(1)
        expect(w.emitted('connect-end')[0][1]).toEqual({ valid: false, reason: 'cancelled', connection: null })
        w.destroy()
    })

    test('視窗失焦不得建立連線, 即使游標下就是 target handle', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        document.elementFromPoint = () => targetHandleElOf(w, '2')

        window.dispatchEvent(new Event('blur'))
        expect(w.vm.conns.length).toBe(0)
        expect(w.emitted('connect')).toBeFalsy()
        w.destroy()
    })
})

describe('S5 正常路徑不得被上述修正波及', () => {
    test('於 target handle 上放開仍建立連線並發出事件', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(w.vm.isConnecting).toBe(true)

        document.elementFromPoint = () => targetHandleElOf(w, '2')
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 320, clientY: 20 }))

        expect(w.vm.conns.length).toBe(1)
        expect(w.vm.conns[0].from).toBe('1')
        expect(w.vm.conns[0].to).toBe('2')
        expect(w.emitted('connect')).toHaveLength(1)
        expect(w.emitted('update:conns')).toHaveLength(1)
        expect(w.emitted('connect-end')).toHaveLength(1)
        //connect-end 酬載(additive 第二參數): 宿主可據以說明結果
        expect(w.emitted('connect-end')[0][1].valid).toBe(true)
        expect(w.emitted('connect-end')[0][1].connection).toEqual({ from: '1', to: '2' })
        expect(countMarks()).toBe(0)
        w.destroy()
    })

    test('未落在 handle 上放開: 不建立連線但仍正常收尾', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        document.elementFromPoint = () => null
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 500, clientY: 500 }))

        expect(w.vm.conns.length).toBe(0)
        expect(w.vm.isConnecting).toBe(false)
        expect(w.emitted('connect-end')).toHaveLength(1)
        expect(w.emitted('connect-end')[0][1].valid).toBe(false)
        expect(countMarks()).toBe(0)
        w.destroy()
    })

    test('locked 時不啟動建線(連接點不渲染, 且程式層另有守衛)', () => {
        const w = createWrapper({ locked: true })
        //第一層: 上鎖時連接點不渲染, 使用者無從按下
        expect(sourceHandles(w).length).toBe(0)
        //第二層: 即使事件由他途送達, onConnectStart 仍須早退且不留下狀態與標記
        w.vm.onConnectStart({ nodeId: '1', handleType: 'source', handlePosition: 'right' })
        expect(w.vm.isConnecting).toBe(false)
        expect(countMarks()).toBe(0)
        w.destroy()
    })
})
