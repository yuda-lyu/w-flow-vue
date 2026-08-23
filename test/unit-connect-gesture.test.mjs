/**
 * 建線手勢之終止契約驗收。
 *
 * 規格(本檔每條斷言皆為其可執行翻譯):
 * S1 建線期間會於 document.head 插入全域樣式(鎖游標, 並隱藏齒輪與縮放把手);
 *    該樣式為手勢期間之暫態, 手勢以任何方式結束後皆不得殘留。
 *    殘留之後果具體: 該樣式含 opacity:0 與 pointer-events:none, 整頁齒輪與縮放把手會隱形且不可點。
 * S2 建線只能自 source handle 出發; 對 target handle 之 mousedown 不啟動建線(方向語義)。
 * S3 建線進行中再次收到 connect-start 不得重跑啟動流程(Handle 不判 event.button,
 *    故拉線途中對另一 source handle 按右鍵/中鍵會再次觸發)。
 * S4 落點判定只能以「放開當下」之座標為準。視窗失焦與 buttons 補收尾皆無此座標,
 *    故該二路徑一律取消建線, 不得建立連線。
 * S5 正常於 target handle 上放開仍須建立連線 —— S1..S4 之修正不得波及正常路徑。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'

//只數「內容符合建線游標樣式」者, 不數 document.head 全部 style, 避免被 resize/waypoint 等其他來源汙染
const MARK = '.vue-flow__handle { cursor: crosshair !important; }'
const countConnectStyles = () => Array.from(document.head.querySelectorAll('style'))
    .filter(s => (s.textContent || '').includes(MARK)).length
const purge = () => Array.from(document.head.querySelectorAll('style'))
    .filter(s => (s.textContent || '').includes(MARK))
    .forEach(s => s.parentNode && s.parentNode.removeChild(s))

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
    purge()
    //jsdom 無版面故未實作 elementFromPoint; 各例自行指定「游標下是什麼」
    document.elementFromPoint = () => null
})

describe('S1 全域樣式為手勢期間之暫態', () => {
    test('正常放開後不殘留', () => {
        const w = createWrapper()
        expect(countConnectStyles()).toBe(0)
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(w.vm.isConnecting).toBe(true)
        expect(countConnectStyles()).toBe(1)

        docMouseUp()
        expect(w.vm.isConnecting).toBe(false)
        expect(countConnectStyles()).toBe(0)
        w.destroy()
    })

    test('建線途中銷毀元件後不殘留', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(countConnectStyles()).toBe(1)

        w.destroy()
        expect(countConnectStyles()).toBe(0)
    })

    test('建線途中視窗失焦後不殘留, 且狀態一併收尾', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(countConnectStyles()).toBe(1)

        window.dispatchEvent(new Event('blur'))
        expect(w.vm.isConnecting).toBe(false)
        expect(w.vm.connectingFrom).toBe(null)
        expect(countConnectStyles()).toBe(0)
        w.destroy()
    })

    test('payload 之節點不存在時不留下狀態與樣式', () => {
        const w = createWrapper()
        w.vm.onConnectStart({ nodeId: 'no-such-node', handleType: 'source', handlePosition: 'right' })
        expect(w.vm.isConnecting).toBe(false)
        expect(countConnectStyles()).toBe(0)
        w.destroy()
    })
})

describe('S2 建線只能自 source handle 出發', () => {
    test('對 target handle 之 mousedown 不啟動建線', () => {
        const w = createWrapper()
        targetHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(w.vm.isConnecting).toBe(false)
        expect(countConnectStyles()).toBe(0)
        w.destroy()
    })
})

describe('S3 建線進行中不得重入', () => {
    test('對另一 source handle 按右鍵不新增樣式, 結束後歸零', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        expect(countConnectStyles()).toBe(1)

        //Handle.onMouseDown 不判 event.button, 右鍵同樣會 emit connect-start
        sourceHandles(w).at(1).trigger('mousedown', { button: 2 })
        expect(countConnectStyles()).toBe(1)

        docMouseUp()
        expect(countConnectStyles()).toBe(0)
        w.destroy()
    })

    test('重入不得改寫起點: connectingFrom 維持第一次之來源', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        const first = w.vm.connectingFrom.nodeId

        sourceHandles(w).at(1).trigger('mousedown', { button: 2 })
        expect(w.vm.connectingFrom.nodeId).toBe(first)

        docMouseUp()
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
        expect(countConnectStyles()).toBe(0)
        w.destroy()
    })

    test('取消路徑仍發 connect-end 供宿主收尾自身 UI', () => {
        const w = createWrapper()
        sourceHandles(w).at(0).trigger('mousedown', { button: 0 })
        window.dispatchEvent(new Event('blur'))
        expect(w.emitted('connect-end')).toHaveLength(1)
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
        expect(countConnectStyles()).toBe(0)
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
        expect(countConnectStyles()).toBe(0)
        w.destroy()
    })

    test('locked 時不啟動建線(連接點不渲染, 且程式層另有守衛)', () => {
        const w = createWrapper({ locked: true })
        //第一層: 上鎖時連接點不渲染, 使用者無從按下
        expect(sourceHandles(w).length).toBe(0)
        //第二層: 即使事件由他途送達, onConnectStart 仍須早退且不留下狀態與樣式
        w.vm.onConnectStart({ nodeId: '1', handleType: 'source', handlePosition: 'right' })
        expect(w.vm.isConnecting).toBe(false)
        expect(countConnectStyles()).toBe(0)
        w.destroy()
    })
})
