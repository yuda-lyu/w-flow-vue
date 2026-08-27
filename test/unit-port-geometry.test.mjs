/**
 * 連接點幾何之單一來源驗收(spec/流程_互動契約.md §4.1; geometry.sideAnchorFraction)。
 *
 * 規格:
 * Q1 形狀 × 邊 之 fraction 表(規劃 §5.1): 矩形/菱形/橢圓四邊中點; 上下向三角形左右為 (0.25,0.5)/(0.75,0.5); 左右向三角形上下為 (0.5,0.25)/(0.5,0.75)。
 * Q2 7 形狀 × 4 邊 = 28 格: NodePorts 渲染之把手圓心(inline style)== geometry.getHandlePosition 端點(含節點外框外推)。
 * Q3 尺寸變更(nodeInternals / node.width)後端點隨外接矩形重算。
 */
import { mount } from '@vue/test-utils'
import NodePorts from '../src/components/nodes/NodePorts.vue'
import { sideAnchorFraction, getHandlePosition } from '../src/js/geometry.mjs'
import { handlePlacementStyle } from '../src/js/nodeStyle.mjs'

const SHAPES = ['rectangle', 'diamond', 'ellipse', 'triangle', 'triangle-right', 'triangle-down', 'triangle-left']
const SIDES = ['top', 'right', 'bottom', 'left']

describe('Q1 fraction 表', () => {
    const rect = { top: [0.5, 0], right: [1, 0.5], bottom: [0.5, 1], left: [0, 0.5] }
    test.each(['rectangle', 'diamond', 'ellipse', undefined])('%s: 四邊中點', (shape) => {
        for (const s of SIDES) {
            const f = sideAnchorFraction(shape, s)
            expect([f.fx, f.fy]).toEqual(rect[s])
        }
    })
    test.each(['triangle', 'triangle-down'])('%s: 左右斜邊中點於 1/4、3/4', (shape) => {
        expect(sideAnchorFraction(shape, 'left')).toEqual({ fx: 0.25, fy: 0.5 })
        expect(sideAnchorFraction(shape, 'right')).toEqual({ fx: 0.75, fy: 0.5 })
        expect(sideAnchorFraction(shape, 'top')).toEqual({ fx: 0.5, fy: 0 })
        expect(sideAnchorFraction(shape, 'bottom')).toEqual({ fx: 0.5, fy: 1 })
    })
    test.each(['triangle-right', 'triangle-left'])('%s: 上下斜邊中點於 1/4、3/4', (shape) => {
        expect(sideAnchorFraction(shape, 'top')).toEqual({ fx: 0.5, fy: 0.25 })
        expect(sideAnchorFraction(shape, 'bottom')).toEqual({ fx: 0.5, fy: 0.75 })
        expect(sideAnchorFraction(shape, 'left')).toEqual({ fx: 0, fy: 0.5 })
        expect(sideAnchorFraction(shape, 'right')).toEqual({ fx: 1, fy: 0.5 })
    })
    test('非法邊回 bottom', () => {
        expect(sideAnchorFraction('rectangle', 'x')).toEqual({ fx: 0.5, fy: 1 })
    })
})

//把手 inline style(left/top 為 `N%` 或 `calc(N% + Bpx)`)→ 節點內絕對座標(外框盒基準: 先減外框寬回到 padding box, 再加外框外推)
function centerFromStyle(el, W, H, border) {
    const st = el.getAttribute('style') || ''
    const axis = (k) => {
        const m = st.match(new RegExp(`${k}:\\s*(?:calc\\()?([0-9.]+)%(?:\\s*\\+\\s*(-?[0-9.]+)px\\))?`))
        return { pct: Number(m[1]), shift: m[2] ? Number(m[2]) : 0 }
    }
    const l = axis('left')
    const t = axis('top')
    //padding box 內之百分比 + 外推; 外框盒座標 = border + padding box 座標
    return { x: border + (W - 2 * border) * l.pct / 100 + l.shift, y: border + (H - 2 * border) * t.pct / 100 + t.shift }
}

describe('Q2 28 格: 把手圓心 == geometry 端點', () => {
    const cases = []
    for (const shape of SHAPES) for (const side of SIDES) cases.push([shape, side])
    test.each(cases)('%s / %s', (shape, side) => {
        const edgeWidth = 2
        const node = { id: 'n', shape, position: { x: 10, y: 20 }, width: 120, height: 80, edgeWidth }
        const isSvg = shape !== 'rectangle'
        const border = isSvg ? 0 : edgeWidth
        const w = mount(NodePorts, { propsData: { node }, provide: { getDefNode: () => ({}) } })
        const el = w.find(`.vue-flow__handle[data-handle-position="${side}"]`).element
        //Q2 之座標系: 節點外框盒左上為原點; geometry 以 node.position 為外框盒左上
        const g = getHandlePosition(node, side, {})
        const c = centerFromStyle(el, node.width, node.height, border)
        expect(Math.abs(c.x - (g.x - node.position.x))).toBeLessThan(0.01)
        expect(Math.abs(c.y - (g.y - node.position.y))).toBeLessThan(0.01)
        //nodeStyle 與 Handle 同一函式
        expect(el.getAttribute('style')).toContain(handlePlacementStyle(shape, side, border).left)
        w.destroy()
    })
})

describe('Q3 尺寸變更', () => {
    test('nodeInternals 優先於 node.width/height; 端點隨外接矩形', () => {
        const node = { id: 'n', shape: 'triangle', position: { x: 0, y: 0 }, width: 100, height: 40 }
        expect(getHandlePosition(node, 'right', {})).toEqual({ x: 75, y: 20 })
        expect(getHandlePosition(node, 'right', { width: 200, height: 80 })).toEqual({ x: 150, y: 40 })
        expect(getHandlePosition({ ...node, width: 40, height: 40 }, 'left', {})).toEqual({ x: 10, y: 20 })
    })
})
