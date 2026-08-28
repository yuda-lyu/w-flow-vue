/**
 * 手勢生命週期與 popup 協調之驗收(spec/流程_互動契約.md §5-§6)。
 *
 * 規格:
 * G1 六種手勢(pan/drag/resize/connect/waypoint/boxselect)啟動時 activeGesture 為該值、根 class vue-flow--gesturing、
 *    擁有者元素(drag/resize/connect 之節點, waypoint 之邊)帶 data-gesture-owner; 結束後三者皆清除。
 * G2 任一手勢啟動即關閉全部已開 popup(含把手/四角之 .stop 路徑——修正前實測 A 之 popup 於自 B 拉線/縮放 B 期間整段不關)。
 * G3 手勢進行中所有 popup 開啟入口拒開: wrapper 之 UI 請求、wrapper.openInfoPopup、公開 API openNodeInfoPopup / openConnInfoPopup。
 * G4 一次一手勢: 手勢進行中把手 mousedown 不啟動建線、節點 mousedown 不選取不武裝拖曳、畫布 mousedown 不平移。
 * G5 上鎖切換: connect / boxselect 取消; drag 取消提交(座標不寫回、不發 update:nodes); resize-end 於上鎖時不提交;
 *    waypoint 之 points 更新於上鎖時忽略。
 * G6 主鍵限制: 四角與轉折點之右鍵 mousedown 不啟動手勢。
 * G7 waypoint 收尾: 視窗失焦與元件銷毀皆移除 document 監聽與全域游標樣式, activeGesture 歸零。
 * G8 pan 於上鎖時取消(契約 §5 上鎖列: pan 取消); 刪除拖曳中之節點走 cancelDrag 單一路徑, activeGesture 歸零(否則之後所有手勢/popup 被閘門擋死)。
 * G9 邊 label 位移追蹤: 僅主鍵; mouseup / blur / destroy 皆卸除 document 監聽(重入先收上一輪)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'

const mkOpt = () => ({
    nodes: [
        { id: '1', name: 'N1', description: 'd1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', name: 'N2', description: 'd2', position: { x: 300, y: 0 }, width: 100, height: 40 },
        { id: '3', name: 'N3', position: { x: 0, y: 200 }, width: 100, height: 40 },
    ],
    conns: [{ id: 'e1', from: '1', to: '2', name: 'L', description: 'dl', points: [[150, 100]] }],
})
const mountFlow = () => mount(WFlowVue, { propsData: { opt: mkOpt() }, attachTo: document.body })
const nw = (w, id) => w.vm.$refs.nodeRenderer.$refs.wrappers.find(c => c.node.id === id)
const ew = (w, id) => w.vm.$refs.edgeRenderer.$refs.wrappers.find(c => c.conn.id === id)
const nodeEl = (w, id) => w.find(`.vue-flow__node[data-id="${id}"]`)
//四把手對稱, 統一以 position 選取(position 值即 top/right/bottom/left)
const handleEl = (w, id, position) => w.find(`.vue-flow__node[data-id="${id}"] .vue-flow__handle--${position}`)
const docUp = () => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
const docMove = (x, y) => document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: x, clientY: y }))
const evt = (extra = {}) => ({ button: 0, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {}, ...extra })
const cursorStyles = () => [...document.head.querySelectorAll('style')].filter(s => /cursor/.test(s.textContent))
const openPopups = (w) => w.vm.$refs.nodeRenderer.$refs.wrappers.filter(c => c.infoPopupShow || c.settingsPopupShow).length
    + w.vm.$refs.edgeRenderer.$refs.wrappers.filter(c => c.infoPopupShow || c.settingsPopupShow).length

//六種手勢之啟動/結束 driver(結束一律走真實收尾路徑)
const gestures = {
    pan: {
        start: async (w) => { await w.find('.vue-flow').trigger('mousedown', { button: 0 }) },
        owner: () => null,
        end: () => docUp(),
    },
    drag: {
        start: async (w) => {
            nodeEl(w, '1').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
            docMove(30, 30)
        },
        owner: (w) => nodeEl(w, '1').element,
        end: () => docUp(),
    },
    resize: {
        start: async (w) => { nw(w, '1').onResizeStart(evt(), 'bottom-right') },
        owner: (w) => nodeEl(w, '1').element,
        end: () => docUp(),
    },
    connect: {
        start: async (w) => { handleEl(w, '1', 'bottom').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })) },
        owner: (w) => nodeEl(w, '1').element,
        end: () => docUp(),
    },
    waypoint: {
        start: async (w) => { ew(w, 'e1').onWaypointMouseDown(0, evt()) },
        owner: (w) => w.find('.vue-flow__edge[data-id="e1"]').element,
        end: () => docUp(),
    },
    boxselect: {
        start: async (w) => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }))
            await w.find('.vue-flow').trigger('mousedown', { button: 0 })
        },
        owner: () => null,
        end: () => { docUp(); document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true })) },
    },
}

afterEach(() => {
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
})

describe('G1 手勢狀態與標記', () => {
    test.each(Object.keys(gestures))('%s', async (name) => {
        const g = gestures[name]
        const w = mountFlow()
        await w.vm.$nextTick()
        await g.start(w)
        expect(w.vm.activeGesture).toBe(name)
        await w.vm.$nextTick()
        expect(w.vm.$el.classList.contains('vue-flow--gesturing')).toBe(true)
        const owner = g.owner(w)
        if (owner) expect(owner.hasAttribute('data-gesture-owner')).toBe(true)
        g.end(w)
        expect(w.vm.activeGesture).toBe(null)
        await w.vm.$nextTick()
        expect(w.vm.$el.classList.contains('vue-flow--gesturing')).toBe(false)
        expect(document.querySelectorAll('[data-gesture-owner]').length).toBe(0)
        w.destroy()
    })
})

describe('G2 手勢啟動關閉全部 popup', () => {
    test.each(Object.keys(gestures))('%s: 節點2 資訊 popup 與連線 e1 設定 popup 已開 → 關閉', async (name) => {
        const g = gestures[name]
        const w = mountFlow()
        await w.vm.$nextTick()
        nw(w, '2').infoPopupShow = true
        ew(w, 'e1').settingsPopupShow = true
        await w.vm.$nextTick()
        expect(openPopups(w)).toBe(2)
        await g.start(w)
        expect(openPopups(w)).toBe(0)
        g.end(w)
        w.destroy()
    })
})

describe('G3 手勢進行中拒開 popup', () => {
    test('UI 請求 / wrapper API / 公開 API 皆拒; 結束後恢復', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await gestures.connect.start(w)
        nw(w, '2').onInfoPopupInput(true)
        nw(w, '2').onSettingsPopupInput(true)
        ew(w, 'e1').onInfoPopupInput(true)
        expect(nw(w, '2').openInfoPopup()).toBe(false)
        expect(w.vm.openNodeInfoPopup('2')).toBe(false) //公開 API 回傳 wrapper 之裁決(手勢中拒開)
        expect(w.vm.openConnInfoPopup('e1')).toBe(false)
        expect(openPopups(w)).toBe(0)
        gestures.connect.end(w)
        expect(nw(w, '2').openInfoPopup()).toBe(true)
        expect(openPopups(w)).toBe(1)
        w.destroy()
    })
})

describe('G4 一次一手勢', () => {
    test('resize 進行中: 把手不建線、節點不選取不拖、畫布不平移', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        w.vm.clearSelection()
        await gestures.resize.start(w)
        handleEl(w, '2', 'bottom').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        expect(w.vm.isConnecting).toBe(false)
        nodeEl(w, '2').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        docMove(50, 50)
        expect(w.vm.selectedNodes).toEqual(['1']) //仍為 resize 之 activate 結果
        expect(w.vm.isDraggingNode).toBe(false)
        await w.find('.vue-flow').trigger('mousedown', { button: 0 })
        expect(w.vm.isPanning).toBe(false)
        expect(w.vm.activeGesture).toBe('resize')
        docUp()
        expect(w.vm.activeGesture).toBe(null)
        w.destroy()
    })
})

describe('G5 上鎖切換之手勢政策', () => {
    test('connect / boxselect 取消', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await gestures.connect.start(w)
        w.vm.toggleInteractive()
        expect(w.vm.isConnecting).toBe(false)
        expect(w.vm.activeGesture).toBe(null)
        expect(w.emitted('connect-end')[0][1].reason).toBe('cancelled')
        w.vm.toggleInteractive()
        await gestures.boxselect.start(w)
        expect(w.vm.isSelecting).toBe(true)
        w.vm.toggleInteractive()
        expect(w.vm.isSelecting).toBe(false)
        expect(w.vm.activeGesture).toBe(null)
        w.destroy()
    })
    test('drag 取消提交: 座標不寫回、不發 update:nodes', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await gestures.drag.start(w)
        expect(w.vm.isDraggingNode).toBe(true)
        w.vm.toggleInteractive()
        expect(w.vm.isDraggingNode).toBe(false)
        expect(w.vm.activeGesture).toBe(null)
        expect(w.vm.nodes[0].position).toEqual({ x: 0, y: 0 })
        expect(w.emitted('update:nodes')).toBeFalsy()
        docUp()
        expect(w.vm.nodes[0].position).toEqual({ x: 0, y: 0 })
        expect(w.emitted('update:nodes')).toBeFalsy()
        w.destroy()
    })
    test('resize-end 於上鎖時不提交; waypoint points 於上鎖時忽略', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await gestures.resize.start(w)
        w.vm.toggleInteractive()
        docUp() //NodeWrapper 仍持有監聽 → 發 node-resize-end
        expect(w.vm.nodes[0].width).toBe(100)
        expect(w.emitted('update:nodes')).toBeFalsy()
        expect(w.vm.activeGesture).toBe(null)
        w.vm.toggleInteractive()
        await gestures.waypoint.start(w)
        w.vm.toggleInteractive()
        docUp()
        expect(w.vm.conns[0].points).toEqual([[150, 100]])
        expect(w.emitted('conn-settings-update')).toBeFalsy()
        expect(w.vm.activeGesture).toBe(null)
        w.destroy()
    })
})

describe('G8 上鎖取消 pan; 刪除拖曳中節點歸零手勢', () => {
    test('pan 進行中上鎖: isPanning false、activeGesture null、不發 viewport-change', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await gestures.pan.start(w)
        expect(w.vm.isPanning).toBe(true)
        expect(w.vm.activeGesture).toBe('pan')
        //初始 fit 已發過一次 viewport-change; 取消 pan 不得再發
        const vcBefore = (w.emitted('viewport-change') || []).length
        w.vm.toggleInteractive()
        expect(w.vm.isPanning).toBe(false)
        expect(w.vm.activeGesture).toBe(null)
        expect((w.emitted('viewport-change') || []).length).toBe(vcBefore)
        docUp()
        expect(w.vm.activeGesture).toBe(null)
        w.destroy()
    })
    test('拖曳中刪除該節點: 手勢歸零, 之後可再啟動手勢與開 popup', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await gestures.drag.start(w)
        expect(w.vm.activeGesture).toBe('drag')
        await w.vm.deleteNodes(['1'])
        await w.vm.$nextTick()
        expect(w.vm.isDraggingNode).toBe(false)
        expect(w.vm.activeGesture).toBe(null)
        expect(w.vm.gesturing).toBe(false)
        expect(w.vm.canOpenPopup()).toBe(true)
        docUp()
        await gestures.pan.start(w)
        expect(w.vm.activeGesture).toBe('pan')
        docUp()
        w.destroy()
    })
})

describe('G9 邊 label 位移追蹤收尾', () => {
    const labelEl = (w) => w.find('.vue-flow__edge[data-id="e1"] .vue-flow__edge-label')
    test('右鍵不掛監聽; 主鍵 mouseup 卸除; blur 卸除; 重入先收上一輪', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        const e = ew(w, 'e1')
        await labelEl(w).trigger('mousedown', { button: 2 })
        expect(e._labelGesture).toBeFalsy()
        await labelEl(w).trigger('mousedown', { button: 0 })
        expect(e._labelGesture).toBeTruthy()
        const first = e._labelGesture
        await labelEl(w).trigger('mousedown', { button: 0 })
        expect(e._labelGesture).not.toBe(first)
        docUp()
        expect(e._labelGesture).toBeFalsy()
        await labelEl(w).trigger('mousedown', { button: 0 })
        window.dispatchEvent(new Event('blur'))
        expect(e._labelGesture).toBeFalsy()
        w.destroy()
    })
    test('進行中銷毀: 監聽卸除(domGesture tracker dispose), 之後 mouseup 不再觸碰', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        const e = ew(w, 'e1')
        await labelEl(w).trigger('mousedown', { button: 0 })
        const g = e._labelGesture
        expect(g.isActive()).toBe(true)
        const spy = jest.spyOn(document, 'removeEventListener')
        w.destroy()
        expect(e._labelGesture).toBeFalsy()
        expect(g.isActive()).toBe(false)
        expect(spy.mock.calls.some(c => c[0] === 'mousemove')).toBe(true)
        expect(spy.mock.calls.some(c => c[0] === 'mouseup')).toBe(true)
        spy.mockRestore()
    })
})

//G10 六手勢 × 五終止原因矩陣(契約 §5 終止列): mouseup / blur / buttons-lost / destroy / lock 皆同一收尾——
//activeGesture 與根 class 歸零, 無全域游標樣式殘留, 子元件手勢 tracker 皆已 dispose。
//刻意允許: destroy 後 activeGesture 不再檢查(元件已銷毀, 狀態無宿主可讀), 只驗游標樣式與 tracker。
describe('G10 手勢 × 終止原因矩陣', () => {
    const trackers = (w) => {
        const r = []
        for (const n of w.vm.$refs.nodeRenderer.$refs.wrappers) r.push(n._mouseGesture, n._resizeGesture)
        for (const e of w.vm.$refs.edgeRenderer.$refs.wrappers) r.push(e._waypointGesture, e._labelGesture)
        return r.filter(Boolean)
    }
    const terminate = {
        mouseup: (w) => docUp(),
        blur: (w) => { window.dispatchEvent(new Event('blur')); w.vm.onWindowBlur() },
        'buttons-lost': (w) => document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 0, clientX: 40, clientY: 40 })),
        lock: (w) => w.vm.toggleInteractive(),
    }
    for (const gname of Object.keys(gestures)) {
        for (const reason of Object.keys(terminate)) {
            test(`${gname} × ${reason}`, async () => {
                const w = mountFlow()
                await w.vm.$nextTick()
                await gestures[gname].start(w)
                expect(w.vm.activeGesture).toBe(gname === 'boxselect' ? 'boxselect' : gname)
                terminate[reason](w)
                await w.vm.$nextTick()
                expect(w.vm.activeGesture).toBe(null)
                expect(w.vm.gesturing).toBe(false)
                expect(w.classes()).not.toContain('vue-flow--gesturing')
                expect(cursorStyles().length).toBe(0)
                expect(trackers(w).filter(t => t.isActive()).length).toBe(0)
                //終止後可再啟動手勢(閘門已放開); 框選之 Shift 先放開, 否則再按下仍是框選
                docUp()
                document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
                if (reason === 'lock') w.vm.toggleInteractive()
                await gestures.pan.start(w)
                expect(w.vm.activeGesture).toBe('pan')
                docUp()
                w.destroy()
            })
        }
        test(`${gname} × destroy`, async () => {
            const w = mountFlow()
            await w.vm.$nextTick()
            await gestures[gname].start(w)
            const ts = trackers(w)
            w.destroy()
            expect(cursorStyles().length).toBe(0)
            expect(ts.filter(t => t.isActive()).length).toBe(0)
        })
    }
})

describe('G6 主鍵限制', () => {
    test('四角與轉折點之右鍵不啟動手勢', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await nodeEl(w, '1').trigger('mouseenter')
        await w.find('.vue-flow__node[data-id="1"] .vue-flow__resize').trigger('mousedown', { button: 2 })
        expect(w.vm.activeGesture).toBe(null)
        ew(w, 'e1').onWaypointMouseDown(0, evt({ button: 2 }))
        expect(w.vm.activeGesture).toBe(null)
        expect(cursorStyles()).toHaveLength(0)
        w.destroy()
    })
})

describe('G7 waypoint 收尾', () => {
    test('視窗失焦: 樣式移除、以最後 ghost 提交、手勢歸零', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await gestures.waypoint.start(w)
        expect(cursorStyles()).toHaveLength(1)
        window.dispatchEvent(new Event('blur'))
        expect(cursorStyles()).toHaveLength(0)
        expect(w.vm.activeGesture).toBe(null)
        expect(w.emitted('conn-settings-update')).toHaveLength(1)
        w.destroy()
    })
    test('進行中銷毀: 樣式移除、不提交', async () => {
        const w = mountFlow()
        await w.vm.$nextTick()
        await gestures.waypoint.start(w)
        expect(cursorStyles()).toHaveLength(1)
        w.destroy()
        expect(cursorStyles()).toHaveLength(0)
        docUp()
        expect(w.emitted('conn-settings-update')).toBeFalsy()
    })
})
