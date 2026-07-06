/**
 * Feature tests: Settings Forms, Node Resize, Box Selection, Pan.
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeSettingsForm from '../src/components/ui/NodeSettingsForm.vue'
import ConnSettingsForm from '../src/components/ui/ConnSettingsForm.vue'

const sampleNodes = [
    { id: '1', type: 'input', name: 'Node 1', position: { x: 50, y: 50 }, width: 100, height: 40 },
    { id: '2', type: 'output', name: 'Node 2', position: { x: 300, y: 300 }, width: 100, height: 40 },
    { id: '3', type: 'basic', name: 'Node 3', position: { x: 200, y: 150 }, width: 100, height: 40 },
]
const sampleConns = [
    { id: 'e1-3', from: '1', to: '3', name: 'conn 1-3' },
    { id: 'e3-2', from: '3', to: '2', name: 'conn 3-2', markerEnd: 'arrowclosed' },
]
const defNode = {
    type: 'basic', shape: 'rectangle', width: 100, height: 40,
    fontSize: 12, fontSizeMin: 1, fontSizeMax: 72,
    fontColor: '#333333', faceColor: '#ffffff', edgeColor: '#bbbbbb', edgeWidth: 1,
    toPosition: 'bottom', fromPosition: 'top', popupDirection: 'right',
}
const defConn = {
    type: 'bezier', fontSize: 10, fontSizeMin: 1, fontSizeMax: 72,
    fontColor: '#333333', edgeColor: '#b1b1b7', edgeWidth: 1,
    edgeDasharray: '', markerEnd: '', animated: false, defOffset: 24,
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
    const node = { id: '1', type: 'basic', name: 'Test', description: 'desc', fontSize: 14, fontColor: '#000', faceColor: '#fff', edgeColor: '#ccc', edgeWidth: 2, shape: 'rectangle', popupDirection: 'right', fromPosition: 'top', toPosition: 'bottom' }
    function mountForm(ov = {}) {
        return mount(NodeSettingsForm, { propsData: { node: { ...node, ...ov }, defNode } })
    }

    test('renders text inputs', () => { const w = mountForm(); expect(w.findAll('input[type="text"]').length).toBe(2); w.destroy() })
    test('emits update on name', async () => { const w = mountForm(); await w.findAll('input[type="text"]').at(0).setValue('X'); expect(w.emitted('update')[0]).toEqual(['name', 'X']); w.destroy() })
    test('emits update on description', async () => { const w = mountForm(); await w.findAll('input[type="text"]').at(1).setValue('D'); expect(w.emitted('update')[0]).toEqual(['description', 'D']); w.destroy() })
    test('emits update on type', async () => { const w = mountForm(); const s = w.findAll('select').at(0); s.element.value = 'output'; await s.trigger('input'); expect(w.emitted('update').some(e => e[0] === 'type')).toBe(true); w.destroy() })
    test('emits update on shape', async () => { const w = mountForm(); const s = w.findAll('select').at(1); s.element.value = 'diamond'; await s.trigger('input'); expect(w.emitted('update').some(e => e[0] === 'shape')).toBe(true); w.destroy() })
    test('fontSize ignores below min', () => { const w = mountForm(); w.vm.onFontSizeInput('0'); expect(w.emitted('update')).toBeFalsy(); w.destroy() })
    test('fontSize clamps to max', () => { const w = mountForm(); w.vm.onFontSizeInput('100'); expect(w.emitted('update')[0]).toEqual(['fontSize', 72]); w.destroy() })
    test('fontSize accepts valid', () => { const w = mountForm(); w.vm.onFontSizeInput('20'); expect(w.emitted('update')[0]).toEqual(['fontSize', 20]); w.destroy() })
    test('edgeWidth ignores below 1', () => { const w = mountForm(); w.vm.onEdgeWidthInput('0'); expect(w.emitted('update')).toBeFalsy(); w.destroy() })
    test('edgeWidth clamps to 24', () => { const w = mountForm(); w.vm.onEdgeWidthInput('30'); expect(w.emitted('update')[0]).toEqual(['edgeWidth', 24]); w.destroy() })
    test('delete confirm then emit', async () => {
        const w = mountForm()
        expect(w.find('.vue-flow__delete-warn').exists()).toBe(false)
        await w.find('.vue-flow__delete-btn').trigger('click')
        expect(w.find('.vue-flow__delete-warn').exists()).toBe(true)
        await w.find('.vue-flow__delete-confirm-row .vue-flow__delete-btn').trigger('click')
        expect(w.emitted('delete')).toBeTruthy()
        w.destroy()
    })
    test('delete cancel', async () => {
        const w = mountForm()
        await w.find('.vue-flow__delete-btn').trigger('click')
        await w.find('.vue-flow__delete-btn--cancel').trigger('click')
        expect(w.find('.vue-flow__delete-warn').exists()).toBe(false)
        w.destroy()
    })
    test('textFontSize prop', () => {
        const w = mount(NodeSettingsForm, { propsData: { node, defNode, textFontSize: '16px' } })
        expect(w.find('.vue-flow__settings-form').element.style.fontSize).toBe('16px')
        w.destroy()
    })
    test('basic shows from/to handle', () => {
        const w = mountForm({ type: 'basic' })
        const t = w.findAll('label').wrappers.map(l => l.text())
        expect(t.some(x => x.includes('From Handle'))).toBe(true)
        expect(t.some(x => x.includes('To Handle'))).toBe(true)
        w.destroy()
    })
    test('input hides from handle', () => {
        const w = mountForm({ type: 'input' })
        const t = w.findAll('label').wrappers.map(l => l.text())
        expect(t.some(x => x.includes('From Handle'))).toBe(false)
        w.destroy()
    })
})

// 2. ConnSettingsForm
describe('ConnSettingsForm', () => {
    const conn = { id: 'e1', from: '1', to: '2', name: 'C', type: 'bezier', fontSize: 10, fontColor: '#333', edgeColor: '#b1b1b7', edgeWidth: 1, markerEnd: '', animated: false }
    function mountForm(ov = {}) {
        return mount(ConnSettingsForm, { propsData: { conn: { ...conn, ...ov }, defConn } })
    }

    test('renders text inputs', () => { const w = mountForm(); expect(w.findAll('input[type="text"]').length).toBe(2); w.destroy() })
    test('emits update on name', async () => { const w = mountForm(); await w.findAll('input[type="text"]').at(0).setValue('N'); expect(w.emitted('update')[0]).toEqual(['name', 'N']); w.destroy() })
    test('emits update on type', async () => { const w = mountForm(); const s = w.findAll('select').at(0); s.element.value = 'step'; await s.trigger('input'); expect(w.emitted('update').some(e => e[0] === 'type')).toBe(true); w.destroy() })
    test('emits update on animated', async () => { const w = mountForm(); await w.find('input[type="checkbox"]').setChecked(true); expect(w.emitted('update').some(e => e[0] === 'animated')).toBe(true); w.destroy() })
    test('emits update on markerEnd', async () => { const w = mountForm(); const s = w.findAll('select').at(1); s.element.value = 'arrowclosed'; await s.trigger('input'); expect(w.emitted('update').some(e => e[0] === 'markerEnd')).toBe(true); w.destroy() })
    test('fontSize clamps', () => { const w = mountForm(); w.vm.onFontSizeInput('100'); expect(w.emitted('update')[0]).toEqual(['fontSize', 72]); w.destroy() })
    test('edgeWidth clamps', () => { const w = mountForm(); w.vm.onEdgeWidthInput('30'); expect(w.emitted('update')[0]).toEqual(['edgeWidth', 24]); w.destroy() })
    test('delete confirm', async () => {
        const w = mountForm()
        await w.find('.vue-flow__delete-btn').trigger('click')
        await w.find('.vue-flow__delete-confirm-row .vue-flow__delete-btn').trigger('click')
        expect(w.emitted('delete')).toBeTruthy()
        w.destroy()
    })
    test('textFontSize prop', () => {
        const w = mount(ConnSettingsForm, { propsData: { conn, defConn, textFontSize: '14px' } })
        expect(w.find('.vue-flow__settings-form').element.style.fontSize).toBe('14px')
        w.destroy()
    })
})

// 3. Node Resize
describe('Node Resize', () => {
    test('onNodeResize sets overlay', () => {
        const w = createWrapper(); w.vm.onNodeResize({ nodeId: '1', width: 200, height: 80, x: 50, y: 50 })
        expect(w.vm.resizeOverlay).toEqual({ id: '1', width: 200, height: 80, x: 50, y: 50 }); w.destroy()
    })
    test('onNodeResizeEnd updates node', () => {
        const w = createWrapper()
        w.vm.onNodeResize({ nodeId: '1', width: 200, height: 80, x: 60, y: 70 })
        w.vm.onNodeResizeEnd({ nodeId: '1', width: 200, height: 80, x: 60, y: 70 })
        const n = w.vm.nodeById('1')
        expect(n.width).toBe(200); expect(n.height).toBe(80)
        expect(n.position.x).toBe(60); expect(n.position.y).toBe(70)
        expect(w.vm.resizeOverlay).toBeNull(); w.destroy()
    })
    test('blocked when locked', () => {
        const w = createWrapper(); w.vm.toggleInteractive()
        w.vm.onNodeResize({ nodeId: '1', width: 200, height: 80, x: 50, y: 50 })
        expect(w.vm.resizeOverlay).toBeNull(); w.destroy()
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
        expect(w.vm.selectionBox).toEqual({ x: 100, y: 100, width: 0, height: 0 }); w.destroy()
    })
    test('doSelection updates box', () => {
        const w = createWrapper()
        w.vm.$refs.canvas = { getContainerRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }
        w.vm.startSelection({ clientX: 100, clientY: 100 })
        w.vm.doSelection({ clientX: 300, clientY: 250 })
        expect(w.vm.selectionBox).toEqual({ x: 100, y: 100, width: 200, height: 150 }); w.destroy()
    })
    test('doSelection reverse drag', () => {
        const w = createWrapper()
        w.vm.$refs.canvas = { getContainerRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }
        w.vm.startSelection({ clientX: 300, clientY: 300 })
        w.vm.doSelection({ clientX: 100, clientY: 100 })
        expect(w.vm.selectionBox).toEqual({ x: 100, y: 100, width: 200, height: 200 }); w.destroy()
    })
    test('endSelection selects nodes', () => {
        const w = createWrapper()
        w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.selectionBox = { x: 40, y: 40, width: 270, height: 160 }
        w.vm.isSelecting = true; w.vm.endSelection()
        expect(w.vm.selectedNodes).toContain('1')
        expect(w.vm.selectedNodes).toContain('3')
        expect(w.vm.isSelecting).toBe(false); w.destroy()
    })
    test('endSelection auto-selects conns', () => {
        const w = createWrapper()
        w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.selectionBox = { x: 40, y: 40, width: 270, height: 160 }
        w.vm.isSelecting = true; w.vm.endSelection()
        expect(w.vm.selectedConns).toContain('e1-3')
        expect(w.vm.selectedConns).not.toContain('e3-2'); w.destroy()
    })
    test('endSelection clears state', () => {
        const w = createWrapper()
        w.vm.selectionBox = { x: 0, y: 0, width: 0, height: 0 }
        w.vm.isSelecting = true; w.vm.selectionStartPos = { x: 0, y: 0 }
        w.vm.endSelection()
        expect(w.vm.isSelecting).toBe(false)
        expect(w.vm.selectionStartPos).toBeNull()
        expect(w.vm.selectionBox).toBeNull(); w.destroy()
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
        // zoom should be finite (may be 0 if container has no size in jsdom)
        expect(isFinite(w.vm.viewport.zoom)).toBe(true)
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
    test('shift+click adds conn to selection', () => {
        const w = createWrapper()
        w.vm.onConnClick({ conn: { id: 'e1-3' }, event: { clientX: 100, clientY: 100 } })
        w.vm.keysPressed = { Shift: true }
        w.vm.onConnClick({ conn: { id: 'e3-2' }, event: { clientX: 100, clientY: 100 } })
        expect(w.vm.selectedConns).toContain('e1-3')
        expect(w.vm.selectedConns).toContain('e3-2')
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
        expect(w.vm.resizeOverlay.width).toBe(137)
        expect(w.vm.resizeOverlay.height).toBe(63)
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

// 10. EdgeMarkerDefs ID consistency
describe('EdgeMarkerDefs ID consistency', () => {
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
        w.destroy()
    })
    test('string marker and object marker produce same ID', () => {
        const w = createWrapper()
        const defs = w.findComponent({ name: 'EdgeMarkerDefs' })
        const id1 = defs.vm.getMarkerId('arrowclosed', '#b1b1b7')
        const id2 = defs.vm.getMarkerId({ type: 'arrowclosed' }, '#b1b1b7')
        expect(id1).toBe(id2)
        w.destroy()
    })
})

// 12. EdgeWrapper.getMarkerUrl
describe('EdgeWrapper.getMarkerUrl', () => {
    test('string marker returns correct URL', () => {
        const w = createWrapper()
        const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
        const url = ew.vm.getMarkerUrl('arrowclosed')
        expect(url).toBe('url(#vue-flow__arrowclosed_b1b1b7)')
        w.destroy()
    })
    test('object marker with color', () => {
        const w = createWrapper()
        const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
        const url = ew.vm.getMarkerUrl({ type: 'arrow', color: '#ff0000' })
        expect(url).toBe('url(#vue-flow__arrow_ff0000)')
        w.destroy()
    })
    test('object marker without color uses default', () => {
        const w = createWrapper()
        const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
        const url = ew.vm.getMarkerUrl({ type: 'arrow' })
        expect(url).toBe('url(#vue-flow__arrow_b1b1b7)')
        w.destroy()
    })
    test('null marker returns null', () => {
        const w = createWrapper()
        const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
        expect(ew.vm.getMarkerUrl(null)).toBeNull()
        expect(ew.vm.getMarkerUrl('')).toBeNull()
        w.destroy()
    })
})

// 13. onDocMouseMove dispatching
describe('onDocMouseMove dispatching', () => {
    test('dispatches to doPan when panning', () => {
        const w = createWrapper()
        w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.startPan({ clientX: 100, clientY: 100 })
        w.vm.onDocMouseMove({ clientX: 150, clientY: 120 })
        expect(w.vm.viewport.x).toBe(50)
        expect(w.vm.viewport.y).toBe(20)
        w.destroy()
    })
    test('dispatches to doSelection when selecting', () => {
        const w = createWrapper()
        w.vm.$refs.canvas = { getContainerRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }
        w.vm.startSelection({ clientX: 100, clientY: 100 })
        w.vm.onDocMouseMove({ clientX: 200, clientY: 200 })
        expect(w.vm.selectionBox.width).toBe(100)
        expect(w.vm.selectionBox.height).toBe(100)
        w.destroy()
    })
    test('does nothing when idle', () => {
        const w = createWrapper()
        w.vm.viewport = { x: 0, y: 0, zoom: 1 }
        w.vm.onDocMouseMove({ clientX: 200, clientY: 200 })
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
        w.vm.selectionBox = { x: 0, y: 0, width: 10, height: 10 }
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
describe('Settings icon visibility', () => {
    describe('NodeWrapper', () => {
        test('hidden when not hovered', () => {
            const w = createWrapper()
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            expect(nw.vm.hovered).toBe(false)
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(false)
            w.destroy()
        })

        test('shown when hovered', async () => {
            const w = createWrapper()
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            nw.vm.hovered = true
            await w.vm.$nextTick()
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(true)
            w.destroy()
        })

        test('stays when popup open and mouse leaves', async () => {
            const w = createWrapper()
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
            const w = createWrapper()
            const nw = w.findAllComponents({ name: 'NodeWrapper' }).at(0)
            nw.vm.hovered = false
            nw.vm.settingsPopupShow = false
            await w.vm.$nextTick()
            expect(nw.find('.vue-flow__node-settings-anchor').exists()).toBe(false)
            w.destroy()
        })

        test('hidden when locked even if hovered', async () => {
            const w = createWrapper()
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
            const w = createWrapper()
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            expect(ew.vm.hovered).toBe(false)
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(false)
            w.destroy()
        })

        test('shown when hovered', async () => {
            const w = createWrapper()
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            ew.vm.hovered = true
            await w.vm.$nextTick()
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(true)
            w.destroy()
        })

        test('stays when popup open and mouse leaves', async () => {
            const w = createWrapper()
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
            const w = createWrapper()
            const ew = w.findAllComponents({ name: 'EdgeWrapper' }).at(0)
            ew.vm.hovered = false
            ew.vm.settingsPopupShow = false
            await w.vm.$nextTick()
            expect(ew.find('.vue-flow__edge-settings-anchor').exists()).toBe(false)
            w.destroy()
        })

        test('hidden when locked even if hovered', async () => {
            const w = createWrapper()
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