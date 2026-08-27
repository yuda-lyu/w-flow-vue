/**
 * 邊元件(EdgeWrapper / EdgeMarkerDefs)之渲染驗收——以新契約之 conn 形狀({ id, from, to, fromPosition, toPosition })
 * 與 sourceNode/targetNode props 掛載(端點座標由元件自 geometry 計算, 不再以 sourceX 等 props 傳入)。
 */
import { mount } from '@vue/test-utils'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'
import EdgeMarkerDefs from '../src/components/edges/EdgeMarkerDefs.vue'
import { getHandlePosition } from '../src/js/geometry.mjs'

const n1 = { id: '1', position: { x: 100, y: 50 }, width: 100, height: 40 }
const n2 = { id: '2', position: { x: 300, y: 250 }, width: 100, height: 40 }
const mk = (conn, extra = {}) => mount(EdgeWrapper, {
    propsData: { conn: { id: 'e1-2', from: '1', to: '2', fromPosition: 'bottom', toPosition: 'top', ...conn }, sourceNode: n1, targetNode: n2, ...extra },
})
const visiblePath = (w) => w.findAll('path').wrappers.find(p => !p.classes().includes('vue-flow__edge-interaction'))

describe('EdgeWrapper', () => {
    test('renders svg group with data-id', () => {
        const w = mk({})
        expect(w.element.tagName.toLowerCase()).toBe('g')
        expect(w.attributes('data-id')).toBe('e1-2')
        w.destroy()
    })

    test('path starts at from-node anchor and ends at to-node anchor(conn 持有方位)', () => {
        const w = mk({ fromPosition: 'right', toPosition: 'left' })
        const d = visiblePath(w).attributes('d')
        const s = getHandlePosition(n1, 'right', {})
        const t = getHandlePosition(n2, 'left', {})
        expect(d.startsWith(`M ${s.x},${s.y}`)).toBe(true)
        expect(d.endsWith(`${t.x},${t.y}`)).toBe(true)
        w.destroy()
    })

    test('applies selected / animated / custom classes', () => {
        const w = mk({ animated: true, class: 'my-edge' }, { selected: true })
        expect(w.classes()).toContain('vue-flow__edge--selected')
        expect(w.classes()).toContain('vue-flow__edge--animated')
        expect(w.classes()).toContain('my-edge')
        w.destroy()
    })

    test('renders name label when provided; not otherwise', () => {
        const a = mk({ name: 'hello' })
        expect(a.find('.vue-flow__edge-label').text()).toContain('hello')
        const b = mk({})
        expect(b.find('.vue-flow__edge-label').exists()).toBe(false)
        a.destroy(); b.destroy()
    })

    test('emits conn-click on click', async () => {
        const w = mk({})
        await w.find('.vue-flow__edge-interaction').trigger('click')
        expect(w.emitted('conn-click')).toBeTruthy()
        w.destroy()
    })

    test('renders different edge types', () => {
        for (const type of ['bezier', 'straight', 'step', 'smoothstep']) {
            const w = mk({ type })
            expect(w.classes()).toContain(`vue-flow__edge-${type}`)
            expect(visiblePath(w).attributes('d')).toMatch(/^M /)
            w.destroy()
        }
    })

    test('marker-start / marker-end urls via edgeMarker', () => {
        const w = mk({ markerStart: 'arrow', markerEnd: 'arrowclosed' })
        const p = visiblePath(w)
        expect(p.attributes('marker-start')).toMatch(/^url\(#vue-flow__mk-/)
        expect(p.attributes('marker-end')).toMatch(/^url\(#vue-flow__mk-/)
        const none = mk({})
        expect(visiblePath(none).attributes('marker-end')).toBeUndefined()
        w.destroy(); none.destroy()
    })
})

describe('EdgeMarkerDefs', () => {
    const mount2 = (conns) => mount(EdgeMarkerDefs, { propsData: { conns } })
    test('renders marker defs for conns with markers', () => {
        const w = mount2([
            { id: 'e1', from: '1', to: '2', markerEnd: 'arrowclosed' },
            { id: 'e2', from: '2', to: '3', markerEnd: 'arrow' },
        ])
        expect(w.findAll('marker').length).toBe(2)
    })
    test('deduplicates same marker spec; both ends counted separately', () => {
        const w = mount2([
            { id: 'e1', from: '1', to: '2', markerEnd: 'arrowclosed' },
            { id: 'e2', from: '2', to: '3', markerEnd: 'arrowclosed', markerStart: 'arrowclosed' },
        ])
        expect(w.findAll('marker').length).toBe(1)
    })
    test('renders no markers when conns have none', () => {
        const w = mount2([{ id: 'e1', from: '1', to: '2' }])
        expect(w.findAll('marker').length).toBe(0)
    })
})
