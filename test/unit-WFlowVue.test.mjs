import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'

const sampleNodes = [
    { id: '1', type: 'input', name: 'Node 1', position: { x: 250, y: 5 } },
    { id: '2', type: 'output', name: 'Node 2', position: { x: 100, y: 250 } },
    { id: '3', type: 'basic', name: 'Node 3', position: { x: 400, y: 300 } },
]

const sampleConns = [
    { id: 'e1-2', from: '1', to: '2', animated: true },
    { id: 'e1-3', from: '1', to: '3', name: 'edge with arrowhead', markerEnd: 'arrowclosed' },
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

function mockNodeEvent() {
    const el = document.createElement('div')
    el.classList.add('vue-flow__node')
    el.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40 })
    return { target: el, clientX: 0, clientY: 0 }
}

describe('WFlowVue', () => {
    afterEach(() => {
        document.body.innerHTML = ''
    })

    describe('rendering', () => {
        test('mounts successfully', () => {
            const wrapper = createWrapper()
            expect(wrapper.exists()).toBe(true)
            wrapper.destroy()
        })

        test('renders all visible nodes', () => {
            const wrapper = createWrapper()
            const nodeEls = wrapper.findAll('.vue-flow__node')
            expect(nodeEls).toHaveLength(3)
            wrapper.destroy()
        })

        test('renders node names', () => {
            const wrapper = createWrapper()
            expect(wrapper.text()).toContain('Node 1')
            expect(wrapper.text()).toContain('Node 2')
            expect(wrapper.text()).toContain('Node 3')
            wrapper.destroy()
        })

        test('renders conns', () => {
            const wrapper = createWrapper()
            const connGroups = wrapper.findAll('.vue-flow__edge')
            expect(connGroups).toHaveLength(2)
            wrapper.destroy()
        })

        test('renders conn name', () => {
            const wrapper = createWrapper()
            expect(wrapper.text()).toContain('edge with arrowhead')
            wrapper.destroy()
        })

        test('renders background', () => {
            const wrapper = createWrapper()
            expect(wrapper.find('.vue-flow__background').exists()).toBe(true)
            wrapper.destroy()
        })

        test('renders correct node types', () => {
            const wrapper = createWrapper()
            expect(wrapper.find('.vue-flow__node-input').exists()).toBe(true)
            expect(wrapper.find('.vue-flow__node-output').exists()).toBe(true)
            expect(wrapper.find('.vue-flow__node-basic').exists()).toBe(true)
            wrapper.destroy()
        })

        test('does not render hidden nodes', () => {
            const nodes = [
                ...sampleNodes,
                { id: '4', type: 'basic', name: 'Hidden', position: { x: 0, y: 0 }, hidden: true },
            ]
            const wrapper = createWrapper({ nodes })
            const nodeEls = wrapper.findAll('.vue-flow__node')
            expect(nodeEls).toHaveLength(3)
            wrapper.destroy()
        })
    })

    describe('node selection', () => {
        test('onNodeClick emits node-click', () => {
            const wrapper = createWrapper()
            const node = wrapper.vm.nodeById('1')
            wrapper.vm.onNodeClick({ node, event: mockNodeEvent() })
            expect(wrapper.emitted('node-click')).toBeTruthy()
            expect(wrapper.emitted('node-click')[0][0].node.id).toBe('1')
            wrapper.destroy()
        })

        test('onNodeClick selects the node', () => {
            const wrapper = createWrapper()
            const node = wrapper.vm.nodeById('1')
            wrapper.vm.onNodeClick({ node, event: mockNodeEvent() })
            expect(wrapper.vm.selectedNodes).toContain('1')
            wrapper.destroy()
        })

        test('clearSelection clears all', () => {
            const wrapper = createWrapper()
            const node = wrapper.vm.nodeById('1')
            wrapper.vm.onNodeClick({ node, event: mockNodeEvent() })
            wrapper.vm.clearSelection()
            expect(wrapper.vm.selectedNodes).toHaveLength(0)
            wrapper.destroy()
        })

        test('selection-change event emitted', () => {
            const wrapper = createWrapper()
            const node = wrapper.vm.nodeById('1')
            wrapper.vm.onNodeClick({ node, event: mockNodeEvent() })
            expect(wrapper.emitted('selection-change')).toBeTruthy()
            wrapper.destroy()
        })
    })

    describe('conn selection', () => {
        test('onConnClick emits conn-click', () => {
            const wrapper = createWrapper()
            const conn = wrapper.vm.connById('e1-2')
            wrapper.vm.onConnClick({ conn, event: new MouseEvent('click') })
            expect(wrapper.emitted('conn-click')).toBeTruthy()
            wrapper.destroy()
        })
    })

    describe('viewport', () => {
        test('default viewport is applied', () => {
            const wrapper = createWrapper({ center: [50, 100], zoom: 1.5 })
            expect(wrapper.vm.viewport).toEqual({ x: 50, y: 100, zoom: 1.5 })
            wrapper.destroy()
        })

        test('zoomIn increases zoom', () => {
            const wrapper = createWrapper()
            const initialZoom = wrapper.vm.viewport.zoom
            wrapper.vm.zoomIn()
            expect(wrapper.vm.viewport.zoom).toBeGreaterThan(initialZoom)
            wrapper.destroy()
        })

        test('zoomOut decreases zoom', () => {
            const wrapper = createWrapper()
            const initialZoom = wrapper.vm.viewport.zoom
            wrapper.vm.zoomOut()
            expect(wrapper.vm.viewport.zoom).toBeLessThan(initialZoom)
            wrapper.destroy()
        })

        test('zoomIn respects maxZoom', () => {
            const wrapper = createWrapper({ zoomMax: 1.5 })
            wrapper.vm.zoomIn()
            wrapper.vm.zoomIn()
            wrapper.vm.zoomIn()
            wrapper.vm.zoomIn()
            wrapper.vm.zoomIn()
            expect(wrapper.vm.viewport.zoom).toBeLessThanOrEqual(1.5)
            wrapper.destroy()
        })

        test('zoomOut respects minZoom', () => {
            const wrapper = createWrapper({ zoomMin: 0.5 })
            wrapper.vm.zoomOut()
            wrapper.vm.zoomOut()
            wrapper.vm.zoomOut()
            wrapper.vm.zoomOut()
            wrapper.vm.zoomOut()
            expect(wrapper.vm.viewport.zoom).toBeGreaterThanOrEqual(0.5)
            wrapper.destroy()
        })

        test('viewport-change emitted on zoom', () => {
            const wrapper = createWrapper()
            wrapper.vm.zoomIn()
            expect(wrapper.emitted('viewport-change')).toBeTruthy()
            wrapper.destroy()
        })
    })

    describe('deletion', () => {
        test('deleteSelectedElements removes selected nodes', () => {
            const wrapper = createWrapper()
            wrapper.vm.setSelectedNodes(['3'])
            wrapper.vm.deleteSelectedElements()
            expect(wrapper.vm.nodeById('3')).toBeNull()
            wrapper.destroy()
        })

        test('deleteSelectedElements removes connected conns', () => {
            const wrapper = createWrapper()
            wrapper.vm.setSelectedNodes(['1'])
            wrapper.vm.deleteSelectedElements()
            // Node 1 removed → e1-2 and e1-3 should also be removed
            expect(wrapper.vm.conns).toHaveLength(0)
            wrapper.destroy()
        })

        test('deleteSelectedElements emits delete event', () => {
            const wrapper = createWrapper()
            wrapper.vm.setSelectedNodes(['3'])
            wrapper.vm.deleteSelectedElements()
            expect(wrapper.emitted('delete')).toBeTruthy()
            expect(wrapper.emitted('delete')[0][0].nodes).toHaveLength(1)
            wrapper.destroy()
        })

        test('deleteSelectedElements respects deletable=false', () => {
            const nodes = [
                ...sampleNodes,
                { id: '4', type: 'basic', name: 'Undeletable', position: { x: 0, y: 0 }, deletable: false },
            ]
            const wrapper = createWrapper({ nodes })
            wrapper.vm.setSelectedNodes(['4'])
            wrapper.vm.deleteSelectedElements()
            expect(wrapper.vm.nodeById('4')).not.toBeNull()
            wrapper.destroy()
        })

        test('delete does nothing when nothing selected', () => {
            const wrapper = createWrapper()
            wrapper.vm.deleteSelectedElements()
            expect(wrapper.emitted('delete')).toBeFalsy()
            wrapper.destroy()
        })
    })

    describe('getFlowData', () => {
        test('returns deep copy of nodes and conns', () => {
            const wrapper = createWrapper()
            const data = wrapper.vm.getFlowData()
            expect(data.nodes).toHaveLength(3)
            expect(data.conns).toHaveLength(2)
            // Verify it is a copy
            data.nodes[0].name = 'Changed'
            expect(wrapper.vm.nodes[0].name).toBe('Node 1')
            wrapper.destroy()
        })
    })

    describe('node drag', () => {
        test('onNodeDragStart selects the node', () => {
            const wrapper = createWrapper()
            const node = wrapper.vm.nodeById('1')
            wrapper.vm.onNodeDragStart({
                node,
                event: { clientX: 100, clientY: 100 },
            })
            expect(wrapper.vm.selectedNodes).toContain('1')
            expect(wrapper.emitted('node-drag-start')).toBeTruthy()
            wrapper.destroy()
        })
    })

    describe('connection', () => {
        test('onConnectStart sets connecting state', () => {
            const wrapper = createWrapper()
            wrapper.vm.onConnectStart({
                nodeId: '1',
                handleId: 'source',
                handleType: 'source',
                handlePosition: 'bottom',
            })
            expect(wrapper.vm.isConnecting).toBe(true)
            expect(wrapper.emitted('connect-start')).toBeTruthy()
            wrapper.destroy()
        })
    })

    describe('props sync', () => {
        test('nodes change via opt prop', async () => {
            const wrapper = createWrapper()
            const newNodes = [
                { id: 'a', type: 'basic', name: 'A', position: { x: 0, y: 0 } },
            ]
            await wrapper.setProps({ opt: { nodes: newNodes, conns: [] } })
            expect(wrapper.vm.nodes).toHaveLength(1)
            expect(wrapper.vm.nodes[0].id).toBe('a')
            wrapper.destroy()
        })

        test('conns change via opt prop', async () => {
            const wrapper = createWrapper()
            await wrapper.setProps({ opt: { nodes: sampleNodes, conns: [] } })
            expect(wrapper.vm.conns).toHaveLength(0)
            wrapper.destroy()
        })
    })

    describe('keyboard', () => {
        test('delete key triggers deletion of selected', () => {
            const wrapper = createWrapper({ deleteKeyEnabled: true })
            wrapper.vm.setSelectedNodes(['3'])
            const event = new KeyboardEvent('keydown', { key: 'Backspace' })
            document.dispatchEvent(event)
            expect(wrapper.vm.nodeById('3')).toBeNull()
            wrapper.destroy()
        })
    })

    describe('locked', () => {
        test('initially unlocked', () => {
            const wrapper = createWrapper()
            expect(wrapper.vm.locked).toBe(false)
            wrapper.destroy()
        })

        test('toggleInteractive locks and unlocks', () => {
            const wrapper = createWrapper()
            wrapper.vm.toggleInteractive()
            expect(wrapper.vm.locked).toBe(true)
            wrapper.vm.toggleInteractive()
            expect(wrapper.vm.locked).toBe(false)
            wrapper.destroy()
        })

        test('locked blocks node drag', () => {
            const wrapper = createWrapper()
            wrapper.vm.toggleInteractive()
            const node = wrapper.vm.nodeById('1')
            const origX = node.position.x
            wrapper.vm.onNodeDragStart({ node, event: { clientX: 0, clientY: 0 } })
            expect(wrapper.vm.isDraggingNode).toBe(false)
            expect(node.position.x).toBe(origX)
            wrapper.destroy()
        })

        test('locked blocks node resize', () => {
            const wrapper = createWrapper()
            wrapper.vm.toggleInteractive()
            wrapper.vm.onNodeResize({ nodeId: '1', width: 200, height: 100, x: 0, y: 0 })
            expect(wrapper.vm.resizeOverlay).toBeNull()
            wrapper.destroy()
        })

        test('locked blocks delete key', () => {
            const wrapper = createWrapper({ deleteKeyEnabled: true })
            wrapper.vm.toggleInteractive()
            wrapper.vm.setSelectedNodes(['3'])
            const event = new KeyboardEvent('keydown', { key: 'Backspace' })
            document.dispatchEvent(event)
            expect(wrapper.vm.nodeById('3')).not.toBeNull()
            wrapper.destroy()
        })

        test('locked passes to NodeRenderer', async () => {
            const wrapper = createWrapper()
            wrapper.vm.toggleInteractive()
            await wrapper.vm.$nextTick()
            const nodeRenderer = wrapper.findComponent({ name: 'NodeRenderer' })
            expect(nodeRenderer.props('locked')).toBe(true)
            wrapper.destroy()
        })

        test('locked passes to EdgeRenderer', async () => {
            const wrapper = createWrapper()
            wrapper.vm.toggleInteractive()
            await wrapper.vm.$nextTick()
            const edgeRenderer = wrapper.findComponent({ name: 'EdgeRenderer' })
            expect(edgeRenderer.props('locked')).toBe(true)
            wrapper.destroy()
        })

        test('locked hides node settings icon', async () => {
            const wrapper = createWrapper()
            // Settings icon requires hover + unlocked; locked should hide it
            wrapper.vm.toggleInteractive()
            await wrapper.vm.$nextTick()
            expect(wrapper.findAll('.vue-flow__node-settings').length).toBe(0)
            wrapper.destroy()
        })

        test('locked hides node resize handles', async () => {
            const wrapper = createWrapper()
            wrapper.vm.toggleInteractive()
            await wrapper.vm.$nextTick()
            expect(wrapper.findAll('.vue-flow__resize--top-left').length).toBe(0)
            expect(wrapper.findAll('.vue-flow__resize--bottom-right').length).toBe(0)
            wrapper.destroy()
        })

        test('locked hides node handles via CSS class', async () => {
            const wrapper = createWrapper()
            wrapper.vm.toggleInteractive()
            await wrapper.vm.$nextTick()
            const lockedNodes = wrapper.findAll('.vue-flow__node--locked')
            expect(lockedNodes.length).toBeGreaterThan(0)
            wrapper.destroy()
        })

        test('locked hides edge settings icon', async () => {
            const wrapper = createWrapper()
            wrapper.vm.toggleInteractive()
            await wrapper.vm.$nextTick()
            const edgeWrappers = wrapper.findAllComponents({ name: 'EdgeWrapper' })
            edgeWrappers.wrappers.forEach(ew => {
                expect(ew.props('locked')).toBe(true)
            })
            wrapper.destroy()
        })
    })
})
