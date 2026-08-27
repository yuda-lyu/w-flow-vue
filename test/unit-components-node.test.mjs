import { mount } from '@vue/test-utils'
import Handle from '../src/components/nodes/Handle.vue'
import NodePorts from '../src/components/nodes/NodePorts.vue'
import NodeBody from '../src/components/nodes/NodeBody.vue'
import NodeWrapper from '../src/components/nodes/NodeWrapper.vue'
import { SIDES } from '../src/js/anchorPolicy.mjs'

describe('Handle', () => {
    //節點無型別, 把手無 source/target 之分(spec §1-§3): 單一種把手, 樣式/行為由 position 決定
    test('renders with correct classes (no source/target distinction)', () => {
        const wrapper = mount(Handle, {
            propsData: { position: 'bottom' },
        })
        expect(wrapper.classes()).toContain('vue-flow__handle')
        expect(wrapper.classes()).toContain('vue-flow__handle--bottom')
        expect(wrapper.classes()).not.toContain('vue-flow__handle--source')
        expect(wrapper.classes()).not.toContain('vue-flow__handle--target')
        expect(wrapper.attributes('data-handle-position')).toBe('bottom')
        expect(wrapper.attributes('data-handle-type')).toBeUndefined()
        expect(wrapper.attributes('data-handle-id')).toBeUndefined()
    })

    test('emits connect-start on mousedown with handlePosition payload', () => {
        const wrapper = mount(Handle, {
            propsData: { position: 'bottom', connectable: true },
        })
        wrapper.trigger('mousedown', { button: 0 })
        expect(wrapper.emitted('connect-start')).toBeTruthy()
        expect(wrapper.emitted('connect-start')[0][0]).toHaveProperty('handlePosition', 'bottom')
    })

    test('does not emit when not connectable', () => {
        const wrapper = mount(Handle, {
            propsData: { position: 'bottom', connectable: false },
        })
        wrapper.trigger('mousedown', { button: 0 })
        expect(wrapper.emitted('connect-start')).toBeFalsy()
    })
})

describe('NodePorts (取代 DefaultNode/InputNode/OutputNode 之把手佈局: 節點無型別, 恆四把手完全對稱)', () => {
    const node = { id: '1', name: 'Test', position: { x: 0, y: 0 } }

    test('has exactly four handles', () => {
        const wrapper = mount(NodePorts, { propsData: { node } })
        const handles = wrapper.findAllComponents(Handle)
        expect(handles).toHaveLength(4)
    })

    test('four handles cover top/right/bottom/left exactly once, no type distinction', () => {
        const wrapper = mount(NodePorts, { propsData: { node } })
        const handles = wrapper.findAllComponents(Handle)
        const positions = handles.wrappers.map(h => h.props('position')).sort()
        expect(positions).toEqual([...SIDES].sort())
    })
})

describe('NodeBody(單一結構: 無型別分支, 恆渲染 NodePorts 四把手)', () => {
    test('renders label', () => {
        const node = { id: '1', name: 'Test', position: { x: 0, y: 0 } }
        const wrapper = mount(NodeBody, { propsData: { node } })
        expect(wrapper.text()).toContain('Test')
    })

    test('renders NodePorts with four handles regardless of node.type field (type no longer read)', () => {
        const node = { id: '1', name: 'Test', position: { x: 0, y: 0 } }
        const wrapper = mount(NodeBody, { propsData: { node } })
        expect(wrapper.findComponent(NodePorts).exists()).toBe(true)
        expect(wrapper.findAllComponents(Handle)).toHaveLength(4)
    })

    test('a stray legacy type field on the node data is ignored (no type-based branching left)', () => {
        const node = { id: '1', type: 'input', name: 'Test', position: { x: 0, y: 0 } }
        const wrapper = mount(NodeBody, { propsData: { node } })
        expect(wrapper.findAllComponents(Handle)).toHaveLength(4)
    })
})

describe('NodeWrapper', () => {
    const node = { id: '1', name: 'Test', position: { x: 100, y: 50 } }

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

    //拖曳延後至跨越2px位移門檻才啟動: mousedown當下只發drag-prepare(供宿主先行選取),
    //drag-start要有實際位移才發, 否則純點擊會走完endDrag→emit update:nodes而使宿主誤判有未儲存變更
    test('emits drag-prepare (not drag-start) on mousedown when draggable', () => {
        const wrapper = mount(NodeWrapper, { propsData: { node, draggable: true } })
        wrapper.trigger('mousedown', { clientX: 0, clientY: 0, button: 0 })
        expect(wrapper.emitted('drag-prepare')).toBeTruthy()
        expect(wrapper.emitted('drag-start')).toBeFalsy()
        wrapper.destroy()
    })

    test('emits drag-start once movement crosses the threshold', async () => {
        const wrapper = mount(NodeWrapper, { propsData: { node, draggable: true } })
        wrapper.trigger('mousedown', { clientX: 0, clientY: 0, button: 0 })
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 0, buttons: 1 }))
        await wrapper.vm.$nextTick()
        expect(wrapper.emitted('drag-start')).toHaveLength(1)
        wrapper.destroy()
    })

    test('does not emit drag-prepare or drag-start when not draggable', () => {
        const wrapper = mount(NodeWrapper, { propsData: { node, draggable: false } })
        wrapper.trigger('mousedown', { clientX: 0, clientY: 0, button: 0 })
        expect(wrapper.emitted('drag-prepare')).toBeFalsy()
        expect(wrapper.emitted('drag-start')).toBeFalsy()
        wrapper.destroy()
    })

    test('does not emit drag-prepare on non-primary button', () => {
        const wrapper = mount(NodeWrapper, { propsData: { node, draggable: true } })
        wrapper.trigger('mousedown', { clientX: 0, clientY: 0, button: 2 })
        expect(wrapper.emitted('drag-prepare')).toBeFalsy()
        wrapper.destroy()
    })

    test('applies zIndex from node', () => {
        const zNode = { ...node, zIndex: 10 }
        const wrapper = mount(NodeWrapper, { propsData: { node: zNode } })
        expect(wrapper.attributes('style')).toContain('z-index: 10')
    })
})
