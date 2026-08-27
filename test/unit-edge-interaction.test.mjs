/**
 * 連線互動契約之驗收(EdgeWrapper.vue <g> 註解)。
 *
 * 規格:
 * E1 click/dblclick/contextmenu 統一於 <g> 處理: 線本體、hover rect、label span 皆發 conn-click / conn-double-click / conn-context-menu。
 * E2 齒輪錨區與轉折點之點擊類事件不視為點線(不發 conn-click, 不開資訊 popup)。
 * E3 hover 視覺以 class 驅動: hovered → vue-flow__edge--hovered; 齒輪 hover → vue-flow__edge-settings--hover; 離開 <g> 時齒輪 hover 一併清除。
 * E4 <g> 之 click 不冒泡至外層(維持舊 interaction path .stop 語義)。
 */
import { mount } from '@vue/test-utils'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'

const mk = (extra = {}) => mount(EdgeWrapper, {
    propsData: {
        conn: { id: 'e1', from: '1', to: '2', name: 'L', points: [[50, 50]] },
        sourceNode: { id: '1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        targetNode: { id: '2', position: { x: 200, y: 200 }, width: 100, height: 40 },
        ...extra,
    },
    attachTo: document.body,
})

describe('E1 三種點擊類事件於線本體 / rect / label 皆發出', () => {
    test.each([
        ['interaction path', '.vue-flow__edge-interaction'],
        ['hover rect', 'rect'],
        ['label span', '.vue-flow__edge-label'],
    ])('%s', async (_l, sel) => {
        const w = mk()
        const el = w.find(sel)
        expect(el.exists()).toBe(true)
        el.trigger('click')
        el.trigger('dblclick')
        el.trigger('contextmenu')
        expect(w.emitted('conn-click')).toHaveLength(1)
        expect(w.emitted('conn-double-click')).toHaveLength(1)
        expect(w.emitted('conn-context-menu')).toHaveLength(1)
        //有 name → 點擊開資訊 popup
        expect(w.vm.infoPopupShow).toBe(true)
        w.destroy()
    })
})

describe('E2 齒輪錨區與轉折點不視為點線', () => {
    test('齒輪錨區 click 不發 conn-click 不開資訊 popup', async () => {
        const w = mk()
        w.vm.hovered = true
        await w.vm.$nextTick()
        const anchor = w.find('.vue-flow__edge-settings-anchor')
        expect(anchor.exists()).toBe(true)
        anchor.trigger('click')
        anchor.trigger('dblclick')
        anchor.trigger('contextmenu')
        expect(w.emitted('conn-click')).toBeFalsy()
        expect(w.emitted('conn-double-click')).toBeFalsy()
        expect(w.emitted('conn-context-menu')).toBeFalsy()
        expect(w.vm.infoPopupShow).toBe(false)
        //齒輪本身之 activate 仍發出
        expect(w.emitted('conn-activate')).toHaveLength(1)
        w.destroy()
    })
    test('轉折點 click 不發 conn-click', () => {
        const w = mk()
        const wp = w.find('.vue-flow__edge-waypoint')
        expect(wp.exists()).toBe(true)
        wp.trigger('click')
        expect(w.emitted('conn-click')).toBeFalsy()
        expect(w.vm.infoPopupShow).toBe(false)
        w.destroy()
    })
    test('click 目標為 <g> 自身(mousedown/mouseup 跨子元素之拖曳)不視為點擊', () => {
        const w = mk()
        w.trigger('click')
        w.trigger('dblclick')
        w.trigger('contextmenu')
        expect(w.emitted('conn-click')).toBeFalsy()
        expect(w.emitted('conn-double-click')).toBeFalsy()
        expect(w.emitted('conn-context-menu')).toBeFalsy()
        expect(w.vm.infoPopupShow).toBe(false)
        w.destroy()
    })
})

describe('E3 hover 視覺以 class 驅動', () => {
    test('g 之 --hovered 與齒輪之 --hover; 離開 g 時齒輪 hover 清除', async () => {
        const w = mk()
        expect(w.classes()).not.toContain('vue-flow__edge--hovered')
        await w.trigger('mouseenter')
        expect(w.classes()).toContain('vue-flow__edge--hovered')
        const gear = w.find('.vue-flow__edge-settings')
        expect(gear.exists()).toBe(true)
        await gear.trigger('mouseenter')
        expect(gear.classes()).toContain('vue-flow__edge-settings--hover')
        await gear.trigger('mouseleave')
        expect(gear.classes()).not.toContain('vue-flow__edge-settings--hover')
        await gear.trigger('mouseenter')
        //離開整條線: hovered 與 gearHovered 一併清除(齒輪隨 v-if 消失前狀態亦不殘留)
        await w.trigger('mouseleave')
        expect(w.classes()).not.toContain('vue-flow__edge--hovered')
        expect(w.vm.gearHovered).toBe(false)
        w.destroy()
    })
})

describe('E4 click 不冒泡至外層', () => {
    test('外層 listener 收不到', () => {
        const seen = []
        const host = document.createElement('div')
        host.addEventListener('click', () => seen.push(1))
        document.body.appendChild(host)
        const w = mount(EdgeWrapper, {
            propsData: {
                conn: { id: 'e1', from: '1', to: '2' },
                sourceNode: { id: '1', position: { x: 0, y: 0 }, width: 100, height: 40 },
                targetNode: { id: '2', position: { x: 200, y: 200 }, width: 100, height: 40 },
            },
            attachTo: host,
        })
        w.find('.vue-flow__edge-interaction').trigger('click')
        expect(seen).toEqual([])
        expect(w.emitted('conn-click')).toHaveLength(1)
        w.destroy()
        host.remove()
    })
})
