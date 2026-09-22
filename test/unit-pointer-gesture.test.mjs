/**
 * pointer 通道(觸控/觸控筆)契約 —— spec/流程_互動契約.md §1 輸入事件、§3 手勢入口、§5 終止列:
 * P1 isFromMouse: 滑鼠來源(含無 pointerType 之 MouseEvent)為真、touch/pen 為假 —— pointer 監聽據此跳過滑鼠,
 *    否則滑鼠同時送 pointer 與 mouse 兩套事件, 同一手勢會被兩條路各跑一次。
 * P2 preventNativeDefault: 只在滑鼠通道阻止原生預設行為(觸控之 down 事件一旦 preventDefault,
 *    該次點按之相容滑鼠事件全被抑制, 而 node-click / canvas-click / popup 外關全靠它們)。
 * P3 armPointerGesture: 接觸當下不啟動, 跨門檻才以「按下當下之事件」啟動(其 button 為 0, 主鍵守衛才過得了);
 *    未跨門檻即放開/取消則不啟動; 他指之移動不算; dispose 後不再啟動。
 * P4 startDocumentGesture 之 pointer 通道: pointermove 驅動 onMove、pointerup 以 'pointerup' 終止(提交語義)、
 *    pointercancel 以 'cancel' 終止(取消語義); 滑鼠來源之 pointer 事件一律不理。
 * P5 WFlowVue document 鏈: onDocPointerMove/Up 與滑鼠同一分派; onDocPointerCancel 走取消而非提交。
 * P6 FlowCanvas: 單指跨門檻才發 canvas-mousedown(tap 不發); 雙指發 canvas-pinch(距離比 + 兩指中點), 放開一指即結束捏合。
 * P7 WFlowVue 捏合: 依距離比縮放、以中點為錨; zoomOnPinch=false 不縮放; 其他手勢進行中不介入; 第二指落下取消平移。
 * P8 觸控全鏈(入口→門檻→手勢→取消): 四角縮放以 pointercancel 收尾時發 node-resize-cancel 且不提交尺寸。
 *
 * 註: jsdom 20.0.3 無 PointerEvent 建構子(亦無 Touch), 故以 MouseEvent 補上 pointerType / pointerId 模擬 ——
 * 監聽比對依據是事件型別字串, 故此模擬對本契約之驗證為等價。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import FlowCanvas from '../src/components/canvas/FlowCanvas.vue'
import { isFromMouse, preventNativeDefault, armPointerGesture, startDocumentGesture } from '../src/js/domGesture.mjs'

//jsdom 無 PointerEvent: 以 MouseEvent 補 pointerType/pointerId
const ptr = (type, o = {}) => {
    const e = new MouseEvent(type, {
        bubbles: true,
        clientX: o.clientX || 0,
        clientY: o.clientY || 0,
        button: o.button === undefined ? 0 : o.button,
        buttons: o.buttons === undefined ? 1 : o.buttons,
    })
    Object.defineProperty(e, 'pointerType', { value: o.pointerType || 'touch' })
    Object.defineProperty(e, 'pointerId', { value: o.pointerId === undefined ? 1 : o.pointerId })
    return e
}
const docPtr = (type, o) => document.dispatchEvent(ptr(type, o))

const mkOpt = () => ({
    nodes: [
        { id: '1', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', name: 'N2', position: { x: 300, y: 0 }, width: 100, height: 40 },
    ],
    conns: [{ id: 'e1', from: '1', to: '2' }],
})
const mountFlow = (extra = {}) => mount(WFlowVue, { propsData: { opt: { ...mkOpt(), ...extra } }, attachTo: document.body })
const nw = (w, id) => w.vm.$refs.nodeRenderer.$refs.wrappers.find(c => c.node.id === id)

describe('P1 isFromMouse: pointer 通道之分流判準', () => {
    test('滑鼠來源為真(含無 pointerType 之 MouseEvent), touch/pen 為假', () => {
        expect(isFromMouse(new MouseEvent('mousedown'))).toBe(true)
        expect(isFromMouse(ptr('pointerdown', { pointerType: 'mouse' }))).toBe(true)
        expect(isFromMouse(ptr('pointerdown', { pointerType: 'touch' }))).toBe(false)
        expect(isFromMouse(ptr('pointerdown', { pointerType: 'pen' }))).toBe(false)
        expect(isFromMouse(null)).toBe(true)
    })
})

describe('P2 preventNativeDefault: 只在滑鼠通道阻止', () => {
    test('滑鼠阻止並回傳 true; 觸控不阻止並回傳 false', () => {
        const mouseEv = new MouseEvent('mousedown')
        const spyMouse = jest.fn()
        mouseEv.preventDefault = spyMouse
        expect(preventNativeDefault(mouseEv)).toBe(true)
        expect(spyMouse).toHaveBeenCalledTimes(1)

        const touchEv = ptr('pointerdown', { pointerType: 'touch' })
        const spyTouch = jest.fn()
        touchEv.preventDefault = spyTouch
        expect(preventNativeDefault(touchEv)).toBe(false)
        expect(spyTouch).not.toHaveBeenCalled()
    })
})

describe('P3 armPointerGesture: 跨門檻才啟動', () => {
    test('未跨門檻不啟動, 跨門檻以按下當下之事件啟動(恰一次)', () => {
        const starts = []
        const down = ptr('pointerdown', { clientX: 10, clientY: 10 })
        const arm = armPointerGesture(down, (d, m) => starts.push({ downX: d.clientX, moveX: m.clientX }))
        docPtr('pointermove', { clientX: 12, clientY: 11 })
        expect(starts).toEqual([])
        docPtr('pointermove', { clientX: 14, clientY: 10 })
        expect(starts).toEqual([{ downX: 10, moveX: 14 }])
        expect(arm.isArmed()).toBe(false)
        //啟動後不再重複
        docPtr('pointermove', { clientX: 40, clientY: 40 })
        expect(starts.length).toBe(1)
    })
    test('啟動時交出之事件 button 為 0(主鍵守衛才過得了)', () => {
        let got = null
        armPointerGesture(ptr('pointerdown', { clientX: 0, clientY: 0 }), (d) => { got = d })
        docPtr('pointermove', { clientX: 9, clientY: 0, button: -1 })
        expect(got.button).toBe(0)
    })
    test('未跨門檻即放開/取消則不啟動', () => {
        for (const endType of ['pointerup', 'pointercancel']) {
            const starts = []
            armPointerGesture(ptr('pointerdown', { clientX: 0, clientY: 0 }), () => starts.push(1))
            docPtr(endType, { clientX: 1, clientY: 1 })
            docPtr('pointermove', { clientX: 50, clientY: 50 })
            expect(starts).toEqual([])
        }
    })
    test('他指之移動不算, 滑鼠來源之 pointermove 亦不算', () => {
        const starts = []
        armPointerGesture(ptr('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }), () => starts.push(1))
        docPtr('pointermove', { clientX: 50, clientY: 50, pointerId: 2 })
        docPtr('pointermove', { clientX: 50, clientY: 50, pointerType: 'mouse' })
        expect(starts).toEqual([])
        docPtr('pointermove', { clientX: 50, clientY: 50, pointerId: 1 })
        expect(starts).toEqual([1])
    })
    test('dispose 後不再啟動, 重複呼叫安全', () => {
        const starts = []
        const arm = armPointerGesture(ptr('pointerdown', { clientX: 0, clientY: 0 }), () => starts.push(1))
        expect(arm.dispose()).toBe(true)
        expect(arm.dispose()).toBe(false)
        docPtr('pointermove', { clientX: 50, clientY: 50 })
        expect(starts).toEqual([])
    })
})

describe('P4 startDocumentGesture 之 pointer 通道', () => {
    test('pointermove 驅動 onMove; pointerup → pointerup; 滑鼠來源不理', () => {
        const moves = []
        const ends = []
        startDocumentGesture({ onMove: (e) => moves.push(e.clientX), onEnd: (r) => ends.push(r) })
        docPtr('pointermove', { clientX: 5 })
        docPtr('pointermove', { clientX: 7, pointerType: 'mouse' })
        expect(moves).toEqual([5])
        docPtr('pointerup', { pointerType: 'mouse' })
        expect(ends).toEqual([])
        docPtr('pointerup', {})
        expect(ends).toEqual(['pointerup'])
    })
    test('pointercancel → cancel(取消語義)', () => {
        const ends = []
        const g = startDocumentGesture({ onEnd: (r) => ends.push(r) })
        docPtr('pointercancel', {})
        expect(ends).toEqual(['cancel'])
        expect(g.isActive()).toBe(false)
    })
    test('終止後卸除 pointer 監聽(後續事件不再觸發)', () => {
        const moves = []
        const ends = []
        startDocumentGesture({ onMove: () => moves.push(1), onEnd: (r) => ends.push(r) })
        docPtr('pointerup', {})
        docPtr('pointermove', { clientX: 9 })
        docPtr('pointercancel', {})
        expect(moves).toEqual([])
        expect(ends).toEqual(['pointerup'])
    })
})

describe('P5 WFlowVue document 鏈之 pointer 分派', () => {
    test('pointermove 驅動平移, pointerup 收尾', () => {
        const w = mountFlow()
        w.vm.startPan({ clientX: 100, clientY: 100 })
        expect(w.vm.isPanning).toBe(true)
        w.vm.onDocPointerMove(ptr('pointermove', { clientX: 130, clientY: 120 }))
        expect(w.vm.viewport.x).toBe(30)
        expect(w.vm.viewport.y).toBe(20)
        //滑鼠來源之 pointer 事件不理(避免與 mouse 路徑重複處理)
        w.vm.onDocPointerMove(ptr('pointermove', { clientX: 200, clientY: 200, pointerType: 'mouse' }))
        expect(w.vm.viewport.x).toBe(30)
        w.vm.onDocPointerUp(ptr('pointerup', {}))
        expect(w.vm.isPanning).toBe(false)
        expect(w.vm.activeGesture).toBeNull()
        w.destroy()
    })
    test('pointercancel 走取消: 平移不再發 viewport-change, 手勢歸零', () => {
        const w = mountFlow()
        w.vm.startPan({ clientX: 0, clientY: 0 })
        w.vm.onDocPointerMove(ptr('pointermove', { clientX: 20, clientY: 0 }))
        w.vm.onDocPointerCancel(ptr('pointercancel', {}))
        expect(w.vm.isPanning).toBe(false)
        expect(w.vm.activeGesture).toBeNull()
        //cancelPan 不發 viewport-change(平移無提交語義; 對照 endPan 之收尾才發)
        expect(w.emitted('viewport-change')).toBeFalsy()
        w.destroy()
    })
})

describe('P6 FlowCanvas: 單指門檻與雙指捏合', () => {
    test('tap 不發 canvas-mousedown; 跨門檻才發', async () => {
        const w = mount(FlowCanvas, { attachTo: document.body })
        w.element.dispatchEvent(ptr('pointerdown', { clientX: 50, clientY: 50 }))
        docPtr('pointerup', { clientX: 50, clientY: 50 })
        expect(w.emitted('canvas-mousedown')).toBeFalsy()

        w.element.dispatchEvent(ptr('pointerdown', { clientX: 50, clientY: 50 }))
        docPtr('pointermove', { clientX: 56, clientY: 50 })
        expect(w.emitted('canvas-mousedown').length).toBe(1)
        //交出的是按下當下之事件
        expect(w.emitted('canvas-mousedown')[0][0].clientX).toBe(50)
        w.destroy()
    })
    test('滑鼠之 pointerdown 不經此路(由既有 mouse 路徑處理)', () => {
        const w = mount(FlowCanvas, { attachTo: document.body })
        w.element.dispatchEvent(ptr('pointerdown', { clientX: 0, clientY: 0, pointerType: 'mouse' }))
        docPtr('pointermove', { clientX: 50, clientY: 0, pointerType: 'mouse' })
        expect(w.emitted('canvas-mousedown')).toBeFalsy()
        w.destroy()
    })
    test('雙指: 發 canvas-pinch-start, 移動發距離比與中點; 放開一指即結束', () => {
        const w = mount(FlowCanvas, { attachTo: document.body })
        w.element.dispatchEvent(ptr('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }))
        w.element.dispatchEvent(ptr('pointerdown', { clientX: 200, clientY: 100, pointerId: 2 }))
        expect(w.emitted('canvas-pinch-start').length).toBe(1)
        //兩指距離 100 → 150: scale 1.5, 中點 (125,100)
        w.element.dispatchEvent(ptr('pointermove', { clientX: 250, clientY: 100, pointerId: 2 }))
        const p = w.emitted('canvas-pinch')[0][0]
        expect(p.scale).toBeCloseTo(1.5, 5)
        expect(p.clientX).toBe(175)
        expect(p.clientY).toBe(100)
        //放開一指後不再發
        w.element.dispatchEvent(ptr('pointerup', { clientX: 250, clientY: 100, pointerId: 2 }))
        w.element.dispatchEvent(ptr('pointermove', { clientX: 300, clientY: 100, pointerId: 1 }))
        expect(w.emitted('canvas-pinch').length).toBe(1)
        w.destroy()
    })
    test('新手勢之第一指(isPrimary)落下即重置指標表(殘影不會被誤判為雙指)', () => {
        const w = mount(FlowCanvas, { attachTo: document.body })
        //殘影: 前一手勢之指標未送達 pointerup(容器外放開/捕獲元素被移除)
        w.element.dispatchEvent(ptr('pointerdown', { clientX: 10, clientY: 10, pointerId: 7 }))
        //新手勢之第一指
        const first = ptr('pointerdown', { clientX: 100, clientY: 100, pointerId: 8 })
        Object.defineProperty(first, 'isPrimary', { value: true })
        w.element.dispatchEvent(first)
        expect(w.emitted('canvas-pinch-start')).toBeFalsy()
        //單指仍走門檻路徑
        docPtr('pointermove', { clientX: 108, clientY: 100, pointerId: 8 })
        expect(w.emitted('canvas-mousedown').length).toBe(1)
        w.destroy()
    })
    test('第二指落下時收掉單指閘門(不再發 canvas-mousedown)', () => {
        const w = mount(FlowCanvas, { attachTo: document.body })
        w.element.dispatchEvent(ptr('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }))
        w.element.dispatchEvent(ptr('pointerdown', { clientX: 200, clientY: 100, pointerId: 2 }))
        docPtr('pointermove', { clientX: 140, clientY: 100, pointerId: 1 })
        expect(w.emitted('canvas-mousedown')).toBeFalsy()
        w.destroy()
    })
})

describe('P7 WFlowVue 捏合縮放', () => {
    test('依距離比縮放, 以兩指中點為錨', () => {
        const w = mountFlow()
        w.vm.setViewport({ x: 0, y: 0, zoom: 1 })
        w.vm.onCanvasPinch({ scale: 1.5, clientX: 0, clientY: 0 })
        expect(w.vm.viewport.zoom).toBeCloseTo(1.5, 5)
        w.destroy()
    })
    test('zoomOnPinch=false 不縮放', () => {
        const w = mountFlow({ zoomOnPinch: false })
        w.vm.setViewport({ x: 0, y: 0, zoom: 1 })
        w.vm.onCanvasPinch({ scale: 2, clientX: 0, clientY: 0 })
        expect(w.vm.viewport.zoom).toBe(1)
        w.destroy()
    })
    test('其他手勢進行中不介入', () => {
        const w = mountFlow()
        w.vm.setViewport({ x: 0, y: 0, zoom: 1 })
        w.vm.beginGesture('drag', null)
        w.vm.onCanvasPinch({ scale: 2, clientX: 0, clientY: 0 })
        expect(w.vm.viewport.zoom).toBe(1)
        w.vm.endGesture('drag')
        w.destroy()
    })
    test('第二指落下取消進行中之平移', () => {
        const w = mountFlow()
        w.vm.startPan({ clientX: 0, clientY: 0 })
        expect(w.vm.isPanning).toBe(true)
        w.vm.onCanvasPinchStart()
        expect(w.vm.isPanning).toBe(false)
        expect(w.vm.activeGesture).toBeNull()
        w.destroy()
    })
    test('縮放上下界與滾輪同一判準(clampZoom)', () => {
        const w = mountFlow()
        w.vm.setViewport({ x: 0, y: 0, zoom: 1 })
        w.vm.onCanvasPinch({ scale: 100, clientX: 0, clientY: 0 })
        expect(w.vm.viewport.zoom).toBe(w.vm.zoomMax)
        w.vm.onCanvasPinch({ scale: 0.001, clientX: 0, clientY: 0 })
        expect(w.vm.viewport.zoom).toBe(w.vm.zoomMin)
        w.destroy()
    })
})

describe('P8 觸控全鏈: 四角縮放之 pointercancel 收尾', () => {
    test('入口→跨門檻→縮放→pointercancel: 發 node-resize-cancel 且不提交尺寸', async () => {
        const w = mountFlow()
        const wrapper = nw(w, '1')
        //以 pointer 通道啟動四角縮放(NodeBody 之入口 → NodeWrapper.onResizeStart)
        const body = w.findComponent({ name: 'NodeBody' })
        body.vm.onResizePointerDown(ptr('pointerdown', { clientX: 100, clientY: 40 }), 'bottom-right')
        expect(wrapper._resizeGesture).toBeFalsy()
        //跨門檻才啟動
        docPtr('pointermove', { clientX: 110, clientY: 40 })
        await w.vm.$nextTick()
        expect(w.vm.activeGesture).toBe('resize')
        docPtr('pointermove', { clientX: 160, clientY: 90 })
        docPtr('pointercancel', {})
        await w.vm.$nextTick()
        expect(w.emitted('update:nodes')).toBeFalsy()
        expect(w.vm.activeGesture).toBeNull()
        expect(w.vm.nodes[0].width).toBe(100)
        expect(w.vm.nodes[0].height).toBe(40)
        w.destroy()
    })
})
