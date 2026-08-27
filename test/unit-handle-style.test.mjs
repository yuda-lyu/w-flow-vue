/**
 * 連接點(把手)樣式與幾何契約之驗收(WFlowVue.vue 檔頭「Default Handle」節、Handle.vue 檔頭)。
 *
 * 規格:
 * H1 預設: 連出點(source)深底 #555555 白框, 連入點(target)白底 #ffffff 深框 #1a1918; 框線 1px; 外徑 10px(border-box, 與舊版 8px+2px 框線同尺寸)。
 * H2 opt.defHandleSource{FaceColor,EdgeColor,EdgeWidth,Size} / defHandleTarget{...} 八項可改, 經 defNode 注入 Handle 之 CSS 變數。
 * H3 EdgeWidth 允許 0(以 !== undefined 判斷); Size 走 || 回退。
 * H4 定位扣除量 --vf-hb = 節點外框寬: 矩形取 node.edgeWidth → defNode.edgeWidth → 1; SVG 形狀(菱形/橢圓/三角)為 0。
 * H5 把手 click 不冒泡(不得誤開節點資訊 popup)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import Handle from '../src/components/nodes/Handle.vue'
import { NODE_DEFAULTS } from '../src/js/defaults.mjs'
import { nodeBorderWidth, handleStyleVars, isSvgShape } from '../src/js/nodeStyle.mjs'

const mkOpt = (extra = {}) => ({
    nodes: [
        { id: '1', type: 'basic', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', type: 'basic', name: 'N2', position: { x: 300, y: 0 }, width: 100, height: 40, edgeWidth: 3 },
        { id: '3', type: 'basic', name: 'N3', position: { x: 0, y: 200 }, width: 100, height: 40, shape: 'diamond' },
    ],
    conns: [],
    ...extra,
})
const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })
const vars = (el) => {
    const s = el.getAttribute('style') || ''
    const out = {}
    for (const m of s.matchAll(/(--vf-[a-z]+):\s*([^;]+)/g)) out[m[1]] = m[2].trim()
    return out
}

describe('H1 預設樣式(連出深底白框 / 連入白底深框)', () => {
    test('NODE_DEFAULTS 與 Handle 注入之變數', async () => {
        expect(NODE_DEFAULTS.handleSourceFaceColor).toBe('#555555')
        expect(NODE_DEFAULTS.handleSourceEdgeColor).toBe('#ffffff')
        expect(NODE_DEFAULTS.handleTargetFaceColor).toBe('#ffffff')
        expect(NODE_DEFAULTS.handleTargetEdgeColor).toBe('#1a1918')
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        const src = w.find('.vue-flow__node[data-id="1"] .vue-flow__handle--source').element
        const tgt = w.find('.vue-flow__node[data-id="1"] .vue-flow__handle--target').element
        expect(vars(src)).toMatchObject({ '--vf-hs': '10px', '--vf-hface': '#555555', '--vf-hedge': '#ffffff', '--vf-hew': '1px', '--vf-hb': '1px' })
        expect(vars(tgt)).toMatchObject({ '--vf-hs': '10px', '--vf-hface': '#ffffff', '--vf-hedge': '#1a1918', '--vf-hew': '1px', '--vf-hb': '1px' })
        w.destroy()
    })
})

describe('H2/H3 opt 八項可改', () => {
    test('全部覆寫並注入; EdgeWidth=0 合法', async () => {
        const w = mountFlow(mkOpt({
            defHandleSourceFaceColor: '#ff0000', defHandleSourceEdgeColor: '#00ff00', defHandleSourceEdgeWidth: 0, defHandleSourceSize: 12,
            defHandleTargetFaceColor: '#0000ff', defHandleTargetEdgeColor: '#ffff00', defHandleTargetEdgeWidth: 2, defHandleTargetSize: 6,
        }))
        await w.vm.$nextTick()
        const dn = w.vm.defNode
        expect(dn.handleSourceEdgeWidth).toBe(0)
        expect(dn.handleTargetSize).toBe(6)
        const src = w.find('.vue-flow__node[data-id="1"] .vue-flow__handle--source').element
        const tgt = w.find('.vue-flow__node[data-id="1"] .vue-flow__handle--target').element
        expect(vars(src)).toMatchObject({ '--vf-hs': '12px', '--vf-hface': '#ff0000', '--vf-hedge': '#00ff00', '--vf-hew': '0px' })
        expect(vars(tgt)).toMatchObject({ '--vf-hs': '6px', '--vf-hface': '#0000ff', '--vf-hedge': '#ffff00', '--vf-hew': '2px' })
        w.destroy()
    })
})

describe('H4 定位扣除量 = 節點外框寬', () => {
    test('nodeBorderWidth 解析順序與 SVG 形狀為 0', () => {
        expect(nodeBorderWidth({ edgeWidth: 3 }, { edgeWidth: 1 })).toBe(3)
        expect(nodeBorderWidth({}, { edgeWidth: 2 })).toBe(2)
        expect(nodeBorderWidth({}, {})).toBe(1)
        expect(nodeBorderWidth({ shape: 'diamond', edgeWidth: 3 }, {})).toBe(0)
        expect(nodeBorderWidth({ shape: 'ellipse' }, {})).toBe(0)
        expect(nodeBorderWidth({ shape: 'triangle-left' }, {})).toBe(0)
        expect(isSvgShape({ shape: 'rectangle' })).toBe(false)
        expect(handleStyleVars('target', {}, 2)['--vf-hb']).toBe('2px')
    })
    test('把手之 --vf-hb 隨節點 edgeWidth / 形狀', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        expect(vars(w.find('.vue-flow__node[data-id="2"] .vue-flow__handle--source').element)['--vf-hb']).toBe('3px')
        expect(vars(w.find('.vue-flow__node[data-id="3"] .vue-flow__handle--source').element)['--vf-hb']).toBe('0px')
        w.destroy()
    })
})

describe('H5 把手 click 不冒泡', () => {
    test('click 不到達父層', () => {
        const seen = []
        const parent = document.createElement('div')
        parent.addEventListener('click', () => seen.push('parent'))
        document.body.appendChild(parent)
        const w = mount(Handle, { propsData: { type: 'source', position: 'bottom' }, attachTo: parent })
        w.trigger('click')
        expect(seen).toEqual([])
        w.destroy()
        parent.remove()
    })
})
