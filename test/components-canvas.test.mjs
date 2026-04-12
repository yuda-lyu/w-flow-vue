import { mount } from '@vue/test-utils'
import ViewportTransform from '../src/components/canvas/ViewportTransform.vue'
import SelectionBox from '../src/components/canvas/SelectionBox.vue'
import BackgroundLayer from '../src/components/canvas/BackgroundLayer.vue'
import FlowCanvas from '../src/components/canvas/FlowCanvas.vue'

describe('ViewportTransform', () => {
    test('applies transform style', () => {
        const wrapper = mount(ViewportTransform, {
            propsData: { x: 100, y: 50, zoom: 1.5 },
            slots: { default: '<div class="child">content</div>' },
        })
        expect(wrapper.attributes('style')).toContain('translate(100px, 50px) scale(1.5)')
    })

    test('default values produce identity transform', () => {
        const wrapper = mount(ViewportTransform, {
            slots: { default: '<div>content</div>' },
        })
        expect(wrapper.attributes('style')).toContain('translate(0px, 0px) scale(1)')
    })

    test('renders slot content', () => {
        const wrapper = mount(ViewportTransform, {
            slots: { default: '<div class="child">hello</div>' },
        })
        expect(wrapper.find('.child').text()).toBe('hello')
    })
})

describe('SelectionBox', () => {
    test('renders when box is provided', () => {
        const wrapper = mount(SelectionBox, {
            propsData: { box: { x: 10, y: 20, width: 100, height: 50 } },
        })
        const el = wrapper.find('.vue-flow__selection-box')
        expect(el.exists()).toBe(true)
        expect(el.attributes('style')).toContain('left: 10px')
        expect(el.attributes('style')).toContain('top: 20px')
        expect(el.attributes('style')).toContain('width: 100px')
        expect(el.attributes('style')).toContain('height: 50px')
    })

    test('does not render when box is null', () => {
        const wrapper = mount(SelectionBox, {
            propsData: { box: null },
        })
        expect(wrapper.find('.vue-flow__selection-box').exists()).toBe(false)
    })
})

describe('FlowCanvas', () => {
    test('renders container with vue-flow class', () => {
        const wrapper = mount(FlowCanvas, {
            slots: { default: '<div>child</div>' },
        })
        expect(wrapper.classes()).toContain('vue-flow')
    })

    test('emits canvas-click on mousedown+mouseup', () => {
        const wrapper = mount(FlowCanvas)
        wrapper.trigger('mousedown', { clientX: 0, clientY: 0 })
        wrapper.trigger('mouseup', { clientX: 0, clientY: 0 })
        expect(wrapper.emitted('canvas-click')).toBeTruthy()
    })

    test('emits canvas-mousedown', () => {
        const wrapper = mount(FlowCanvas)
        wrapper.trigger('mousedown', { clientX: 0, clientY: 0 })
        expect(wrapper.emitted('canvas-mousedown')).toBeTruthy()
    })

    test('renders slot content', () => {
        const wrapper = mount(FlowCanvas, {
            slots: { default: '<div class="test-child">hello</div>' },
        })
        expect(wrapper.find('.test-child').text()).toBe('hello')
    })
})

describe('BackgroundLayer', () => {
    test('renders svg with pattern', () => {
        const wrapper = mount(BackgroundLayer)
        expect(wrapper.find('svg').exists()).toBe(true)
        expect(wrapper.find('pattern').exists()).toBe(true)
    })

    test('renders dots pattern by default', () => {
        const wrapper = mount(BackgroundLayer, {
            propsData: { variant: 'dots' },
        })
        expect(wrapper.find('circle').exists()).toBe(true)
    })

    test('renders lines pattern', () => {
        const wrapper = mount(BackgroundLayer, {
            propsData: { variant: 'lines' },
        })
        expect(wrapper.find('circle').exists()).toBe(false)
        expect(wrapper.find('path').exists()).toBe(true)
    })
})
