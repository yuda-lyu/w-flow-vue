/**
 * 連線屬性之 defConn 繼承與預覽/正式一致性:
 * H1 animated: 邊未設定時繼承 defConn.animated(opt.defConnAnimated); 邊明確 false 覆寫; 表單核取框顯示有效值。
 * H2 step 預覽線之法線 stub(offset)與正式邊同一 defConn.defOffset: 預覽用 opt.defOffset, 放開後路徑不跳動。
 * H3 marker 樣式選項由 edgeMarker.MARKER_TYPES 衍生(單一來源)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import ConnectionLine from '../src/components/edges/ConnectionLine.vue'
import ConnSettingsForm from '../src/components/ui/ConnSettingsForm.vue'
import SettingsSelect from '../src/components/ui/SettingsSelect.vue'
import { getStepPath } from '../src/js/edgePath.mjs'
import { CONN_DEFAULTS } from '../src/js/defaults.mjs'
import { MARKER_TYPES } from '../src/js/edgeMarker.mjs'

const base = (extra = {}) => ({
    nodes: [
        { id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: 'b', name: 'B', position: { x: 300, y: 200 }, width: 100, height: 40 },
        { id: 'c', name: 'C', position: { x: 600, y: 0 }, width: 100, height: 40 },
    ],
    conns: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'c', animated: false },
    ],
    ...extra,
})
const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })
const edgeCls = (w, id) => w.find(`.vue-flow__edge[data-id="${id}"]`).classes()

describe('H1 animated 繼承', () => {
    test('未設定繼承 defConnAnimated=true; 明確 false 覆寫', async () => {
        const w = mountFlow(base({ defConnAnimated: true }))
        await w.vm.$nextTick()
        expect(edgeCls(w, 'e1')).toContain('vue-flow__edge--animated')
        expect(edgeCls(w, 'e2')).not.toContain('vue-flow__edge--animated')
        w.destroy()
    })
    test('defConnAnimated 未設: 兩者皆不 animated', async () => {
        const w = mountFlow(base())
        await w.vm.$nextTick()
        expect(edgeCls(w, 'e1')).not.toContain('vue-flow__edge--animated')
        w.destroy()
    })
    test('表單核取框顯示有效值(繼承 true → checked)', () => {
        const f = mount(ConnSettingsForm, { propsData: { conn: { id: 'e', from: 'a', to: 'b' }, defConn: { animated: true } } })
        expect(f.find('input[type="checkbox"]').element.checked).toBe(true)
        f.destroy()
    })
})

describe('H2 預覽線 offset 與正式一致', () => {
    const ends = { sourceX: 100, sourceY: 20, sourcePosition: 'right', targetX: 300, targetY: 220, targetPosition: 'left' }
    test('純函式預設 offset = CONN_DEFAULTS.defOffset', () => {
        const d = getStepPath({ ...ends, allNodes: [], nodeInternals: {} })
        const e = getStepPath({ ...ends, offset: CONN_DEFAULTS.defOffset, allNodes: [], nodeInternals: {} })
        expect(d.path).toBe(e.path)
        expect(d.path).not.toBe(getStepPath({ ...ends, offset: 60, allNodes: [], nodeInternals: {} }).path)
    })
    test('WFlowVue 以 defConn.defOffset 餵預覽線; 自訂 defOffset 時預覽 stub 隨之', async () => {
        const w = mountFlow(base({ defOffset: 60, defConnCreatingType: 'step' }))
        await w.vm.$nextTick()
        const cl = w.findComponent(ConnectionLine)
        expect(cl.props('offset')).toBe(60)
        expect(w.vm.defConn.defOffset).toBe(60)
        w.destroy()
    })
})

describe('H3 marker 選項單一來源', () => {
    test('下拉選項值 = MARKER_TYPES', () => {
        const f = mount(ConnSettingsForm, { propsData: { conn: { id: 'e', from: 'a', to: 'b' }, defConn: {} } })
        //下拉已改用 SettingsSelect, 選項為 { value, text } 物件陣列; 取含 arrowclosed 的那一組
        const opts = f.findAllComponents(SettingsSelect).wrappers
            .map(s => s.props('items').map(o => o.value))
            .find(vals => vals.includes('arrowclosed'))
        expect(opts).toEqual(MARKER_TYPES)
        f.destroy()
    })
})
