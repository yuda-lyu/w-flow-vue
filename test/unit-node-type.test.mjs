/**
 * 節點有效型別之單一來源, 與把手/邊端點同一幾何基準之驗收(spec/流程_互動契約.md §4; anchorPolicy.nodeType)。
 *
 * 規格:
 * N1 有效型別 = node.type → defNode.type(opt.defNodeType) → 'basic'; 渲染(元件/class)、設定表單、same-side、建線 input/output 判定皆用同一解析。
 * N2 缺省 type + 出入同側: 把手(DOM 位置)與邊端點(geometry)皆採 33%/67% 錯開, 兩者同一基準。
 * N3 各形狀(矩形/菱形/橢圓/三角)之把手中心與 geometry.getHandlePosition 一致(same-side 與非 same-side 皆然)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import DefaultNode from '../src/components/nodes/DefaultNode.vue'
import { nodeType, nodeSameSide } from '../src/js/anchorPolicy.mjs'
import { getHandlePosition } from '../src/js/geometry.mjs'
import { assessConnection } from '../src/js/connectPolicy.mjs'

const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })

describe('N1 有效型別單一來源', () => {
    test('nodeType 解析順序', () => {
        expect(nodeType({ type: 'input' }, { type: 'output' })).toBe('input')
        expect(nodeType({}, { type: 'output' })).toBe('output')
        expect(nodeType({}, {})).toBe('basic')
        expect(nodeType(null, null)).toBe('basic')
    })
    test('缺省 type 之節點: 渲染 class、元件、same-side、建線判定皆依 defNodeType', async () => {
        const w = mountFlow({
            defNodeType: 'output',
            nodes: [
                { id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 100, height: 40 }, //缺省 → output
                { id: 'b', type: 'input', name: 'B', position: { x: 300, y: 0 }, width: 100, height: 40 },
            ],
            conns: [],
        })
        await w.vm.$nextTick()
        const a = w.find('.vue-flow__node[data-id="a"]')
        expect(a.classes()).toContain('vue-flow__node-output')
        expect(a.find('.vue-flow__node-output').exists()).toBe(true)
        expect(a.findAll('.vue-flow__handle--source').length).toBe(0)
        expect(a.findAll('.vue-flow__handle--target').length).toBe(1)
        //建線判定: a 為 output 不可作為起點
        const ep = (nodeId, type) => ({ nodeId, type, position: null, connectable: true, handleId: null, element: null })
        const r = assessConnection(ep('a', 'source'), ep('b', 'target'), { nodes: w.vm.nodes, conns: [], defNode: w.vm.defNode })
        expect(r.reason).toBe('from-output')
        w.destroy()
    })
    test('設定表單依有效型別顯示 To/From Handle', async () => {
        const w = mountFlow({
            defNodeType: 'input',
            nodes: [{ id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 100, height: 40 }],
            conns: [],
        })
        await w.vm.$nextTick()
        const nw = w.vm.$refs.nodeRenderer.$refs.wrappers[0]
        nw.settingsPopupShow = true
        await w.vm.$nextTick()
        await w.vm.$nextTick()
        const labels = [...document.querySelectorAll('.vue-flow__settings-form label')].map(l => l.textContent.trim().split('\n')[0].trim())
        expect(labels.some(t => t.startsWith('To Handle'))).toBe(true)
        expect(labels.some(t => t.startsWith('From Handle'))).toBe(false)
        w.destroy()
    })
})

describe('N2 缺省 type 之 same-side 錯開: 把手與邊端點同一基準', () => {
    test('defNode basic, node 無 type, 出入皆 top → sameSide 且 geometry 33%/67%', () => {
        const node = { id: 'x', position: { x: 0, y: 0 }, width: 100, height: 40, toPosition: 'top', fromPosition: 'top' }
        const def = { type: 'basic' }
        expect(nodeSameSide(node, def)).toBe(true)
        expect(getHandlePosition(node, 'top', {}, 'target', def).x).toBe(33)
        expect(getHandlePosition(node, 'top', {}, 'source', def).x).toBe(67)
        const w = mount(DefaultNode, { propsData: { node }, provide: { getDefNode: () => def } })
        expect(w.find('.vue-flow__handle--target').attributes('style')).toContain('left: 33%')
        expect(w.find('.vue-flow__handle--source').attributes('style')).toContain('left: 67%')
        w.destroy()
    })
})

//把手 inline style(百分比 left/top 或 offset)→ 節點內絕對座標; 矩形由 CSS 定位(無 inline 百分比)時依方位推算中心
function handleCenterFromDom(w, type, node) {
    const el = w.find(`.vue-flow__handle--${type}`).element
    const pos = el.dataset.handlePosition
    const st = el.getAttribute('style') || ''
    const pct = (k) => { const m = st.match(new RegExp(`${k}:\\s*([0-9.]+)%`)); return m ? Number(m[1]) : null }
    const l = pct('left'); const t = pct('top')
    const W = node.width; const H = node.height
    if (l !== null && t !== null) return { x: l / 100 * W, y: t / 100 * H }
    //矩形: 位置由 CSS class 決定(頂/底/左/右居中), offset 為 same-side 錯開
    const off = l !== null ? l / 100 : (t !== null ? t / 100 : 0.5)
    if (pos === 'top') return { x: off * W, y: 0 }
    if (pos === 'bottom') return { x: off * W, y: H }
    if (pos === 'left') return { x: 0, y: off * H }
    return { x: W, y: off * H }
}

describe('N3 各形狀之把手中心 == geometry 端點', () => {
    const shapes = ['rectangle', 'diamond', 'ellipse', 'triangle', 'triangle-right', 'triangle-down', 'triangle-left']
    const cases = []
    for (const shape of shapes) {
        for (const [toPosition, fromPosition] of [['bottom', 'top'], ['right', 'left'], ['top', 'top'], ['left', 'left']]) {
            cases.push([shape, toPosition, fromPosition])
        }
    }
    test.each(cases)('%s to=%s from=%s', (shape, toPosition, fromPosition) => {
        const node = { id: 'n', type: 'basic', shape, position: { x: 0, y: 0 }, width: 120, height: 80, toPosition, fromPosition }
        const def = { type: 'basic' }
        const w = mount(DefaultNode, { propsData: { node }, provide: { getDefNode: () => def } })
        for (const type of ['source', 'target']) {
            const side = type === 'source' ? toPosition : fromPosition
            const g = getHandlePosition(node, side, {}, type, def)
            const d = handleCenterFromDom(w, type, node)
            expect(Math.abs(d.x - g.x)).toBeLessThan(0.5)
            expect(Math.abs(d.y - g.y)).toBeLessThan(0.5)
        }
        w.destroy()
    })
})
