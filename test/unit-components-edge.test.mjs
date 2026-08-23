import { mount } from '@vue/test-utils'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'
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
        })
        expect(wrapper.element.tagName.toLowerCase()).toBe('g')
    })

    test('renders path with d attribute', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: baseProps,
        })
        const paths = wrapper.findAll('path')
        expect(paths.length).toBeGreaterThanOrEqual(1)
        const visiblePath = paths.wrappers.find(p => !p.classes().includes('vue-flow__edge-interaction'))
        expect(visiblePath.attributes('d')).toMatch(/^M /)
    })

    test('applies selected class', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: { ...baseProps, selected: true },
        })
        expect(wrapper.classes()).toContain('vue-flow__edge--selected')
    })

    test('applies animated class', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: {
                ...baseProps,
                conn: { ...baseProps.conn, animated: true },
            },
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

//EdgeLabel.vue 已併入 EdgeWrapper(以 .vue-flow__edge-label 直接渲染 conn.name),
//故原「連線名稱有被渲染」之斷言改由 EdgeWrapper 驗證
describe('連線名稱標籤', () => {
    //baseProps 定義於 EdgeWrapper 之 describe 內, 此處自備一份
    const props = {
        sourceX: 100, sourceY: 50, targetX: 300, targetY: 250,
        sourcePosition: 'bottom', targetPosition: 'top',
    }

    test('conn.name 渲染於 .vue-flow__edge-label', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: { ...props, conn: { id: 'e1', source: '1', target: '2', name: 'hello' } },
        })
        const label = wrapper.find('.vue-flow__edge-label')
        expect(label.exists()).toBe(true)
        expect(label.text()).toContain('hello')
    })

    test('無 conn.name 時不渲染標籤', () => {
        const wrapper = mount(EdgeWrapper, {
            propsData: { ...props, conn: { id: 'e1', source: '1', target: '2' } },
        })
        expect(wrapper.find('.vue-flow__edge-label').exists()).toBe(false)
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
