/**
 * 連接點(把手)樣式與幾何契約之驗收(WFlowVue.vue 檔頭「Default Handle」節、Handle.vue 檔頭)。
 *
 * 規格:
 * H1 預設(四把手同一組): 面色 #555555、框線 #ffffff 1px、外徑 10px(border-box)。
 * H2 opt.defHandle{FaceColor,EdgeColor,EdgeWidth,Size} 四項可改, 經 defNode 注入 Handle 之 CSS 變數; 舊 Source/Target 八項不存在。
 * H3 EdgeWidth 允許 0(以 !== undefined 判斷); Size 走 || 回退。
 * H4 定位外推量 = 節點外框寬: 矩形取 node.edgeWidth → defNode.edgeWidth → 1; SVG 形狀(菱形/橢圓/三角)為 0; 外框盒邊上之把手 inline style 帶 calc 外推。
 * H5 把手 click 不冒泡(不得誤開節點資訊 popup)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import Handle from '../src/components/nodes/Handle.vue'
import { NODE_DEFAULTS } from '../src/js/defaults.mjs'
import { nodeBorderWidth, handleStyleVars, handlePlacementStyle, isSvgShape } from '../src/js/nodeStyle.mjs'

const mkOpt = (extra = {}) => ({
    nodes: [
        { id: '1', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', name: 'N2', position: { x: 300, y: 0 }, width: 100, height: 40, edgeWidth: 3 },
        { id: '3', name: 'N3', position: { x: 0, y: 200 }, width: 100, height: 40, shape: 'diamond' },
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
const handle = (w, id, side) => w.find(`.vue-flow__node[data-id="${id}"] .vue-flow__handle--${side}`).element

describe('H1 預設樣式', () => {
    test('NODE_DEFAULTS 與四把手注入之變數相同', async () => {
        expect(NODE_DEFAULTS.handleFaceColor).toBe('#555555')
        expect(NODE_DEFAULTS.handleEdgeColor).toBe('#ffffff')
        expect(NODE_DEFAULTS.handleEdgeWidth).toBe(1)
        expect(NODE_DEFAULTS.handleSize).toBe(10)
        expect(NODE_DEFAULTS.handleSourceFaceColor).toBeUndefined()
        expect(NODE_DEFAULTS.handleTargetFaceColor).toBeUndefined()
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        for (const side of ['top', 'right', 'bottom', 'left']) {
            expect(vars(handle(w, '1', side))).toMatchObject({ '--vf-hs': '10px', '--vf-hface': '#555555', '--vf-hedge': '#ffffff', '--vf-hew': '1px' })
        }
        w.destroy()
    })
})

describe('H2/H3 opt 四項可改', () => {
    test('全部覆寫並注入; EdgeWidth=0 合法; 舊 Source/Target opt 無作用', async () => {
        const w = mountFlow(mkOpt({
            defHandleFaceColor: '#ff0000',
            defHandleEdgeColor: '#00ff00',
            defHandleEdgeWidth: 0,
            defHandleSize: 12,
            defHandleSourceFaceColor: '#123456',
            defHandleTargetSize: 6,
        }))
        await w.vm.$nextTick()
        const dn = w.vm.defNode
        expect(dn.handleEdgeWidth).toBe(0)
        expect(dn.handleSize).toBe(12)
        expect(dn.handleSourceFaceColor).toBeUndefined()
        expect(dn.handleTargetSize).toBeUndefined()
        for (const side of ['top', 'right', 'bottom', 'left']) {
            expect(vars(handle(w, '1', side))).toMatchObject({ '--vf-hs': '12px', '--vf-hface': '#ff0000', '--vf-hedge': '#00ff00', '--vf-hew': '0px' })
        }
        w.destroy()
    })
})

describe('H4 定位外推量 = 節點外框寬', () => {
    test('nodeBorderWidth 解析順序與 SVG 形狀為 0', () => {
        expect(nodeBorderWidth({ edgeWidth: 3 }, { edgeWidth: 1 })).toBe(3)
        expect(nodeBorderWidth({}, { edgeWidth: 2 })).toBe(2)
        expect(nodeBorderWidth({}, {})).toBe(1)
        expect(nodeBorderWidth({ shape: 'diamond', edgeWidth: 3 }, {})).toBe(0)
        expect(nodeBorderWidth({ shape: 'ellipse' }, {})).toBe(0)
        expect(nodeBorderWidth({ shape: 'triangle-left' }, {})).toBe(0)
        expect(isSvgShape({ shape: 'rectangle' })).toBe(false)
        expect(handleStyleVars({ handleSize: 8 })['--vf-hs']).toBe('8px')
    })
    test('handlePlacementStyle: 外框盒邊上者外推 border, 內部點(三角斜邊)不外推', () => {
        expect(handlePlacementStyle('rectangle', 'top', 3)).toEqual({ left: '50%', top: 'calc(0% + -3px)', transform: 'translate(-50%, -50%)' })
        expect(handlePlacementStyle('rectangle', 'right', 3)).toEqual({ left: 'calc(100% + 3px)', top: '50%', transform: 'translate(-50%, -50%)' })
        expect(handlePlacementStyle('triangle-up', 'left', 0)).toEqual({ left: '25%', top: '50%', transform: 'translate(-50%, -50%)' })
        expect(handlePlacementStyle('triangle-right', 'bottom', 0)).toEqual({ left: '50%', top: '75%', transform: 'translate(-50%, -50%)' })
    })
    test('把手之外推隨節點 edgeWidth / 形狀', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        expect(handle(w, '2', 'top').getAttribute('style')).toContain('top: calc(0% + -3px)')
        expect(handle(w, '1', 'top').getAttribute('style')).toContain('top: calc(0% + -1px)')
        expect(handle(w, '3', 'top').getAttribute('style')).toContain('top: 0%')
        w.destroy()
    })
})

describe('H5 把手 click 不冒泡', () => {
    test('click 不到達父層', () => {
        const seen = []
        const parent = document.createElement('div')
        parent.addEventListener('click', () => seen.push('parent'))
        document.body.appendChild(parent)
        const w = mount(Handle, { propsData: { position: 'bottom' }, attachTo: parent })
        w.trigger('click')
        expect(seen).toEqual([])
        w.destroy()
        parent.remove()
    })
})
