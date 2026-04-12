import { mount } from '@vue/test-utils'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'
import EdgeLabel from '../src/components/edges/EdgeLabel.vue'
import EdgeMarkerDefs from '../src/components/edges/EdgeMarkerDefs.vue'

describe('EdgeWrapper', () => {
    const baseProps = {
        conn: { id: 'e1-2', source: '1', target: '2', type: 'default' },
        sourceX: 100,
        sourceY: 50,
        targetX: 300,
        targetY: 250,
        sourcePosition: 'bottom',
        targetPosition: 'top',
    }

    test('renders svg group', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: baseProps,
            stubs: { EdgeLabel: true },
        })
        expect(wrapper.element.tagName.toLowerCase()).toBe('g')
    })

    test('renders path with d attribute', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: baseProps,
            stubs: { EdgeLabel: true },
        })
        const paths = wrapper.findAll('path')
        expect(paths.length).toBeGreaterThanOrEqual(1)
        const visiblePath = paths.wrappers.find(p => !p.classes().includes('vue-flow__edge-interaction'))
        expect(visiblePath.attributes('d')).toMatch(/^M /)
    })

    test('applies selected class', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: { ...baseProps, selected: true },
            stubs: { EdgeLabel: true },
        })
        expect(wrapper.classes()).toContain('vue-flow__edge--selected')
    })

    test('applies animated class', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: {
                ...baseProps,
                conn: { ...baseProps.conn, animated: true },
            },
            stubs: { EdgeLabel: true },
        })
        expect(wrapper.classes()).toContain('vue-flow__edge--animated')
    })

    test('renders name when provided', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: {
                ...baseProps,
                conn: { ...baseProps.conn, name: 'test label' },
            },
        })
        expect(wrapper.find('.vue-flow__edge-label').exists()).toBe(true)
    })

    test('does not render name when not provided', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: baseProps,
        })
        expect(wrapper.find('.vue-flow__edge-label').exists()).toBe(false)
    })

    test('emits conn-click on click', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: baseProps,
            stubs: { EdgeLabel: true },
        })
        const interactionPath = wrapper.find('.vue-flow__edge-interaction')
        interactionPath.trigger('click')
        expect(wrapper.emitted('conn-click')).toBeTruthy()
        expect(wrapper.emitted('conn-click')[0][0].conn.id).toBe('e1-2')
    })

    test('renders different edge types', () => {
        const types = ['default', 'straight', 'step', 'smoothstep']
        const paths = types.map(type => {
            const wrapper = mount(EdgeWrapper, {
                propsData: {
                    ...baseProps,
                    conn: { ...baseProps.conn, type },
                },
                stubs: { EdgeLabel: true },
            })
            const visiblePath = wrapper.findAll('path').wrappers.find(
                p => !p.classes().includes('vue-flow__edge-interaction')
            )
            return visiblePath.attributes('d')
        })
        // straight should differ from bezier
        expect(paths[0]).not.toBe(paths[1])
    })
})

describe('EdgeLabel', () => {
    test('renders name text', () => {
        const wrapper = mount(EdgeLabel, {
            propsData: { name: 'hello', x: 100, y: 50 },
        })
        expect(wrapper.text()).toContain('hello')
    })
})

describe('EdgeMarkerDefs', () => {
    test('renders marker defs for conns with markers', () => {
        const conns = [
            { id: 'e1', source: '1', target: '2', markerEnd: 'arrowclosed' },
            { id: 'e2', source: '2', target: '3', markerEnd: 'arrow' },
        ]
        const wrapper = mount(EdgeMarkerDefs, {
            propsData: { conns },
        })
        const markers = wrapper.findAll('marker')
        expect(markers.length).toBe(2)
    })

    test('deduplicates same marker type', () => {
        const conns = [
            { id: 'e1', source: '1', target: '2', markerEnd: 'arrowclosed' },
            { id: 'e2', source: '2', target: '3', markerEnd: 'arrowclosed' },
        ]
        const wrapper = mount(EdgeMarkerDefs, {
            propsData: { conns },
        })
        const markers = wrapper.findAll('marker')
        expect(markers.length).toBe(1)
    })

    test('renders no markers when conns have none', () => {
        const conns = [
            { id: 'e1', source: '1', target: '2' },
        ]
        const wrapper = mount(EdgeMarkerDefs, {
            propsData: { conns },
        })
        const markers = wrapper.findAll('marker')
        expect(markers.length).toBe(0)
    })
})
