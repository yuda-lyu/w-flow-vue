/**
 * 預覽線(ConnectionLine)驗收(spec/流程_互動契約.md §4)。
 *
 * 規格:
 * L1 出發把手即邊之 from 端: state.from* 為 source 參數, state.to* 為 target 參數, 四種線型之 d 與最終邊(同端點/同方位)相同。
 * L2 落點方位跟隨 state.toPosition(由 WFlowVue 依 hover 把手或出發邊之對邊給定), 元件不自行推算。
 * L3 dropStatus → class(valid/invalid); lineStyle 為 inline 最高優先。
 */
import { mount } from '@vue/test-utils'
import ConnectionLine from '../src/components/edges/ConnectionLine.vue'
import { getBezierPath, getStraightPath, getStepPath, getSmoothStepPath } from '../src/js/edgePath'

const fns = { bezier: getBezierPath, straight: getStraightPath, step: getStepPath, smoothstep: getSmoothStepPath }
const mk = (state, type, extra = {}) => mount(ConnectionLine, { propsData: { state: { active: true, dropStatus: 'none', ...state }, type, ...extra } })
const d = (w) => w.find('path').attributes('d')

describe('L1 預覽線與最終邊同向', () => {
    test.each(Object.keys(fns))('%s: from=source, to=target', (type) => {
        const fn = fns[type]
        const from = { x: 50, y: 40, position: 'right' }
        const to = { x: 300, y: 200, position: 'left' }
        const w = mk({ fromX: from.x, fromY: from.y, fromPosition: from.position, toX: to.x, toY: to.y, toPosition: to.position }, type)
        expect(d(w)).toBe(fn({ sourceX: from.x, sourceY: from.y, sourcePosition: from.position, targetX: to.x, targetY: to.y, targetPosition: to.position }).path)
        w.destroy()
    })
})

describe('L2 落點方位由 state 決定', () => {
    test('toPosition 不同 → bezier d 不同(元件不自行推算方位)', () => {
        const base = { fromX: 0, fromY: 0, fromPosition: 'bottom', toX: 100, toY: 100 }
        const a = mk({ ...base, toPosition: 'top' }, 'bezier')
        const b = mk({ ...base, toPosition: 'left' }, 'bezier')
        expect(d(a)).not.toBe(d(b))
        expect(d(b)).toBe(getBezierPath({ sourceX: 0, sourceY: 0, sourcePosition: 'bottom', targetX: 100, targetY: 100, targetPosition: 'left' }).path)
        a.destroy(); b.destroy()
    })
})

describe('L3 狀態 class 與 lineStyle', () => {
    test('dropStatus → class; inactive 不渲染; lineStyle inline', () => {
        const s = { fromX: 0, fromY: 0, fromPosition: 'bottom', toX: 10, toY: 10, toPosition: 'top' }
        const v = mk({ ...s, dropStatus: 'valid' }, 'bezier')
        expect(v.find('path').classes()).toContain('vue-flow__connection-path--valid')
        const i = mk({ ...s, dropStatus: 'invalid' }, 'bezier', { lineStyle: { stroke: 'red' } })
        expect(i.find('path').classes()).toContain('vue-flow__connection-path--invalid')
        expect(i.find('path').attributes('style')).toContain('stroke: red')
        const off = mk({ ...s, active: false }, 'bezier')
        expect(off.find('path').exists()).toBe(false)
        v.destroy(); i.destroy(); off.destroy()
    })
})
