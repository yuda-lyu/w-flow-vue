import { mount } from '@vue/test-utils'
import ViewportTransform from '../src/components/canvas/ViewportTransform.vue'
import SelectionBox from '../src/components/canvas/SelectionBox.vue'
import BackgroundLayer from '../src/components/canvas/BackgroundLayer.vue'
import FlowCanvas from '../src/components/canvas/FlowCanvas.vue'

describe('ViewportTransform', () => {
    test('applies transform style', () => {
        const wrapper = mount(ViewportTransform, {
            //ViewportTransform 已改收單一 viewport 物件(取代 x/y/zoom 三個純量),
            //目的為令宿主 render 僅讀取穩定物件參考; 斷言意圖(transform 樣式)不變
            propsData: { viewport: { x: 100, y: 50, zoom: 1.5 } },
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
            //SelectionBox 已改收穩定容器 state(細粒度渲染: 拉框每步僅本元件重渲染); 斷言意圖(定位樣式)不變
            propsData: { state: { box: { x: 10, y: 20, width: 100, height: 50 } } },
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
            propsData: { state: { box: null } },
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
    //D7: pattern id 由宿主給定, 每實例唯一; D8: bgColor 有值才繪底色 rect
    test('pattern id 依 prop; 兩實例不同名', () => {
        const a = mount(BackgroundLayer, { propsData: { patternId: 'vf-bg-a' } })
        const b = mount(BackgroundLayer, { propsData: { patternId: 'vf-bg-b' } })
        expect(a.find('pattern').attributes('id')).toBe('vf-bg-a')
        expect(b.find('pattern').attributes('id')).toBe('vf-bg-b')
        expect(a.find('rect[fill^="url"]').attributes('fill')).toBe('url(#vf-bg-a)')
    })
    test('bgColor 未設不繪底色; 設定即繪滿版 rect', () => {
        const none = mount(BackgroundLayer, { propsData: { patternId: 'p' } })
        expect(none.findAll('rect').length).toBe(1)
        const w = mount(BackgroundLayer, { propsData: { patternId: 'p', bgColor: '#123456' } })
        const rects = w.findAll('rect')
        expect(rects.length).toBe(2)
        expect(rects.at(0).attributes('fill')).toBe('#123456')
    })
    test('renders svg with pattern', () => {
        const wrapper = mount(BackgroundLayer, { propsData: { patternId: 'p1' } })
        expect(wrapper.find('svg').exists()).toBe(true)
        expect(wrapper.find('pattern').exists()).toBe(true)
    })

    test('renders dots pattern by default', () => {
        const wrapper = mount(BackgroundLayer, {
            propsData: { variant: 'dots', patternId: 'p1' },
        })
        expect(wrapper.find('circle').exists()).toBe(true)
    })

    test('renders lines pattern', () => {
        const wrapper = mount(BackgroundLayer, {
            propsData: { variant: 'lines', patternId: 'p1' },
        })
        expect(wrapper.find('circle').exists()).toBe(false)
        expect(wrapper.find('path').exists()).toBe(true)
    })
})
