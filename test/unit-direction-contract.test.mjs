/**
 * 方向契約之補強驗收(Sol 複審 2026-08-27 採納項; spec/流程_互動契約.md §4.1-§4.2, §7):
 * R1 defNodeShape 單一來源: 節點未給 shape 時, 把手佈局、節點面、邊端點皆取 defNode.shape。
 * R2 轉折點路徑仍遵守兩端法線: bezier 首/末控制點沿外向法線; step/smoothstep 兩端先走法線 stub 再轉向。
 * R3 建線預覽(端點無節點矩形)之 step 路徑遵守兩端方位(stub fallback), 不再水平離開/抵達。
 * R4 step 快取 key 含 offset: 同端點不同 offset 不得共用結果。
 * R5 能力旗標: nodesConnectable=false 時節點層 connectable=true 亦不可連(把手 not-connectable, 不啟動建線)。
 * R6 設定更新入口 allowlist: 已移除欄位(type/toPosition/fromPosition)與未知鍵不寫回、不發事件。
 * R7 公開 popup API 回傳 wrapper 之裁決: 手勢中回 false。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'
import { getHandlePosition } from '../src/js/geometry.mjs'
import { nodeShape } from '../src/js/nodeStyle.mjs'
import { getBezierPath, getStepPath, getSmoothStepPath } from '../src/js/edgePath.mjs'
import { calculateStepPoints } from '../src/js/stepRouting.mjs'

const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })
const nodesAB = [
    { id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 100, height: 40 },
    { id: 'b', name: 'B', position: { x: 300, y: 200 }, width: 100, height: 40 },
]

describe('R1 defNodeShape 單一來源', () => {
    test('node 無 shape + defNodeShape=triangle: 把手在斜邊中點、節點面為三角形、邊端點同一 fraction', async () => {
        const w = mountFlow({ defNodeShape: 'triangle', nodes: nodesAB, conns: [{ id: 'e', from: 'a', to: 'b', fromPosition: 'right', toPosition: 'left' }] })
        await w.vm.$nextTick()
        expect(nodeShape({}, w.vm.defNode)).toBe('triangle')
        const h = w.find('.vue-flow__node[data-id="a"] .vue-flow__handle--right').element
        expect(h.getAttribute('style')).toContain('left: 75%')
        expect(w.find('.vue-flow__node[data-id="a"] polygon').exists()).toBe(true)
        expect(w.find('.vue-flow__node[data-id="a"]').classes()).toContain('vue-flow__node--triangle')
        const ew = w.findComponent(EdgeWrapper)
        expect(ew.vm.sourcePoint).toEqual(getHandlePosition(nodesAB[0], 'right', {}, w.vm.defNode))
        expect(ew.vm.sourcePoint).toEqual({ x: 75, y: 20 })
        w.destroy()
    })
    test('非法 shape 視為未給 → defNode → rectangle', () => {
        expect(nodeShape({ shape: 'hexagon' }, { shape: 'ellipse' })).toBe('ellipse')
        expect(nodeShape({ shape: 'hexagon' }, {})).toBe('rectangle')
    })
})

describe('R2 轉折點路徑遵守兩端法線', () => {
    const args = { sourceX: 0, sourceY: 0, sourcePosition: 'top', targetX: 100, targetY: 100, targetPosition: 'bottom', points: [[0, 50]] }
    test('bezier: 首控制點在 source 之法線方向(top → y<0), 末控制點在 target 之法線方向(bottom → y>100)', () => {
        const d = getBezierPath(args).path
        const segs = d.split(' C ').slice(1).map(s => s.split(' ').map(p => p.split(',').map(Number)))
        expect(segs[0][0][1]).toBeLessThan(0)
        const last = segs[segs.length - 1]
        expect(last[1][1]).toBeGreaterThan(100)
    })
    test('step/smoothstep: 第二點為 source 沿法線之 stub(向上), 倒數第二點為 target 沿法線之 stub(向下)', () => {
        const pts = getStepPath({ ...args, offset: 20 }).path.split(' L ').map(s => s.replace('M ', '').split(',').map(Number))
        expect(pts[0]).toEqual([0, 0])
        expect(pts[1]).toEqual([0, -20])
        expect(pts[pts.length - 2]).toEqual([100, 120])
        expect(pts[pts.length - 1]).toEqual([100, 100])
        expect(getSmoothStepPath({ ...args, offset: 20 }).path).toMatch(/^M 0,0 L 0,-/)
    })
})

describe('R3 建線預覽之 step fallback 遵守方位', () => {
    test('無節點矩形: top 出發向上走 stub, bottom 抵達自下方進入', () => {
        const pts = calculateStepPoints(0, 0, 'top', 100, 100, 'bottom', 20, [], {})
        expect(pts[0]).toEqual({ x: 0, y: 0 })
        expect(pts[1]).toEqual({ x: 0, y: -20 })
        expect(pts[pts.length - 2]).toEqual({ x: 100, y: 120 })
        expect(pts[pts.length - 1]).toEqual({ x: 100, y: 100 })
        for (let i = 1; i < pts.length; i++) {
            expect(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y).toBe(true) //正交
        }
    })
    test('right 出發 → left 抵達: 兩 stub 水平, 中段垂直', () => {
        const pts = calculateStepPoints(0, 0, 'right', 200, 100, 'left', 20, [], {})
        expect(pts[1]).toEqual({ x: 20, y: 0 })
        expect(pts[pts.length - 2]).toEqual({ x: 180, y: 100 })
    })
})

describe('R4 step 快取 key 含 offset', () => {
    test('同端點不同 offset 得不同 stub 長度', () => {
        const a = calculateStepPoints(0, 0, 'top', 100, 100, 'bottom', 10, [], {})
        const b = calculateStepPoints(0, 0, 'top', 100, 100, 'bottom', 50, [], {})
        expect(a[1]).toEqual({ x: 0, y: -10 })
        expect(b[1]).toEqual({ x: 0, y: -50 })
    })
})

describe('R5 nodesConnectable=false 為最高優先', () => {
    test('node.connectable=true 亦為 not-connectable, mousedown 不啟動建線', async () => {
        const w = mountFlow({ nodesConnectable: false, nodes: [{ ...nodesAB[0], connectable: true }, nodesAB[1]], conns: [] })
        await w.vm.$nextTick()
        const h = w.find('.vue-flow__node[data-id="a"] .vue-flow__handle--bottom')
        expect(h.classes()).toContain('vue-flow__handle--not-connectable')
        h.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        expect(w.vm.isConnecting).toBe(false)
        w.destroy()
    })
})

describe('R6 設定更新 allowlist', () => {
    test('節點: type / toPosition / fromPosition / 未知鍵一律拒絕(不寫回不發事件); 合法鍵照常', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const w = mountFlow({ nodes: nodesAB, conns: [] })
        await w.vm.$nextTick()
        for (const key of ['type', 'toPosition', 'fromPosition', 'bogus']) {
            w.vm.onNodeSettingsUpdate({ node: { id: 'a' }, key, value: 'x' })
            expect(w.vm.nodes[0][key]).toBeUndefined()
        }
        expect(w.emitted('node-settings-update')).toBeUndefined()
        w.vm.onNodeSettingsUpdate({ node: { id: 'a' }, key: 'shape', value: 'ellipse' })
        expect(w.vm.nodes[0].shape).toBe('ellipse')
        expect(w.emitted('node-settings-update')).toHaveLength(1)
        expect(warn).toHaveBeenCalledTimes(4)
        warn.mockRestore()
        w.destroy()
    })
    test('連線: 未知鍵拒絕; fromPosition/marker* 照常', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const w = mountFlow({ nodes: nodesAB, conns: [{ id: 'e', from: 'a', to: 'b' }] })
        await w.vm.$nextTick()
        w.vm.onConnSettingsUpdate({ conn: { id: 'e' }, key: 'bogus', value: 1 })
        expect(w.vm.conns[0].bogus).toBeUndefined()
        expect(w.emitted('conn-settings-update')).toBeUndefined()
        w.vm.onConnSettingsUpdate({ conn: { id: 'e' }, key: 'fromPosition', value: 'left' })
        w.vm.onConnSettingsUpdate({ conn: { id: 'e' }, key: 'markerEndSize', value: 14 })
        expect(w.vm.conns[0]).toMatchObject({ fromPosition: 'left', markerEndSize: 14 })
        expect(w.emitted('conn-settings-update')).toHaveLength(2)
        warn.mockRestore()
        w.destroy()
    })
})

describe('R7 公開 popup API 回傳裁決', () => {
    test('建線手勢中 openNodeInfoPopup / openConnInfoPopup 回 false; 結束後回 true', async () => {
        const w = mountFlow({ nodes: nodesAB, conns: [{ id: 'e', from: 'a', to: 'b', name: 'E' }] })
        await w.vm.$nextTick()
        w.find('.vue-flow__node[data-id="a"] .vue-flow__handle--bottom').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        expect(w.vm.isConnecting).toBe(true)
        expect(w.vm.openNodeInfoPopup('b')).toBe(false)
        expect(w.vm.openConnInfoPopup('e')).toBe(false)
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        await w.vm.$nextTick()
        expect(w.vm.openNodeInfoPopup('b')).toBe(true)
        expect(w.vm.openNodeInfoPopup('ghost')).toBe(false)
        w.destroy()
    })
})
