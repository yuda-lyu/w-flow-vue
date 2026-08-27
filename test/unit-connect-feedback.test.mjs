/**
 * 建線落點可行性視覺回饋之元件層行為驗收(宿主回報: 不能連的落點不得與能連的同效果)。
 *
 * 規格:
 * F1 出發把手於建線期間帶 data-connect-role="origin"; 根元素帶 .vue-flow--connecting。
 * F2 節點無連出/連入之分, 四把手完全對稱: hover 他節點之任一方位把手皆為合法落點(無 same-kind 限制)。
 * F3 hover 自己節點之其他把手(任一方位, 含出發把手自身) → invalid(自我連線禁止)。
 * F4 hover 合法他節點把手 → valid, 且 connectionVisual.toPosition 跟隨該把手方位(預覽線進入方向)。
 * F5 hover 已有同向邊之節點把手 → invalid(duplicate; 方位不參與判定, 見 connectPolicy)。
 * F6 游標離開把手 → 標記清除, dropStatus 回 'none', toPosition 回出發邊之對邊。
 * F7 validator 呼叫紀律: 僅於 hover 目標變更時呼叫一次(同把手上連續 mousemove 不重複呼叫),
 *    且收到與 commit 完全相同形狀之候選 { from, to, fromPosition, toPosition }。
 * F8 他 flow 實例之把手: 不標記(status 'none'), 於其上放開亦不建線(flow 歸屬檢查)。
 * F9 preview==commit 不變量: hover 判定 valid 之落點放開必建線; invalid 之落點放開必不建線。
 * F10 hover 判定不觸發 Node/EdgeWrapper 重渲染(細粒度鐵律)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeWrapper from '../src/components/nodes/NodeWrapper.vue'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'

const mkOpt = (extra = {}) => ({
    nodes: [
        { id: '1', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', name: 'N2', position: { x: 300, y: 200 }, width: 100, height: 40 },
        { id: '3', name: 'N3', position: { x: 0, y: 200 }, width: 100, height: 40 },
        { id: '4', name: 'N4', position: { x: 300, y: 0 }, width: 100, height: 40 },
    ],
    conns: [],
    ...extra,
})

const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })

const handleEl = (w, nodeId, position) => w.findAll(`.vue-flow__node[data-id="${nodeId}"] .vue-flow__handle[data-handle-position="${position}"]`).at(0).element
//出發一律取 bottom 邊(四把手對稱, 任一邊皆等價; 固定一邊使測試座標/預期方位可預測)
const startConnect = (w, nodeId) => {
    w.findAll(`.vue-flow__node[data-id="${nodeId}"] .vue-flow__handle[data-handle-position="bottom"]`).at(0)
        .trigger('mousedown', { button: 0 })
}
//建線中之拖曳移動: buttons=1(主鍵按住), 游標下元素由 elementFromPoint stub 決定
const moveOver = (el, x = 50, y = 50) => {
    document.elementFromPoint = () => el
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: x, clientY: y }))
}
const dropAt = (el, x = 50, y = 50) => {
    document.elementFromPoint = () => el
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }))
}

afterEach(() => {
    document.elementFromPoint = () => null
})

describe('F1 出發把手與根元素之建線標記', () => {
    test('mousedown 後 origin 標記與根 class 生效, 放開後消失', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        startConnect(w, '1')
        const src = handleEl(w, '1', 'bottom')
        expect(src.getAttribute('data-connect-role')).toBe('origin')
        await w.vm.$nextTick()
        expect(w.vm.$el.classList.contains('vue-flow--connecting')).toBe(true)
        dropAt(null)
        expect(src.hasAttribute('data-connect-role')).toBe(false)
        w.destroy()
    })
})

describe('F2 四把手完全對稱: 他節點任一方位把手皆為合法落點(無 same-kind 限制)', () => {
    test('自節點1之 bottom 出發 hover 他節點3之 bottom(同方位) → valid', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        startConnect(w, '1')
        const otherBottom = handleEl(w, '3', 'bottom')
        moveOver(otherBottom)
        expect(otherBottom.getAttribute('data-connect-status')).toBe('valid')
        expect(w.vm.connectionVisual.dropStatus).toBe('valid')
        dropAt(null)
        w.destroy()
    })
    test('自節點2之 top 出發 hover 他節點3之 top(同方位) → valid; hover 他節點3之 bottom → 亦 valid 且 toPosition 跟隨', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        //自節點2之 top 把手出發(對稱: 任一邊皆可出發, 非固定 bottom)
        handleEl(w, '2', 'top').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
        expect(w.vm.isConnecting).toBe(true)
        const otherTop = handleEl(w, '3', 'top')
        moveOver(otherTop)
        expect(otherTop.getAttribute('data-connect-status')).toBe('valid')
        const otherBottom = handleEl(w, '3', 'bottom')
        moveOver(otherBottom)
        expect(otherBottom.getAttribute('data-connect-status')).toBe('valid')
        expect(w.vm.connectionVisual.toPosition).toBe(otherBottom.dataset.handlePosition)
        //preview==commit: 放開即建 2→3
        dropAt(otherBottom)
        expect(w.vm.conns.length).toBe(1)
        expect(w.vm.conns[0]).toMatchObject({ from: '2', to: '3', fromPosition: 'top', toPosition: 'bottom' })
        w.destroy()
    })
})

describe('F3 自己節點之其他把手為不合法落點(自我連線禁止)', () => {
    test('hover 自己節點之其他方位把手 → invalid', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        startConnect(w, '3')
        const ownOther = handleEl(w, '3', 'top')
        moveOver(ownOther)
        expect(ownOther.getAttribute('data-connect-status')).toBe('invalid')
        expect(w.vm.connectionVisual.dropStatus).toBe('invalid')
        dropAt(null)
        w.destroy()
    })
    test('hover 出發把手自身 → invalid(self)', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        startConnect(w, '3')
        const origin = handleEl(w, '3', 'bottom')
        moveOver(origin)
        expect(origin.getAttribute('data-connect-status')).toBe('invalid')
        dropAt(null)
        w.destroy()
    })
})

describe('F4 合法落點標 valid, 預覽線進入方向跟隨把手方位', () => {
    test('hover 他節點之任一把手 → valid + toPosition', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        startConnect(w, '1')
        const tgt = handleEl(w, '2', 'left')
        moveOver(tgt)
        expect(tgt.getAttribute('data-connect-status')).toBe('valid')
        expect(w.vm.connectionVisual.dropStatus).toBe('valid')
        expect(w.vm.connectionVisual.toPosition).toBe(tgt.dataset.handlePosition)
        dropAt(null)
        w.destroy()
    })
})

describe('F5 同向重複邊之落點為 invalid(方位不參與判定)', () => {
    test('已存在 1→3: hover 節點3之任一把手(不論方位) → invalid', async () => {
        const w = mountFlow(mkOpt({ conns: [{ id: 'e1-3', from: '1', to: '3' }] }))
        await w.vm.$nextTick()
        startConnect(w, '1')
        const tgt = handleEl(w, '3', 'right') //刻意選與既有邊 toPosition 不同之方位, 驗證 duplicate 不看方位
        moveOver(tgt)
        expect(tgt.getAttribute('data-connect-status')).toBe('invalid')
        dropAt(null)
        w.destroy()
    })
})

describe('F6 離開把手後標記清除', () => {
    test('移離後 status 移除, dropStatus 回 none, toPosition 回出發邊之對邊', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        startConnect(w, '1') //出發邊為 bottom
        const tgt = handleEl(w, '2', 'top')
        moveOver(tgt)
        expect(tgt.hasAttribute('data-connect-status')).toBe(true)
        moveOver(null) //游標移到空白處
        expect(tgt.hasAttribute('data-connect-status')).toBe(false)
        expect(w.vm.connectionVisual.dropStatus).toBe('none')
        expect(w.vm.connectionVisual.toPosition).toBe('top') //bottom 之對邊
        dropAt(null)
        w.destroy()
    })
})

describe('F7 validator 呼叫紀律與形狀', () => {
    test('同把手連續移動只呼叫一次; 收到完整候選形狀; drop 再呼叫一次(同形狀)', async () => {
        const seen = []
        const w = mountFlow(mkOpt({ funValidConnCreating: (c) => { seen.push(JSON.parse(JSON.stringify(c))) ; return true } }))
        await w.vm.$nextTick()
        startConnect(w, '1')
        const tgt = handleEl(w, '2', 'top')
        moveOver(tgt, 40, 40)
        moveOver(tgt, 41, 41)
        moveOver(tgt, 42, 42)
        expect(seen).toHaveLength(1) //hover 目標未變: 不逐幀重呼
        dropAt(tgt)
        expect(seen).toHaveLength(2) //commit 再驗一次
        expect(seen[0]).toEqual(seen[1]) //preview 與 commit 同形狀
        expect(seen[0]).toEqual({ from: '1', to: '2', fromPosition: 'bottom', toPosition: 'top' })
        w.destroy()
    })
})

describe('F8 他 flow 實例之把手不參與本 flow 建線', () => {
    test('hover 不標記; 於其上放開不建線(flow 歸屬檢查)', async () => {
        const w1 = mountFlow(mkOpt())
        const w2 = mountFlow(mkOpt())
        await w1.vm.$nextTick()
        await w2.vm.$nextTick()
        startConnect(w1, '1')
        const foreignTgt = handleEl(w2, '3', 'top')
        moveOver(foreignTgt)
        expect(foreignTgt.hasAttribute('data-connect-status')).toBe(false)
        expect(w1.vm.connectionVisual.dropStatus).toBe('none')
        dropAt(foreignTgt)
        expect(w1.vm.conns.length).toBe(0)
        expect(w2.vm.conns.length).toBe(0)
        expect(w1.emitted('connect')).toBeFalsy()
        w1.destroy()
        w2.destroy()
    })
})

describe('F9 preview==commit 不變量', () => {
    test('hover=valid 之落點放開必建線', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.$nextTick()
        startConnect(w, '1')
        const tgt = handleEl(w, '3', 'top')
        moveOver(tgt)
        expect(tgt.getAttribute('data-connect-status')).toBe('valid')
        dropAt(tgt)
        expect(w.vm.conns.length).toBe(1)
        expect(w.vm.conns[0]).toMatchObject({ from: '1', to: '3' })
        w.destroy()
    })
    test('hover=invalid 之落點放開必不建線, connect-end 酬載帶 reason', async () => {
        const w = mountFlow(mkOpt({ conns: [{ id: 'e1-3', from: '1', to: '3' }] }))
        await w.vm.$nextTick()
        startConnect(w, '1')
        const tgt = handleEl(w, '3', 'top')
        moveOver(tgt)
        expect(tgt.getAttribute('data-connect-status')).toBe('invalid')
        dropAt(tgt)
        expect(w.vm.conns.length).toBe(1) //僅原有邊
        const end = w.emitted('connect-end')
        expect(end).toHaveLength(1)
        expect(end[0][1]).toMatchObject({ valid: false, reason: 'duplicate' })
        w.destroy()
    })
})

describe('F10 hover 判定不觸發 wrapper 重渲染(細粒度鐵律)', () => {
    test('建線中 20 步 mousemove(含 hover 進出把手): NodeWrapper/EdgeWrapper 更新 0 次', async () => {
        const w = mountFlow(mkOpt({ conns: [{ id: 'e3-2', from: '3', to: '2' }] }))
        await w.vm.$nextTick()
        const counts = { node: 0, edge: 0 }
        w.findAllComponents(NodeWrapper).wrappers.forEach(c => c.vm.$on('hook:updated', () => { counts.node++ }))
        w.findAllComponents(EdgeWrapper).wrappers.forEach(c => c.vm.$on('hook:updated', () => { counts.edge++ }))
        startConnect(w, '1')
        const tgt = handleEl(w, '2', 'top')
        const src = handleEl(w, '3', 'top')
        for (let i = 0; i < 20; i++) {
            moveOver(i % 3 === 0 ? tgt : (i % 3 === 1 ? src : null), 40 + i, 40 + i)
            await w.vm.$nextTick()
        }
        expect(counts.node).toBe(0)
        expect(counts.edge).toBe(0)
        dropAt(null)
        w.destroy()
    })
})
