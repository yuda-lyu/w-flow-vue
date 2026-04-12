import { mount } from '@vue/test-utils'
import Handle from '../src/components/nodes/Handle.vue'
import DefaultNode from '../src/components/nodes/DefaultNode.vue'
import InputNode from '../src/components/nodes/InputNode.vue'
import OutputNode from '../src/components/nodes/OutputNode.vue'
import NodeBody from '../src/components/nodes/NodeBody.vue'
import NodeWrapper from '../src/components/nodes/NodeWrapper.vue'

describe('Handle', () => {
    test('renders with correct classes', () => {
        const wrapper = mount(Handle, {
            propsData: { type: 'source', position: 'bottom' },
        })
        expect(wrapper.classes()).toContain('vue-flow__handle')
        expect(wrapper.classes()).toContain('vue-flow__handle--bottom')
        expect(wrapper.classes()).toContain('vue-flow__handle--source')
    })

    test('emits connect-start on mousedown', () => {
        const wrapper = mount(Handle, {
            propsData: { type: 'source', position: 'bottom', connectable: true },
        })
        wrapper.trigger('mousedown')
        expect(wrapper.emitted('connect-start')).toBeTruthy()
        expect(wrapper.emitted('connect-start')[0][0]).toHaveProperty('handleType', 'source')
    })

    test('does not emit when not connectable', () => {
        const wrapper = mount(Handle, {
            propsData: { type: 'source', position: 'bottom', connectable: false },
        })
        wrapper.trigger('mousedown')
        expect(wrapper.emitted('connect-start')).toBeFalsy()
    })
})

describe('DefaultNode', () => {
    const node = { id: '1', type: 'basic', name: 'Test', position: { x: 0, y: 0 } }

    test('renders label', () => {
        const wrapper = mount(DefaultNode, { propsData: { node } })
        expect(wrapper.text()).toContain('Test')
    })

    test('has two handles', () => {
        const wrapper = mount(DefaultNode, { propsData: { node } })
        const handles = wrapper.findAllComponents(Handle)
        expect(handles).toHaveLength(2)
    })

    test('has target handle on top and source on bottom', () => {
        const wrapper = mount(DefaultNode, { propsData: { node } })
        const handles = wrapper.findAllComponents(Handle)
        const types = handles.wrappers.map(h => h.props('type'))
        expect(types).toContain('target')
        expect(types).toContain('source')
    })
})

describe('InputNode', () => {
    const node = { id: '1', type: 'input', name: 'Start', position: { x: 0, y: 0 } }

    test('renders label', () => {
        const wrapper = mount(InputNode, { propsData: { node } })
        expect(wrapper.text()).toContain('Start')
    })

    test('has one source handle', () => {
        const wrapper = mount(InputNode, { propsData: { node } })
        const handles = wrapper.findAllComponents(Handle)
        expect(handles).toHaveLength(1)
        expect(handles.at(0).props('type')).toBe('source')
    })
})

describe('OutputNode', () => {
    const node = { id: '1', type: 'output', name: 'End', position: { x: 0, y: 0 } }

    test('renders label', () => {
        const wrapper = mount(OutputNode, { propsData: { node } })
        expect(wrapper.text()).toContain('End')
    })

    test('has one target handle', () => {
        const wrapper = mount(OutputNode, { propsData: { node } })
        const handles = wrapper.findAllComponents(Handle)
        expect(handles).toHaveLength(1)
        expect(handles.at(0).props('type')).toBe('target')
    })
})

describe('NodeBody', () => {
    test('renders DefaultNode for type basic', () => {
        const node = { id: '1', type: 'basic', name: 'Test', position: { x: 0, y: 0 } }
        const wrapper = mount(NodeBody, { propsData: { node } })
        expect(wrapper.findComponent(DefaultNode).exists()).toBe(true)
    })

    test('renders InputNode for type input', () => {
        const node = { id: '1', type: 'input', name: 'Test', position: { x: 0, y: 0 } }
        const wrapper = mount(NodeBody, { propsData: { node } })
        expect(wrapper.findComponent(InputNode).exists()).toBe(true)
    })

    test('renders OutputNode for type output', () => {
        const node = { id: '1', type: 'output', name: 'Test', position: { x: 0, y: 0 } }
        const wrapper = mount(NodeBody, { propsData: { node } })
        expect(wrapper.findComponent(OutputNode).exists()).toBe(true)
    })

    test('falls back to DefaultNode for unknown type', () => {
        const node = { id: '1', type: 'unknown', name: 'Test', position: { x: 0, y: 0 } }
        const wrapper = mount(NodeBody, { propsData: { node } })
        expect(wrapper.findComponent(DefaultNode).exists()).toBe(true)
    })
})

describe('NodeWrapper', () => {
    const node = { id: '1', type: 'basic', name: 'Test', position: { x: 100, y: 50 } }

    test('renders with correct transform', () => {
        const wrapper = mount(NodeWrapper, { propsData: { node } })
        expect(wrapper.attributes('style')).toContain('translate(100px, 50px)')
    })

    test('applies selected class', () => {
        const wrapper = mount(NodeWrapper, { propsData: { node, selected: true } })
        expect(wrapper.classes()).toContain('vue-flow__node--selected')
    })

    test('does not render when hidden', () => {
        const hiddenNode = { ...node, hidden: true }
        const wrapper = mount(NodeWrapper, { propsData: { node: hiddenNode } })
        expect(wrapper.html()).toBe('')
    })

    test('applies custom class', () => {
        const styledNode = { ...node, class: 'my-class' }
        const wrapper = mount(NodeWrapper, { propsData: { node: styledNode } })
        expect(wrapper.classes()).toContain('my-class')
    })

    test('applies custom style', () => {
        const styledNode = { ...node, style: { border: '2px solid red' } }
        const wrapper = mount(NodeWrapper, { propsData: { node: styledNode } })
        expect(wrapper.attributes('style')).toContain('border: 2px solid red')
    })

    test('emits node-click on mousedown+mouseup', () => {
        const wrapper = mount(NodeWrapper, { propsData: { node } })
        wrapper.trigger('mousedown', { clientX: 0, clientY: 0 })
        wrapper.trigger('mouseup', { clientX: 0, clientY: 0 })
        expect(wrapper.emitted('node-click')).toBeTruthy()
        expect(wrapper.emitted('node-click')[0][0].node.id).toBe('1')
    })

    test('emits drag-start on mousedown when draggable', () => {
        const wrapper = mount(NodeWrapper, { propsData: { node, draggable: true } })
        wrapper.trigger('mousedown')
        expect(wrapper.emitted('drag-start')).toBeTruthy()
    })

    test('does not emit drag-start when not draggable', () => {
        const wrapper = mount(NodeWrapper, { propsData: { node, draggable: false } })
        wrapper.trigger('mousedown')
        expect(wrapper.emitted('drag-start')).toBeFalsy()
    })

    test('applies zIndex from node', () => {
        const zNode = { ...node, zIndex: 10 }
        const wrapper = mount(NodeWrapper, { propsData: { node: zNode } })
        expect(wrapper.attributes('style')).toContain('z-index: 10')
    })
})
