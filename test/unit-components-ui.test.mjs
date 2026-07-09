import { mount } from '@vue/test-utils'
import Controls from '../src/components/ui/Controls.vue'

describe('Controls', () => {
    test('renders all buttons by default', () => {
        const wrapper = mount(Controls)
        const buttons = wrapper.findAll('button')
        expect(buttons).toHaveLength(4) // zoom in, zoom out, fit view, lock
    })

    test('hides zoom buttons when showZoom=false', () => {
        const wrapper = mount(Controls, { propsData: { showZoom: false } })
        const buttons = wrapper.findAll('button')
        expect(buttons).toHaveLength(2) // fit view, lock
    })

    test('hides fit view button when showFitView=false', () => {
        const wrapper = mount(Controls, { propsData: { showFitView: false } })
        const buttons = wrapper.findAll('button')
        expect(buttons).toHaveLength(3) // zoom in, zoom out, lock
    })

    test('hides interactive button when showInteractive=false', () => {
        const wrapper = mount(Controls, { propsData: { showInteractive: false } })
        const buttons = wrapper.findAll('button')
        expect(buttons).toHaveLength(3) // zoom in, zoom out, fit view
    })

    test('emits zoom-in on click', () => {
        const wrapper = mount(Controls)
        const buttons = wrapper.findAll('button')
        buttons.at(0).trigger('click') // first button is zoom in
        expect(wrapper.emitted('zoom-in')).toBeTruthy()
    })

    test('emits zoom-out on click', () => {
        const wrapper = mount(Controls)
        const buttons = wrapper.findAll('button')
        buttons.at(1).trigger('click')
        expect(wrapper.emitted('zoom-out')).toBeTruthy()
    })

    test('emits fit-view on click', () => {
        const wrapper = mount(Controls)
        const buttons = wrapper.findAll('button')
        buttons.at(2).trigger('click')
        expect(wrapper.emitted('fit-view')).toBeTruthy()
    })

    test('emits toggle-interactive on click', () => {
        const wrapper = mount(Controls)
        const buttons = wrapper.findAll('button')
        buttons.at(3).trigger('click')
        expect(wrapper.emitted('toggle-interactive')).toBeTruthy()
    })

    test('applies position class', () => {
        const wrapper = mount(Controls, { propsData: { position: 'bottom-right' } })
        expect(wrapper.classes()).toContain('vue-flow__panel--bottom-right')
    })

    test('renders slot content', () => {
        const wrapper = mount(Controls, {
            slots: { default: '<button class="custom-btn">Custom</button>' },
        })
        expect(wrapper.find('.custom-btn').exists()).toBe(true)
    })
})

