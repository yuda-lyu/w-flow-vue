/**
 * 節點面之原生拖曳/選取防護驗收(jsdom 層; 真瀏覽器機制鏈另由 e2e 驗證)。
 *
 * 規格:
 * T1 節點面主鍵按下(手勢武裝)時 mousedown 之預設行為被阻止 —— 不得形成文字選取
 *    (選取一旦形成且殘留, 之後 mousedown 落在選取上會啟動原生文字層 drag 接管事件流, 節點凍結)。
 * T2 手勢武裝中 dragstart 被阻止(原生 drag 不得接管); 未武裝時 dragstart 不受干涉(宿主自訂拖放保留)。
 * T3 互動元素(input/textarea/button/a[href]/contenteditable)與 .vue-flow__nodrag 區域:
 *    不武裝手勢亦不 preventDefault —— 原生行為(聚焦/點擊/選字)保留, 且其上移動不得拖走節點;
 *    點擊(mouseup)仍照常發 node-click。
 * T4 非主鍵/齒輪路徑不 preventDefault。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeWrapper from '../src/components/nodes/NodeWrapper.vue'

const sampleNodes = [
    { id: '1', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
]

function createWrapper(optOverrides = {}) {
    return mount(WFlowVue, {
        propsData: { opt: { nodes: JSON.parse(JSON.stringify(sampleNodes)), conns: [], ...optOverrides } },
        attachTo: document.body,
    })
}

const nodeWrapperOf = (w, id) => w.findAllComponents(NodeWrapper).wrappers.find(c => c.vm.node.id === id)

const mkEvent = (target, button = 0) => {
    const ev = { target, button, clientX: 10, clientY: 10, prevented: false }
    ev.preventDefault = () => { ev.prevented = true }
    return ev
}

afterEach(() => {
    //收掉可能殘留之 document 手勢監聽
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})

describe('T1 節點面武裝時阻止預設行為', () => {
    test('主鍵按在節點面: preventDefault 被呼叫, 手勢武裝', () => {
        const w = createWrapper()
        const nw = nodeWrapperOf(w, '1')
        const ev = mkEvent(nw.vm.$el)
        nw.vm.onMouseDown(ev)
        expect(ev.prevented).toBe(true)
        expect(nw.vm._mouseGesture).toBeTruthy()
        nw.vm.endMouseGesture()
        w.destroy()
    })
})

describe('T2 dragstart 守衛', () => {
    test('手勢武裝中: dragstart 被阻止', () => {
        const w = createWrapper()
        const nw = nodeWrapperOf(w, '1')
        nw.vm.onMouseDown(mkEvent(nw.vm.$el))
        const ds = mkEvent(nw.vm.$el)
        nw.vm.onNativeDragStart(ds)
        expect(ds.prevented).toBe(true)
        nw.vm.endMouseGesture()
        w.destroy()
    })

    test('未武裝時: dragstart 不受干涉(宿主自訂拖放保留)', () => {
        const w = createWrapper()
        const nw = nodeWrapperOf(w, '1')
        const ds = mkEvent(nw.vm.$el)
        nw.vm.onNativeDragStart(ds)
        expect(ds.prevented).toBe(false)
        w.destroy()
    })
})

describe('T3 互動元素與 nodrag 區域', () => {
    const cases = [
        ['input', () => document.createElement('input')],
        ['textarea', () => document.createElement('textarea')],
        ['button', () => document.createElement('button')],
        ['a[href]', () => { const a = document.createElement('a'); a.setAttribute('href', '#x'); return a }],
        ['contenteditable', () => { const d = document.createElement('div'); d.setAttribute('contenteditable', 'true'); return d }],
        ['.vue-flow__nodrag', () => { const d = document.createElement('div'); d.className = 'vue-flow__nodrag'; return d }],
    ]
    test.each(cases)('%s: 不武裝手勢亦不 preventDefault', (name, mk) => {
        const w = createWrapper()
        const nw = nodeWrapperOf(w, '1')
        const el = mk()
        nw.vm.$el.appendChild(el)
        const ev = mkEvent(el)
        nw.vm.onMouseDown(ev)
        expect(ev.prevented).toBe(false)
        expect(nw.vm._mouseGesture).toBeFalsy()
        w.destroy()
    })

    test('nodrag 區域內按放: node-click 仍照常發出(僅拖曳被排除, 點擊語義保留)', () => {
        const w = createWrapper()
        const nw = nodeWrapperOf(w, '1')
        const el = document.createElement('div')
        el.className = 'vue-flow__nodrag'
        nw.vm.$el.appendChild(el)
        nw.vm.onMouseDown(mkEvent(el))
        nw.vm.onMouseUp({ clientX: 10, clientY: 10 })
        expect(nw.emitted('node-click')).toHaveLength(1)
        w.destroy()
    })
})

describe('T4 非武裝路徑不 preventDefault', () => {
    test('非主鍵(右鍵)按節點面: 不 preventDefault', () => {
        const w = createWrapper()
        const nw = nodeWrapperOf(w, '1')
        const ev = mkEvent(nw.vm.$el, 2)
        nw.vm.onMouseDown(ev)
        expect(ev.prevented).toBe(false)
        w.destroy()
    })

    test('draggable=false 之節點: 不 preventDefault(原生行為保留)', () => {
        const w = createWrapper({ nodesDraggable: false })
        const nw = nodeWrapperOf(w, '1')
        const ev = mkEvent(nw.vm.$el)
        nw.vm.onMouseDown(ev)
        expect(ev.prevented).toBe(false)
        w.destroy()
    })
})
