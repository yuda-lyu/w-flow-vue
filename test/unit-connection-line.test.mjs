/**
 * 預覽線(ConnectionLine)之方向正規化驗收(spec/流程_互動契約.md §4)。
 *
 * 規格:
 * L1 originType='source': 以 (origin=source, 游標=target) 呼叫路徑函式(既有行為)。
 * L2 originType='target': 以 (游標=source, origin=target) 呼叫——四種線型之預覽 d 皆與「同端點之正規化邊」相同;
 *    只對調端點不對調角色會得到不同形狀(step fallback 先走 source 端水平段; bezier control point 各依其方位)。
 * L3 無 hover 把手時遠端預設方位: source-origin → 'top', target-origin → 'bottom'。
 */
import { mount } from '@vue/test-utils'
import ConnectionLine from '../src/components/edges/ConnectionLine.vue'
import { getBezierPath, getStraightPath, getStepPath, getSmoothStepPath } from '../src/js/edgePath'

const fns = { bezier: getBezierPath, straight: getStraightPath, step: getStepPath, smoothstep: getSmoothStepPath }
const mk = (state, type) => mount(ConnectionLine, { propsData: { state: { active: true, dropStatus: 'none', ...state }, type } })
const d = (w) => w.find('path').attributes('d')

describe('L1/L2 預覽線與正規化邊同向', () => {
    test.each(Object.keys(fns))('%s: target-origin 之 d == 正規化(游標為 source)之 d, 且 != 未正規化', (type) => {
        const fn = fns[type]
        const origin = { x: 300, y: 200, position: 'top' } //target 把手, 在節點頂
        const cursor = { x: 50, y: 40, position: 'bottom' } //hover 到他節點底部之 source 把手
        const w = mk({ originType: 'target', fromX: origin.x, fromY: origin.y, fromPosition: origin.position, toX: cursor.x, toY: cursor.y, toPosition: cursor.position }, type)
        const normalized = fn({ sourceX: cursor.x, sourceY: cursor.y, sourcePosition: cursor.position, targetX: origin.x, targetY: origin.y, targetPosition: origin.position }).path
        const naive = fn({ sourceX: origin.x, sourceY: origin.y, sourcePosition: origin.position, targetX: cursor.x, targetY: cursor.y, targetPosition: cursor.position }).path
        expect(d(w)).toBe(normalized)
        if (type !== 'straight') expect(d(w)).not.toBe(naive) //直線對稱, 其餘線型方向有別
        w.destroy()
    })
    test('source-origin 維持既有行為', () => {
        const w = mk({ originType: 'source', fromX: 50, fromY: 40, fromPosition: 'bottom', toX: 300, toY: 200, toPosition: 'top' }, 'bezier')
        expect(d(w)).toBe(getBezierPath({ sourceX: 50, sourceY: 40, sourcePosition: 'bottom', targetX: 300, targetY: 200, targetPosition: 'top' }).path)
        w.destroy()
    })
})

describe('L3 遠端預設方位', () => {
    test('toPosition 為空: source-origin 用 top, target-origin 用 bottom', () => {
        const a = mk({ originType: 'source', fromX: 0, fromY: 0, fromPosition: 'bottom', toX: 100, toY: 100, toPosition: '' }, 'bezier')
        expect(d(a)).toBe(getBezierPath({ sourceX: 0, sourceY: 0, sourcePosition: 'bottom', targetX: 100, targetY: 100, targetPosition: 'top' }).path)
        const b = mk({ originType: 'target', fromX: 100, fromY: 100, fromPosition: 'top', toX: 0, toY: 0, toPosition: '' }, 'bezier')
        expect(d(b)).toBe(getBezierPath({ sourceX: 0, sourceY: 0, sourcePosition: 'bottom', targetX: 100, targetY: 100, targetPosition: 'top' }).path)
        a.destroy(); b.destroy()
    })
})
