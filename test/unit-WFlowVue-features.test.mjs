/**
 * Feature tests: Settings Forms, Node Resize, Box Selection, Pan.
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeSettingsForm from '../src/components/ui/NodeSettingsForm.vue'
import ConnSettingsForm from '../src/components/ui/ConnSettingsForm.vue'
import { resolveMarker, markerId, markerUrl } from '../src/js/edgeMarker.mjs'

const sampleNodes = [
    { id: '1', name: 'Node 1', position: { x: 50, y: 50 }, width: 100, height: 40 },
    { id: '2', name: 'Node 2', position: { x: 300, y: 300 }, width: 100, height: 40 },
    { id: '3', name: 'Node 3', position: { x: 200, y: 150 }, width: 100, height: 40 },
]
const sampleConns = [
    { id: 'e1-3', from: '1', to: '3', name: 'conn 1-3' },
    { id: 'e3-2', from: '3', to: '2', name: 'conn 3-2', markerEnd: 'arrowclosed' },
]
//節點無 type/toPosition/fromPosition(spec 項1-2); 把手樣式(handle*)四項取代舊 handleSource*/handleTarget* 八項
const defNode = {
    shape: 'rectangle', width: 100, height: 40,
    fontSize: 12, fontSizeMin: 1, fontSizeMax: 72,
    fontColor: '#333333', faceColor: '#ffffff', edgeColor: '#bbbbbb', edgeWidth: 1,
    popupDirection: 'right',
    handleFaceColor: '#555555', handleEdgeColor: '#ffffff', handleEdgeWidth: 1, handleSize: 10,
}
//連線新增兩端方位(fromPosition/toPosition)與雙向箭頭(markerStart/markerEnd 各 type/size/color)
const defConn = {
    type: 'bezier', fontSize: 10, fontSizeMin: 1, fontSizeMax: 72,
    fontColor: '#333333', edgeColor: '#b1b1b1', edgeWidth: 1,
    edgeDasharray: '',
    fromPosition: 'bottom', toPosition: 'top',
    markerStart: '', markerStartSize: 10, markerStartColor: '',
    markerEnd: '', markerEndSize: 10, markerEndColor: '',
    animated: false, defOffset: 24,
}

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

// 1. NodeSettingsForm
describe('NodeSettingsForm', () => {
    //節點無 type/fromPosition/toPosition(spec 項8): 表單不再有 Type / From Handle / To Handle 欄位
    const node = { id: '1', name: 'Test', description: 'desc', fontSize: 14, fontColor: '#000', faceColor: '#fff', edgeColor: '#ccc', edgeWidth: 2, shape: 'rectangle', popupDirection: 'right' }
    function mountForm(ov = {}) {
        return mount(NodeSettingsForm, { propsData: { node: { ...node, ...ov }, defNode } })
    }

    test('renders text inputs', () => { const w = mountForm(); expect(w.findAll('input[type="text"]').length).toBe(2); w.destroy() })
    test('emits update on name', async () => { const w = mountForm(); await w.findAll('input[type="text"]').at(0).setValue('X'); expect(w.emitted('update')[0]).toEqual(['name', 'X']); w.destroy() })
    test('emits update on description', async () => { const w = mountForm(); await w.findAll('input[type="text"]').at(1).setValue('D'); expect(w.emitted('update')[0]).toEqual(['description', 'D']); w.destroy() })
    //Type 欄位已刪(節點無型別); 剩兩個 select: Shape(idx0), Popup Direction(idx1)
    test('emits update on shape', async () => { const w = mountForm(); const s = w.findAll('select').at(0); s.element.value = 'diamond'; await s.trigger('input'); expect(w.emitted('update').some(e => e[0] === 'shape')).toBe(true); w.destroy() })
    test('emits update on popupDirection', async () => { const w = mountForm(); const s = w.findAll('select').at(1); s.element.value = 'left'; await s.trigger('input'); expect(w.emitted('update').some(e => e[0] === 'popupDirection')).toBe(true); w.destroy() })
    test('fontSize ignores below min', () => { const w = mountForm(); w.vm.onFontSizeInput('0'); expect(w.emitted('update')).toBeFalsy(); w.destroy() })
    test('fontSize clamps to max', () => { const w = mountForm(); w.vm.onFontSizeInput('100'); expect(w.emitted('update')[0]).toEqual(['fontSize', 72]); w.destroy() })
    test('fontSize accepts valid', () => { const w = mountForm(); w.vm.onFontSizeInput('20'); expect(w.emitted('update')[0]).toEqual(['fontSize', 20]); w.destroy() })
    test('edgeWidth ignores below 1', () => { const w = mountForm(); w.vm.onEdgeWidthInput('0'); expect(w.emitted('update')).toBeFalsy(); w.destroy() })
    test('edgeWidth clamps to 24', () => { const w = mountForm(); w.vm.onEdgeWidthInput('30'); expect(w.emitted('update')[0]).toEqual(['edgeWidth', 24]); w.destroy() })
    //刪除不做內建二次確認(確認與否由宿主之 opt.funConfirmDeleting 決定, 見 unit-delete-confirm)
    test('delete emits immediately (no built-in confirm step)', async () => {
        const w = mountForm()
        expect(w.find('.vue-flow__delete-warn').exists()).toBe(false)
        expect(w.findAll('.vue-flow__delete-btn').length).toBe(1)
        await w.find('.vue-flow__delete-btn').trigger('click')
        expect(w.emitted('delete')).toBeTruthy()
        //按下後不得出現確認列或取消鈕
        expect(w.find('.vue-flow__delete-warn').exists()).toBe(false)
        expect(w.find('.vue-flow__delete-btn--cancel').exists()).toBe(false)
        w.destroy()
    })
    test('textFontSize prop', () => {
        const w = mount(NodeSettingsForm, { propsData: { node, defNode, textFontSize: '16px' } })
        expect(w.find('.vue-flow__settings-form').element.style.fontSize).toBe('16px')
        w.destroy()
    })
    //舊「basic shows from/to handle」「input hides from handle」已無對應(節點無 type, 表單無 From/To Handle 欄位): 已刪除
    test('no Type / From Handle / To Handle fields regardless of any stray legacy field on node data', () => {
        const w = mountForm({ type: 'input', fromPosition: 'left', toPosition: 'right' })
        const t = w.findAll('label').wrappers.map(l => l.text())
        expect(t.some(x => x.includes('Type'))).toBe(false)
        expect(t.some(x => x.includes('From Handle'))).toBe(false)
        expect(t.some(x => x.includes('To Handle'))).toBe(false)
        w.destroy()
    })
})

// 2. ConnSettingsForm
describe('ConnSettingsForm', () => {
    const conn = { id: 'e1', from: '1', to: '2', name: 'C', type: 'bezier', fontSize: 10, fontColor: '#333', edgeColor: '#b1b1b1', edgeWidth: 1, markerEnd: '', animated: false }
    function mountForm(ov = {}) {
        return mount(ConnSettingsForm, { propsData: { conn: { ...conn, ...ov }, defConn } })
    }
    //select 順序(模板固定): Type(0) / From Anchor(1) / To Anchor(2) / From Marker(3) / To Marker(4)

    test('renders text inputs', () => { const w = mountForm(); expect(w.findAll('input[type="text"]').length).toBe(2); w.destroy() })
    test('emits update on name', async () => { const w = mountForm(); await w.findAll('input[type="text"]').at(0).setValue('N'); expect(w.emitted('update')[0]).toEqual(['name', 'N']); w.destroy() })
    test('emits update on type', async () => { const w = mountForm(); const s = w.findAll('select').at(0); s.element.value = 'step'; await s.trigger('input'); expect(w.emitted('update').some(e => e[0] === 'type')).toBe(true); w.destroy() })
    //新增: 兩端方位(From/To Anchor, spec 項8)——四值 select, 單一來源 anchorPolicy.connSourceSide/connTargetSide
    test('emits update on fromPosition (From Anchor)', async () => {
        const w = mountForm()
        const s = w.findAll('select').at(1)
        s.element.value = 'left'
        await s.trigger('input')
        expect(w.emitted('update')[0]).toEqual(['fromPosition', 'left'])
        w.destroy()
    })
    test('emits update on toPosition (To Anchor)', async () => {
        const w = mountForm()
        const s = w.findAll('select').at(2)
        s.element.value = 'right'
        await s.trigger('input')
        expect(w.emitted('update')[0]).toEqual(['toPosition', 'right'])
        w.destroy()
    })
    test('emits update on animated', async () => { const w = mountForm(); await w.find('input[type="checkbox"]').setChecked(true); expect(w.emitted('update').some(e => e[0] === 'animated')).toBe(true); w.destroy() })
    test('emits update on markerEnd', async () => { const w = mountForm(); const s = w.findAll('select').at(4); s.element.value = 'arrowclosed'; await s.trigger('input'); expect(w.emitted('update')[0]).toEqual(['markerEnd', 'arrowclosed']); w.destroy() })
    //None 選項須 emit ''(不再是 undefined, spec 項8)
    test('markerEnd None emits empty string, not undefined', async () => {
        const w = mountForm({ markerEnd: 'arrow' })
        const s = w.findAll('select').at(4)
        s.element.value = ''
        await s.trigger('input')
        expect(w.emitted('update')[0]).toEqual(['markerEnd', ''])
        w.destroy()
    })
    //Marker Size/Color 恆顯示(知道可改)但有條件才可改: Size 有箭頭時, Color 僅實心箭頭時; 其餘 disabled
    test('marker size/color rows always present; size enabled when marker set, color enabled only for arrowclosed', () => {
        const colorDisabled = (w) => w.findAll('.vue-flow__field').wrappers.filter(f => f.classes('vue-flow__field--disabled')).length
        const w1 = mountForm({ markerEnd: '' })
        const sizeInputs = () => w1.findAll('input[type="number"][min="4"]').wrappers
        expect(sizeInputs().length).toBe(2) //From / To
        expect(sizeInputs().every(i => i.element.disabled)).toBe(true)
        expect(colorDisabled(w1)).toBe(2)
        w1.destroy()
        const w2 = mountForm({ markerEnd: 'arrow' })
        const inputs2 = w2.findAll('input[type="number"][min="4"]').wrappers
        expect(inputs2[0].element.disabled).toBe(true) //From(None)
        expect(inputs2[1].element.disabled).toBe(false) //To(arrow)
        expect(colorDisabled(w2)).toBe(2) //線式箭頭無填色 → color 仍 disabled
        w2.destroy()
        const w3 = mountForm({ markerEnd: 'arrowclosed' })
        expect(colorDisabled(w3)).toBe(1) //僅 From 端 disabled
        w3.destroy()
    })
    test('emits update on markerEndSize', async () => {
        const w = mountForm({ markerEnd: 'arrow', markerEndSize: 10 })
        w.vm.onMarkerSizeInput('markerEndSize', '20')
        expect(w.emitted('update')[0]).toEqual(['markerEndSize', 20])
        w.destroy()
    })
    test('fontSize clamps', () => { const w = mountForm(); w.vm.onFontSizeInput('100'); expect(w.emitted('update')[0]).toEqual(['fontSize', 72]); w.destroy() })
    test('edgeWidth clamps', () => { const w = mountForm(); w.vm.onEdgeWidthInput('30'); expect(w.emitted('update')[0]).toEqual(['edgeWidth', 24]); w.destroy() })
    test('delete emits immediately (no built-in confirm step)', async () => {
        const w = mountForm()
        expect(w.findAll('.vue-flow__delete-btn').length).toBe(1)
        await w.find('.vue-flow__delete-btn').trigger('click')
        expect(w.emitted('delete')).toBeTruthy()
        expect(w.find('.vue-flow__delete-warn').exists()).toBe(false)
        w.destroy()
    })
    test('textFontSize prop', () => {
        const w = mount(ConnSettingsForm, { propsData: { conn, defConn, textFontSize: '14px' } })
        expect(w.find('.vue-flow__settings-form').element.style.fontSize).toBe('14px')
        w.destroy()
    })
})

// 3. Node Resize
//縮放ghost已由獨立之 resizeOverlay 改為併入 dragPositions 之 per-key 機制(WFlowVue.onNodeResize),
//斷言意圖不變: 縮放中ghost帶有該次尺寸/座標, 結束或被鎖定時不留ghost
describe('Node Resize', () => {
    test('onNodeResize sets overlay', () => {
        const w = createWrapper(); w.vm.onNodeResize({ nodeId: '1', width: 200, height: 80, x: 50, y: 50 })
        expect(w.vm.dragPositions['1']).toEqual({ x: 50, y: 50, width: 200, height: 80 }); w.destroy()
    })
    test('onNodeResizeEnd updates node', () => {
        const w = createWrapper()
        w.vm.onNodeResize({ nodeId: '1', width: 200, height: 80, x: 60, y: 70 })
        w.vm.onNodeResizeEnd({ nodeId: '1', width: 200, height: 80, x: 60, y: 70 })
        const n = w.vm.nodeById('1')
        expect(n.width).toBe(200); expect(n.height).toBe(80)
        expect(n.position.x).toBe(60); expect(n.position.y).toBe(70)
        expect(w.vm.dragPositions['1']).toBeNull(); w.destroy()
    })
    test('blocked when locked', () => {
        const w = createWrapper(); w.vm.toggleInteractive()
        w.vm.onNodeResize({ nodeId: '1', width: 200, height: 80, x: 50, y: 50 })
        expect(w.vm.dragPositions['1']).toBeFalsy(); w.destroy()
    })
    test('emits nodes-change', () => {
        const w = createWrapper()
        w.vm.onNodeResize({ nodeId: '1', width: 200, height: 80, x: 50, y: 50 })
        w.vm.onNodeResizeEnd({ nodeId: '1', width: 200, height: 80, x: 50, y: 50 })
        expect(w.emitted('update:nodes')).toBeTruthy(); w.destroy()
    })
    test('nodesResizable=false hides handles', async () => {
        const w = createWrapper({ nodesResizable: false }); await w.vm.$nextTick()
        expect(w.findAll('.vue-flow__resize--top-left').length).toBe(0); w.destroy()
    })
})

// 4. Box Selection
describe('Box Selection', () => {
    test('startSelection sets state', () => {
        const w = createWrapper()
        w.vm.$refs.canvas = { getContainerRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }
        w.vm.startSelection({ clientX: 100, clientY: 100 })
        expect(w.vm.isSelecting).toBe(true)
        expect(w.vm.selectionVisual.box).toEqual({ x: 100, y: 100, width: 0, height: 0 }); w.destroy()
    })
    test('doSelection updates box', () => {
        const w = createWrapper()
        w.vm.$refs.canvas = { getContainerRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }
        w.vm.startSelection({ clientX: 100, clientY: 100 })
        w.vm.doSelection({ clientX: 300, clientY: 250 })
        expect(w.vm.selectionVisual.box).toEqual({ x: 100, y: 100, width: 200, height: 150 }); w.destroy()
    })
    test('doSelection reverse drag', () => {
        const w = createWrapper()
        w.vm.$refs.canvas = { getContainerRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }
        w.vm.startSelection({ clientX: 300, clientY: 300 })
        w.vm.doSelection({ clientX: 100, clientY: 100 })
        expect(w.vm.selectionVisual.box).toEqual({ x: 100, y: 100, width: 200, height: 200 }); w.destroy()
    })
    //endSelection 另有 selectionCrossedThreshold 守衛(原地按放之零面積框不提交選取), 故須一併設定
    test('endSelection selects nodes', () => {
        const w = createWrapper()
        w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.selectionVisual.box = { x: 40, y: 40, width: 270, height: 160 }
        w.vm.selectionCrossedThreshold = true
        w.vm.isSelecting = true; w.vm.endSelection()
        expect(w.vm.selectedNodes).toContain('1')
        expect(w.vm.selectedNodes).toContain('3')
        expect(w.vm.isSelecting).toBe(false); w.destroy()
    })
    //規格已變更: 連線不參與框選複選(WFlowVue.vue:1259-1261 之設計註解 —— 連線為節點錨點/轉折點推得之衍生物,
    //不視為可被複選之項目), 故框選一律清空 selectedConns 而非依兩端是否入框自動選取
    test('endSelection 不選取連線(連線不參與框選複選)', () => {
        const w = createWrapper()
        w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.setSelectedConns(['e1-3'])
        w.vm.selectionVisual.box = { x: 40, y: 40, width: 270, height: 160 }
        w.vm.selectionCrossedThreshold = true
        w.vm.isSelecting = true; w.vm.endSelection()
        //兩端皆入框之 e1-3 亦不得被選取, 且既有連線選取一併清空
        expect(w.vm.selectedConns).toEqual([])
        w.destroy()
    })
    test('endSelection 未跨門檻時不提交選取', () => {
        const w = createWrapper()
        w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.setSelectedNodes(['2'])
        w.vm.selectionVisual.box = { x: 40, y: 40, width: 270, height: 160 }
        w.vm.selectionCrossedThreshold = false
        w.vm.isSelecting = true; w.vm.endSelection()
        //零面積框不得取代既有選取
        expect(w.vm.selectedNodes).toEqual(['2'])
        w.destroy()
    })
    test('endSelection clears state', () => {
        const w = createWrapper()
        w.vm.selectionVisual.box = { x: 0, y: 0, width: 0, height: 0 }
        w.vm.isSelecting = true; w.vm.selectionStartPos = { x: 0, y: 0 }
        w.vm.endSelection()
        expect(w.vm.isSelecting).toBe(false)
        expect(w.vm.selectionStartPos).toBeNull()
        expect(w.vm.selectionVisual.box).toBeNull(); w.destroy()
    })
})

// 5. Pan
describe('Pan', () => {
    test('startPan sets state', () => {
        const w = createWrapper(); w.vm.startPan({ clientX: 100, clientY: 200 })
        expect(w.vm.isPanning).toBe(true)
        expect(w.vm.panStartPos).toEqual({ x: 100, y: 200 }); w.destroy()
    })
    test('doPan updates viewport', () => {
        const w = createWrapper(); w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.startPan({ clientX: 100, clientY: 100 })
        w.vm.doPan({ clientX: 150, clientY: 120 })
        expect(w.vm.viewport.x).toBe(50); expect(w.vm.viewport.y).toBe(20); w.destroy()
    })
    test('doPan accumulates', () => {
        const w = createWrapper(); w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.startPan({ clientX: 100, clientY: 100 })
        w.vm.doPan({ clientX: 150, clientY: 100 })
        w.vm.doPan({ clientX: 200, clientY: 130 })
        expect(w.vm.viewport.x).toBe(100); expect(w.vm.viewport.y).toBe(30); w.destroy()
    })
    test('doPan respects panLimits max', () => {
        const w = createWrapper({ panLimits: [[0, 0], [200, 200]] })
        w.vm.viewport = { x: 100, y: 100, zoom: 1 }
        w.vm.startPan({ clientX: 0, clientY: 0 })
        w.vm.doPan({ clientX: 500, clientY: 500 })
        expect(w.vm.viewport.x).toBeLessThanOrEqual(200)
        expect(w.vm.viewport.y).toBeLessThanOrEqual(200); w.destroy()
    })
    test('doPan respects panLimits min', () => {
        const w = createWrapper({ panLimits: [[0, 0], [200, 200]] })
        w.vm.viewport = { x: 100, y: 100, zoom: 1 }
        w.vm.startPan({ clientX: 100, clientY: 100 })
        w.vm.doPan({ clientX: -500, clientY: -500 })
        expect(w.vm.viewport.x).toBeGreaterThanOrEqual(0)
        expect(w.vm.viewport.y).toBeGreaterThanOrEqual(0); w.destroy()
    })
    test('endPan clears state', () => {
        const w = createWrapper(); w.vm.startPan({ clientX: 100, clientY: 100 }); w.vm.endPan()
        expect(w.vm.isPanning).toBe(false); expect(w.vm.panStartPos).toBeNull(); w.destroy()
    })
    test('endPan emits viewport-change', () => {
        const w = createWrapper(); w.vm.startPan({ clientX: 100, clientY: 100 }); w.vm.endPan()
        expect(w.emitted('viewport-change')).toBeTruthy(); w.destroy()
    })
})

// 6. fitView
describe('fitView', () => {
    test('adjusts viewport to fit all nodes', () => {
        const w = createWrapper()
        sampleNodes.forEach(n => w.vm.updateNodeInternals(n.id, { width: n.width, height: n.height }))
        w.vm.viewport = { x: 999, y: 999, zoom: 0.1 }
        w.vm.fitView()
        // fitView recalculates viewport — x,y should change from 999
        expect(w.vm.viewport.x).not.toBe(999)
        expect(w.vm.viewport.y).not.toBe(999)
        // zoom finite and positive (jsdom 0-size rect falls back to opt width/height per axis)
        expect(isFinite(w.vm.viewport.zoom)).toBe(true)
        expect(w.vm.viewport.zoom).toBeGreaterThan(0)
        w.destroy()
    })
    test('emits viewport-change', () => {
        const w = createWrapper()
        w.vm.fitView()
        expect(w.emitted('viewport-change')).toBeTruthy()
        w.destroy()
    })
    test('respects padding parameter', () => {
        const w = createWrapper()
        w.vm.fitView(50)
        const z1 = w.vm.viewport.zoom
        w.vm.fitView(200)
        const z2 = w.vm.viewport.zoom
        // Larger padding → smaller zoom (more margin)
        expect(z2).toBeLessThanOrEqual(z1)
        w.destroy()
    })
    test('does not exceed max zoom', () => {
        const w = createWrapper({ zoomMax: 1.5 })
        w.vm.fitView()
        expect(w.vm.viewport.zoom).toBeLessThanOrEqual(1.5)
        w.destroy()
    })
})

// 8. Multi-select (Shift+Click)
describe('Multi-select', () => {
    test('normal click selects single node', () => {
        const w = createWrapper()
        w.vm.onNodeClick({ node: { id: '1' }, event: { target: { closest: () => null } } })
        expect(w.vm.selectedNodes).toEqual(['1'])
        w.vm.onNodeClick({ node: { id: '3' }, event: { target: { closest: () => null } } })
        expect(w.vm.selectedNodes).toEqual(['3'])
        w.destroy()
    })
    test('shift+click adds node to selection', () => {
        const w = createWrapper()
        w.vm.onNodeClick({ node: { id: '1' }, event: { target: { closest: () => null } } })
        expect(w.vm.selectedNodes).toEqual(['1'])
        // Simulate shift pressed
        w.vm.keysPressed = { Shift: true }
        w.vm.onNodeClick({ node: { id: '3' }, event: { target: { closest: () => null } } })
        expect(w.vm.selectedNodes).toContain('1')
        expect(w.vm.selectedNodes).toContain('3')
        w.destroy()
    })
    test('shift+click removes already selected node', () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1', '3'])
        w.vm.keysPressed = { Shift: true }
        w.vm.onNodeClick({ node: { id: '1' }, event: { target: { closest: () => null } } })
        expect(w.vm.selectedNodes).not.toContain('1')
        expect(w.vm.selectedNodes).toContain('3')
        w.destroy()
    })
    test('normal click on conn selects single conn', () => {
        const w = createWrapper()
        w.vm.onConnClick({ conn: { id: 'e1-3' }, event: { clientX: 100, clientY: 100 } })
        expect(w.vm.selectedConns).toEqual(['e1-3'])
        w.destroy()
    })
    //規格已變更: 連線不參與多選鍵之複選(WFlowVue.vue:1163-1167) —— 按住多選鍵點連線時
    //不加入亦不移除任何選取, 但 conn-click 事件仍照常發出(宿主之檢視功能靠它同步)
    test('多選鍵點連線: 不變更選取, 但仍發出 conn-click', () => {
        const w = createWrapper()
        w.vm.onConnClick({ conn: { id: 'e1-3' }, event: { clientX: 100, clientY: 100 } })
        expect(w.vm.selectedConns).toEqual(['e1-3'])
        w.vm.keysPressed = { Shift: true }
        w.vm.onConnClick({ conn: { id: 'e3-2' }, event: { clientX: 100, clientY: 100 } })
        expect(w.vm.selectedConns).toEqual(['e1-3'])
        expect(w.emitted('conn-click')).toHaveLength(2)
        w.destroy()
    })
    test('multiSelectEnabled=false disables shift+click', () => {
        const w = createWrapper({ multiSelectEnabled: false })
        w.vm.onNodeClick({ node: { id: '1' }, event: { target: { closest: () => null } } })
        w.vm.keysPressed = { Shift: true }
        w.vm.onNodeClick({ node: { id: '3' }, event: { target: { closest: () => null } } })
        // Should replace, not add
        expect(w.vm.selectedNodes).toEqual(['3'])
        w.destroy()
    })
})

// 9. Snap-to-Grid integration
describe('Snap-to-Grid integration', () => {
    test('snapToGrid=false: resize overlay not snapped', () => {
        const w = createWrapper({ snapToGrid: false })
        // Directly call onNodeResize with non-round values
        w.vm.onNodeResize({ nodeId: '1', width: 137, height: 63, x: 51, y: 49 })
        expect(w.vm.dragPositions['1'].width).toBe(137)
        expect(w.vm.dragPositions['1'].height).toBe(63)
        w.destroy()
    })
    test('snapGridSize passed to NodeRenderer', () => {
        const w = createWrapper({ snapToGrid: true, snapGridSize: 25 })
        const nr = w.findComponent({ name: 'NodeRenderer' })
        expect(nr.props('snapGridSize')).toBe(25)
        w.destroy()
    })
    test('snapToGrid=false passes null to NodeRenderer', () => {
        const w = createWrapper({ snapToGrid: false })
        const nr = w.findComponent({ name: 'NodeRenderer' })
        expect(nr.props('snapGridSize')).toBeNull()
        w.destroy()
    })
})

// 10/12. edgeMarker.mjs 單一來源(取代 EdgeMarkerDefs.getMarkerId 與 EdgeWrapper.getMarkerUrl, spec 項10):
// EdgeMarkerDefs(<defs> 產生)與 EdgeWrapper(url(#id) 引用)皆經 resolveMarker/markerId/markerUrl, id 不可能分家。
// conn.markerEnd/markerStart 恆為字串型別('' | 'arrow' | 'arrowclosed'), 不再接受 {type,color} 物件(色彩改由 markerXColor 欄位)。
describe('edgeMarker 解析(EdgeMarkerDefs / EdgeWrapper 單一來源)', () => {
    test('marker ID matches between EdgeMarkerDefs and EdgeWrapper', () => {
        const w = createWrapper()
        // Find EdgeWrapper that has markerEnd='arrowclosed' (conn e3-2)
        const ews = w.findAllComponents({ name: 'EdgeWrapper' })
        const ew = ews.wrappers.find(e => e.props('conn').id === 'e3-2')
        const url = ew.vm.markerEndUrl
        // Extract ID from url(#...)
        const match = url && url.match(/url\(#(.+)\)/)
        expect(match).toBeTruthy()
        const refId = match[1]
        // Check EdgeMarkerDefs has a marker with this ID
        const defs = w.findComponent({ name: 'EdgeMarkerDefs' })
        const markers = defs.vm.markers
        expect(markers.some(m => m.id === refId)).toBe(true)
        //渲染出之 <marker> DOM 亦帶同一 id(defs 去重不遺漏)
        expect(w.vm.$el.querySelector(`marker[id="${refId}"]`)).toBeTruthy()
        w.destroy()
    })
    test('resolveMarker: 相同規格(type/size/fill/stroke/strokeWidth)恆產生相同 id(供 defs 去重)', () => {
        const connA = { markerEnd: 'arrowclosed', edgeColor: '#b1b1b1', edgeWidth: 1 }
        const connB = { markerEnd: 'arrowclosed', edgeColor: '#b1b1b1', edgeWidth: 1 }
        const specA = resolveMarker(connA, {}, 'end')
        const specB = resolveMarker(connB, {}, 'end')
        expect(specA.id).toBe(specB.id)
        expect(markerId(specA)).toBe(specA.id)
    })
    test('arrow(線式): 無填充(fill=none); arrowclosed: fill=線色加深 20%(未給 markerXColor 時)', () => {
        const line = { edgeColor: '#ff0000', edgeWidth: 2 }
        expect(resolveMarker({ ...line, markerEnd: 'arrow' }, {}, 'end').fill).toBe('none')
        expect(resolveMarker({ ...line, markerEnd: 'arrowclosed' }, {}, 'end').fill).toBe('#cc0000') //#ff0000 加深 20%
    })
    test('markerEndColor 覆蓋 arrowclosed 之 fill(線式箭頭無填充故不受影響)', () => {
        const conn = { markerEnd: 'arrowclosed', markerEndColor: '#00ff00', edgeColor: '#ff0000', edgeWidth: 1 }
        expect(resolveMarker(conn, {}, 'end').fill).toBe('#00ff00')
    })
    test('markerX 為 "" 或未給: 回 null(無箭頭)', () => {
        expect(resolveMarker({ markerEnd: '' }, {}, 'end')).toBeNull()
        expect(resolveMarker({}, {}, 'end')).toBeNull()
    })
    test('conn 明確給 "" 之 markerEnd 不落回 defConn(明確無, 非未給)', () => {
        expect(resolveMarker({ markerEnd: '' }, { markerEnd: 'arrow' }, 'end')).toBeNull()
    })
    test('markerUrl(null) 回 null; 有效規格回 url(#id)', () => {
        expect(markerUrl(null)).toBeNull()
        const spec = resolveMarker({ markerEnd: 'arrow', edgeColor: '#b1b1b1', edgeWidth: 1 }, {}, 'end')
        expect(markerUrl(spec)).toBe(`url(#${spec.id})`)
    })
})

// 13. onDocMouseMove dispatching
describe('onDocMouseMove dispatching', () => {
    test('dispatches to doPan when panning', () => {
        const w = createWrapper()
        w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.startPan({ clientX: 100, clientY: 100 })
        w.vm.onDocMouseMove({ clientX: 150, clientY: 120, buttons: 1 })
        expect(w.vm.viewport.x).toBe(50)
        expect(w.vm.viewport.y).toBe(20)
        w.destroy()
    })
    test('dispatches to doSelection when selecting', () => {
        const w = createWrapper()
        w.vm.$refs.canvas = { getContainerRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }
        w.vm.startSelection({ clientX: 100, clientY: 100 })
        w.vm.onDocMouseMove({ clientX: 200, clientY: 200, buttons: 1 })
        expect(w.vm.selectionVisual.box.width).toBe(100)
        expect(w.vm.selectionVisual.box.height).toBe(100)
        w.destroy()
    })
    test('does nothing when idle', () => {
        const w = createWrapper()
        w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.onDocMouseMove({ clientX: 200, clientY: 200, buttons: 1 })
        expect(w.vm.viewport.x).toBe(0)
        w.destroy()
    })
})

// 14. onDocMouseUp dispatching
describe('onDocMouseUp dispatching', () => {
    test('ends pan', () => {
        const w = createWrapper()
        w.vm.startPan({ clientX: 100, clientY: 100 })
        expect(w.vm.isPanning).toBe(true)
        w.vm.onDocMouseUp({})
        expect(w.vm.isPanning).toBe(false)
        w.destroy()
    })
    test('ends selection', () => {
        const w = createWrapper()
        w.vm.$refs.canvas = { getContainerRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }
        w.vm.startSelection({ clientX: 100, clientY: 100 })
        expect(w.vm.isSelecting).toBe(true)
        w.vm.selectionVisual.box = { x: 0, y: 0, width: 10, height: 10 }
        w.vm.onDocMouseUp({})
        expect(w.vm.isSelecting).toBe(false)
        w.destroy()
    })
    test('does nothing when idle', () => {
        const w = createWrapper()
        expect(() => w.vm.onDocMouseUp({})).not.toThrow()
        w.destroy()
    })
})

// 15. getSelectedElements
describe('getSelectedElements', () => {
    test('returns selected nodes and conns', () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1', '3'])
        w.vm.setSelectedConns(['e1-3'])
        const sel = w.vm.getSelectedElements()
        expect(sel.nodes.map(n => n.id)).toEqual(['1', '3'])
        expect(sel.conns.map(c => c.id)).toEqual(['e1-3'])
        w.destroy()
    })
    test('returns empty when nothing selected', () => {
        const w = createWrapper()
        const sel = w.vm.getSelectedElements()
        expect(sel.nodes).toEqual([])
        expect(sel.conns).toEqual([])
        w.destroy()
    })
    test('ignores non-existent IDs', () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1', 'nonexistent'])
        const sel = w.vm.getSelectedElements()
        expect(sel.nodes.length).toBe(1)
        expect(sel.nodes[0].id).toBe('1')
        w.destroy()
    })
})

// 16. updateNodeInternals
describe('updateNodeInternals', () => {
    test('stores dimensions', () => {
        const w = createWrapper()
        w.vm.updateNodeInternals('1', { width: 200, height: 80 })
        expect(w.vm.nodeInternals['1']).toEqual({ width: 200, height: 80 })
        w.destroy()
    })
    test('skips update when same dimensions', () => {
        const w = createWrapper()
        w.vm.updateNodeInternals('1', { width: 200, height: 80 })
        const ref1 = w.vm.nodeInternals['1']
        w.vm.updateNodeInternals('1', { width: 200, height: 80 })
        // Should be same reference (no $set called)
        expect(w.vm.nodeInternals['1']).toBe(ref1)
        w.destroy()
    })
    test('updates when dimensions change', () => {
        const w = createWrapper()
        w.vm.updateNodeInternals('1', { width: 200, height: 80 })
        w.vm.updateNodeInternals('1', { width: 300, height: 90 })
        expect(w.vm.nodeInternals['1']).toEqual({ width: 300, height: 90 })
        w.destroy()
    })
})

// 18. Settings icon visibility rules
describe('Settings icon visibility(hover 模式; 預設 dblclick 見 unit-settings-trigger)', () => {
    describe('NodeWrapper', () => {
        test('hidden when not hovered', () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            expect(nw.vm.hovered).toBe(false)
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(false)
            w.destroy()
        })

        test('shown when hovered', async () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            nw.vm.hovered = true
            await w.vm.$nextTick()
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(true)
            w.destroy()
        })

        test('stays when popup open and mouse leaves', async () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            nw.vm.hovered = true
            nw.vm.settingsPopupShow = true
            await w.vm.$nextTick()
            nw.vm.hovered = false
            await w.vm.$nextTick()
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(true)
            w.destroy()
        })

        test('hides when popup closed and not hovered', async () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            nw.vm.hovered = false
            nw.vm.settingsPopupShow = false
            await w.vm.$nextTick()
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(false)
            w.destroy()
        })

        test('hidden when locked even if hovered', async () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            nw.vm.hovered = true
            await w.vm.$nextTick()
            w.vm.toggleInteractive()
            await w.vm.$nextTick()
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(false)
            w.destroy()
        })
    })

    describe('EdgeWrapper', () => {
        test('hidden when not hovered', () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            expect(ew.vm.hovered).toBe(false)
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(false)
            w.destroy()
        })

        test('shown when hovered', async () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            ew.vm.hovered = true
            await w.vm.$nextTick()
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(true)
            w.destroy()
        })

        test('stays when popup open and mouse leaves', async () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            ew.vm.hovered = true
            ew.vm.settingsPopupShow = true
            await w.vm.$nextTick()
            ew.vm.hovered = false
            await w.vm.$nextTick()
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(true)
            w.destroy()
        })

        test('hides when popup closed and not hovered', async () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            ew.vm.hovered = false
            ew.vm.settingsPopupShow = false
            await w.vm.$nextTick()
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(false)
            w.destroy()
        })

        test('hidden when locked even if hovered', async () => {
            const w = createWrapper({ nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            ew.vm.hovered = true
            await w.vm.$nextTick()
            w.vm.toggleInteractive()
            await w.vm.$nextTick()
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(false)
            w.destroy()
        })
    })
})

// 19. Settings popup open/close
describe('Settings popup open/close', () => {
    describe('NodeWrapper', () => {
        test('clicking settings icon opens popup', async () => {
            const w = createWrapper()
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            nw.vm.hovered = true
            await w.vm.$nextTick()
            expect(nw.vm.settingsPopupShow).toBe(false)
            // Simulate WPopup opening (v-model sets settingsPopupShow)
            nw.vm.settingsPopupShow = true
            await w.vm.$nextTick()
            expect(nw.vm.settingsPopupShow).toBe(true)
            w.destroy()
        })

        test('popup remains open when mouse leaves node', async () => {
            const w = createWrapper()
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            nw.vm.hovered = true
            nw.vm.settingsPopupShow = true
            await w.vm.$nextTick()
            // Mouse leaves
            nw.vm.hovered = false
            await w.vm.$nextTick()
            // Popup still open
            expect(nw.vm.settingsPopupShow).toBe(true)
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(true)
            w.destroy()
        })

        test('popup closes and anchor hides after popup dismissed', async () => {
            const w = createWrapper()
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            nw.vm.hovered = false
            nw.vm.settingsPopupShow = true
            await w.vm.$nextTick()
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(true)
            // Popup dismissed (WPopup sets v-model to false)
            nw.vm.settingsPopupShow = false
            await w.vm.$nextTick()
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(false)
            w.destroy()
        })
    })

    describe('EdgeWrapper', () => {
        test('clicking settings icon opens popup', async () => {
            const w = createWrapper()
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            ew.vm.hovered = true
            await w.vm.$nextTick()
            expect(ew.vm.settingsPopupShow).toBe(false)
            ew.vm.settingsPopupShow = true
            await w.vm.$nextTick()
            expect(ew.vm.settingsPopupShow).toBe(true)
            w.destroy()
        })

        test('popup remains open when mouse leaves edge', async () => {
            const w = createWrapper()
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            ew.vm.hovered = true
            ew.vm.settingsPopupShow = true
            await w.vm.$nextTick()
            ew.vm.hovered = false
            await w.vm.$nextTick()
            expect(ew.vm.settingsPopupShow).toBe(true)
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(true)
            w.destroy()
        })

        test('popup closes and anchor hides after popup dismissed', async () => {
            const w = createWrapper()
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            ew.vm.hovered = false
            ew.vm.settingsPopupShow = true
            await w.vm.$nextTick()
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(true)
            ew.vm.settingsPopupShow = false
            await w.vm.$nextTick()
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(false)
            w.destroy()
        })
    })
})

// 17. setViewport
describe('setViewport', () => {
    test('sets all viewport properties', () => {
        const w = createWrapper()
        w.vm.setViewport({ x: 100, y: 200, zoom: 1.5 })
        expect(w.vm.viewport).toEqual({ x: 100, y: 200, zoom: 1.5 })
        w.destroy()
    })
    test('partial update only changes specified', () => {
        const w = createWrapper()
        w.vm.setViewport({ x: 0, y: 0, zoom: 1 })
        w.vm.setViewport({ x: 50 })
        expect(w.vm.viewport.x).toBe(50)
        expect(w.vm.viewport.y).toBe(0)
        expect(w.vm.viewport.zoom).toBe(1)
        w.destroy()
    })
    test('ignores undefined values', () => {
        const w = createWrapper()
        w.vm.setViewport({ x: 10, y: 20, zoom: 1.2 })
        w.vm.setViewport({ x: undefined, y: 30 })
        expect(w.vm.viewport.x).toBe(10) // unchanged
        expect(w.vm.viewport.y).toBe(30)
        w.destroy()
    })
})

// 18. panToNode
describe('panToNode', () => {
    // node '1': position (50,50), 100x40 → center (100,70); jsdom rect is 0 → container falls back to 800x600
    test('returns false for unknown node', () => {
        const w = createWrapper()
        expect(w.vm.panToNode('nope')).toBe(false)
        w.destroy()
    })
    test('duration 0 jumps to centered viewport and emits viewport-change', () => {
        const w = createWrapper()
        const ok = w.vm.panToNode('1', { zoom: 2, duration: 0 })
        expect(ok).toBe(true)
        expect(w.vm.viewport).toEqual({ x: 400 - 100 * 2, y: 300 - 70 * 2, zoom: 2 })
        expect(w.emitted('viewport-change')).toBeTruthy()
        w.destroy()
    })
    test('zoom defaults to current zoom', () => {
        const w = createWrapper()
        w.vm.setViewport({ x: 0, y: 0, zoom: 1.5 })
        w.vm.panToNode('1', { duration: 0 })
        expect(w.vm.viewport.zoom).toBe(1.5)
        expect(w.vm.viewport.x).toBe(400 - 100 * 1.5)
        w.destroy()
    })
    test('animates via requestAnimationFrame and finishes at target', () => {
        const rafCbs = []
        const origRaf = global.requestAnimationFrame
        const origCaf = global.cancelAnimationFrame
        global.requestAnimationFrame = (cb) => { rafCbs.push(cb); return rafCbs.length }
        global.cancelAnimationFrame = () => {}
        const w = createWrapper()
        const ok = w.vm.panToNode('1', { zoom: 1, duration: 100 })
        expect(ok).toBe(true)
        rafCbs.shift()(0) // first frame → t=0, viewport stays at start
        expect(w.vm.viewport.x).toBe(0)
        rafCbs.shift()(50) // midway → easeInOutCubic(0.5)=0.5
        expect(w.vm.viewport.x).toBeCloseTo(150)
        expect(w.vm.viewport.y).toBeCloseTo(115)
        rafCbs.shift()(100) // done
        expect(w.vm.viewport).toEqual({ x: 300, y: 230, zoom: 1 })
        expect(w.emitted('viewport-change')).toBeTruthy()
        w.destroy()
        global.requestAnimationFrame = origRaf
        global.cancelAnimationFrame = origCaf
    })
    test('re-call cancels previous animation', () => {
        const rafCbs = []
        let cancelled = null
        const origRaf = global.requestAnimationFrame
        const origCaf = global.cancelAnimationFrame
        let rafId = 0
        global.requestAnimationFrame = (cb) => { rafCbs.push(cb); return ++rafId }
        global.cancelAnimationFrame = (id) => { cancelled = id }
        const w = createWrapper()
        w.vm.panToNode('1', { duration: 100 })
        const firstId = rafId
        w.vm.panToNode('2', { duration: 100 })
        expect(cancelled).toBe(firstId)
        w.destroy()
        global.requestAnimationFrame = origRaf
        global.cancelAnimationFrame = origCaf
    })
    test('openPopup opens node info popup after pan', async () => {
        const w = createWrapper()
        w.vm.panToNode('1', { duration: 0, openPopup: true })
        await w.vm.$nextTick()
        const nw = w.findAllComponents({ name: 'NodeWrapper' }).wrappers.find(c => c.vm.node.id === '1')
        expect(nw.vm.infoPopupShow).toBe(true)
        w.destroy()
    })
})

// 19. openNodeInfoPopup / openConnInfoPopup / conn click popup
describe('info popup programmatic open', () => {
    test('openNodeInfoPopup opens target node popup', () => {
        const w = createWrapper()
        expect(w.vm.openNodeInfoPopup('1')).toBe(true)
        const nw = w.findAllComponents({ name: 'NodeWrapper' }).wrappers.find(c => c.vm.node.id === '1')
        expect(nw.vm.infoPopupShow).toBe(true)
        w.destroy()
    })
    test('openNodeInfoPopup returns false for unknown node', () => {
        const w = createWrapper()
        expect(w.vm.openNodeInfoPopup('nope')).toBe(false)
        w.destroy()
    })
    test('openConnInfoPopup opens target conn popup', () => {
        const w = createWrapper()
        expect(w.vm.openConnInfoPopup('e1-3')).toBe(true)
        const ew = w.findAllComponents({ name: 'EdgeWrapper' }).wrappers.find(c => c.vm.conn.id === 'e1-3')
        expect(ew.vm.infoPopupShow).toBe(true)
        w.destroy()
    })
    test('openConnInfoPopup returns false for unknown conn', () => {
        const w = createWrapper()
        expect(w.vm.openConnInfoPopup('nope')).toBe(false)
        w.destroy()
    })
    test('conn click opens info popup when conn has name', () => {
        const w = createWrapper({ connsSettingsTrigger: 'hover' }) //hover 模式: 資訊 popup 立即開(dblclick 模式延後雙擊判定窗)
        const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
        ew.vm.onClick(new MouseEvent('click'))
        expect(ew.vm.infoPopupShow).toBe(true)
        expect(ew.emitted('conn-click')).toBeTruthy()
        w.destroy()
    })
    test('conn click opens info popup when unnamed conn has description', () => {
        const w = createWrapper({ conns: [{ id: 'e1-3', from: '1', to: '3', description: 'desc' }], connsSettingsTrigger: 'hover' })
        const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
        expect(ew.find('.vue-flow__edge-popup-anchor').exists()).toBe(true)
        ew.vm.onClick(new MouseEvent('click'))
        expect(ew.vm.infoPopupShow).toBe(true)
        w.destroy()
    })
    test('conn click without popup content keeps original behavior', () => {
        const w = createWrapper({ conns: [{ id: 'e1-3', from: '1', to: '3' }] })
        const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
        ew.vm.onClick(new MouseEvent('click'))
        expect(ew.vm.infoPopupShow).toBe(false)
        expect(ew.emitted('conn-click')).toBeTruthy()
        w.destroy()
    })
})

// 20. opt.locked initial state
describe('opt.locked', () => {
    test('defaults to unlocked', () => {
        const w = createWrapper()
        expect(w.vm.locked).toBe(false)
        w.destroy()
    })
    test('locked: true starts locked', async () => {
        const w = createWrapper({ locked: true })
        expect(w.vm.locked).toBe(true)
        await w.vm.$nextTick()
        expect(w.findComponent({ name: 'NodeRenderer' }).props('locked')).toBe(true)
        w.destroy()
    })
    test('Controls toggle still works after initial lock', () => {
        const w = createWrapper({ locked: true })
        w.vm.toggleInteractive()
        expect(w.vm.locked).toBe(false)
        expect(w.emitted('toggle-interactive')[0]).toEqual([false])
        w.destroy()
    })
})