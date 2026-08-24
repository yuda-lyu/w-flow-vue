/**
 * 元素專屬操作(齒輪/縮放把手)之 active 轉移驗收。
 *
 * 規格:
 * A1 點擊節點齒輪(click) → 該節點成為唯一選取(active), 發 selection-change。
 *    掛 @click 而非 @mousedown: mousedown 當下改選取會於 down 與 up 之間觸發重渲染,
 *    元素被 patch 替換後 up 落在新元素上, click(popup 開啟訊號)根本不發生(已於 e2e 重現於連線齒輪);
 *    亦不掛 popup @show——popup 已開再點不會再發 show。
 * A2 縮放把手按下 → 同 A1(縮放無 popup 時序問題, 於 onResizeStart 即完成)。
 * A3 點擊連線齒輪 → 該連線成為唯一選取, 發 selection-change。
 * A4 不沿用拖曳之「已選不塌陷」: A+B 已選時操作 B 之齒輪/把手, 選取塌陷為只有 B
 *    (視覺選取須與實際作用對象一致, 且宿主據 selection-change 同步外部清單)。
 * A5 按住多選鍵時控制項語義優先: 仍單選該元素, 不做 toggle。
 * A6 已是唯一選取時重複操作不重發 selection-change。
 * A7 elementsSelectable=false 時不改選取。
 * A8 齒輪之 mousedown 本身不觸發 active 轉移(避免 down 與 up 間之重渲染打斷 popup 開啟)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeWrapper from '../src/components/nodes/NodeWrapper.vue'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'

const sampleNodes = [
    { id: '1', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
    { id: '2', name: 'N2', position: { x: 300, y: 0 }, width: 100, height: 40 },
]
const sampleConns = [
    { id: 'e1-2', from: '1', to: '2', name: 'c12' },
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

describe('A1 節點齒輪之 active 轉移', () => {
    test('點 B 齒輪: B 成為唯一選取並發 selection-change', () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1'])
        const nwB = nodeWrapperOf(w, '2')
        //齒輪路徑於 onMouseDown 之 settings-anchor 分支發 node-activate(元素層模擬該分支之發射)
        nwB.vm.$emit('node-activate', { node: nwB.vm.node })
        expect(w.vm.selectedNodes).toEqual(['2'])
        expect(w.vm.selectedConns).toEqual([])
        expect(w.emitted('selection-change')).toBeTruthy()
        w.destroy()
    })

    test('齒輪錨區之 click 即發 node-activate(不依賴 popup @show)', () => {
        const w = createWrapper()
        const nw = nodeWrapperOf(w, '2')
        nw.vm.onSettingsAnchorClick({ clientX: 0, clientY: 0 })
        expect(w.vm.selectedNodes).toEqual(['2'])
        w.destroy()
    })
})

describe('A2 縮放把手之 active 轉移', () => {
    test('onResizeStart 使該節點成為唯一選取', () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1'])
        const nwB = nodeWrapperOf(w, '2')
        nwB.vm.onResizeStart({ preventDefault: () => {}, clientX: 0, clientY: 0 }, 'bottom-right')
        expect(w.vm.selectedNodes).toEqual(['2'])
        //收掉 resize 手勢殘留
        nwB.vm.endResizeGesture()
        w.destroy()
    })
})

describe('A3 連線齒輪之 active 轉移', () => {
    test('點擊連線齒輪錨區: 該連線成為唯一選取', () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1'])
        const ew = edgeWrapperOf(w, 'e1-2')
        ew.vm.onSettingsAnchorClick({})
        expect(w.vm.selectedConns).toEqual(['e1-2'])
        expect(w.vm.selectedNodes).toEqual([])
        expect(w.emitted('selection-change')).toBeTruthy()
        w.destroy()
    })
})

describe('A4 不沿用拖曳之「已選不塌陷」', () => {
    test('A+B 已選時操作 B 齒輪: 塌陷為只有 B, 且發 selection-change', () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1', '2'])
        const nwB = nodeWrapperOf(w, '2')
        nwB.vm.$emit('node-activate', { node: nwB.vm.node })
        expect(w.vm.selectedNodes).toEqual(['2'])
        expect(w.emitted('selection-change')).toBeTruthy()
        w.destroy()
    })
})

describe('A5 多選鍵按住時控制項語義優先', () => {
    test('按住多選鍵點 B 齒輪: 仍單選 B, 不 toggle', async () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1'])
        w.vm.keysPressed = { Shift: true }
        await w.vm.$nextTick()
        const nwB = nodeWrapperOf(w, '2')
        nwB.vm.$emit('node-activate', { node: nwB.vm.node })
        expect(w.vm.selectedNodes).toEqual(['2'])
        w.destroy()
    })
})

describe('A6 重複操作不重發事件', () => {
    test('B 已是唯一選取時再點 B 齒輪: 不再發 selection-change', () => {
        const w = createWrapper()
        const nwB = nodeWrapperOf(w, '2')
        nwB.vm.$emit('node-activate', { node: nwB.vm.node })
        const n1 = (w.emitted('selection-change') || []).length
        nwB.vm.$emit('node-activate', { node: nwB.vm.node })
        const n2 = (w.emitted('selection-change') || []).length
        expect(n1).toBe(1)
        expect(n2).toBe(1)
        w.destroy()
    })
})

describe('A7 elementsSelectable=false', () => {
    test('不改選取亦不發事件', () => {
        const w = createWrapper({ elementsSelectable: false })
        const nwB = nodeWrapperOf(w, '2')
        nwB.vm.$emit('node-activate', { node: nwB.vm.node })
        expect(w.vm.selectedNodes).toEqual([])
        expect(w.emitted('selection-change')).toBeFalsy()
        w.destroy()
    })
})

describe('A8 齒輪之 mousedown 不觸發 active 轉移', () => {
    test('mousedown 於齒輪錨區(任一鍵): 不改選取(轉移於 click 才發生)', () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1'])
        const nw = nodeWrapperOf(w, '2')
        const anchor = document.createElement('div')
        anchor.className = 'vue-flow__node-settings-anchor'
        const inner = document.createElement('span')
        anchor.appendChild(inner)
        document.body.appendChild(anchor)
        nw.vm.onMouseDown({ target: inner, button: 0, clientX: 0, clientY: 0 })
        nw.vm.onMouseDown({ target: inner, button: 2, clientX: 0, clientY: 0 })
        expect(w.vm.selectedNodes).toEqual(['1'])
        document.body.removeChild(anchor)
        w.destroy()
    })
})
