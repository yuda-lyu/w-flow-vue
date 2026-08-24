/**
 * 渲染拓撲驗收: 每幀手勢狀態與按鍵狀態不得引發全樹重渲染。
 *
 * 背景(2026-08-24 定位, 80節點+90邊實測):
 * - 舊: v-if 條件式 slot 轉發使 wrapper $stable=false, WFlowVue 每次 re-render 強制全部
 *   Node/EdgeWrapper 重渲染(拉框40步=全樹40輪, 實測對照 10/10 vs 0/10);
 * - 舊: keysPressed 物件於每次 key-repeat 重建, 且複選鍵狀態以 prop 進入渲染面
 *   (按住Shift 20次repeat=全樹20輪)。
 * 修法: slot 轉發改普通函式 prop(SlotOutlet), 每幀狀態入穩定容器(selectionVisual/connectionVisual),
 * 複選鍵改 getter 注入。本檔以 render count 把收益鎖成規格(只鎖次數, 不鎖毫秒)。
 *
 * 規格:
 * R1 按住多選鍵(含 key-repeat)與放開: NodeWrapper/EdgeWrapper 重渲染次數 = 0。
 * R2 框選拉框期間(每步 mousemove): NodeWrapper/EdgeWrapper 重渲染次數 = 0, SelectionBox 每步更新。
 * R3 建線拉線期間(doConnect 每步): NodeWrapper/EdgeWrapper 重渲染次數 = 0。
 * R4 宿主自訂 popup slot: 內容照常渲染; 其 reactive 資料更新仍傳達; 無 slot 走內建 fallback。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeWrapper from '../src/components/nodes/NodeWrapper.vue'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'

const N_NODES = 12
const N_CONNS = 12

function buildOpt() {
    const nodes = []
    for (let i = 0; i < N_NODES; i++) {
        nodes.push({ id: `n${i}`, name: `Node ${i}`, position: { x: (i % 4) * 150, y: Math.floor(i / 4) * 100 }, width: 100, height: 40 })
    }
    const conns = []
    for (let i = 0; i < N_CONNS; i++) {
        conns.push({ id: `e${i}`, from: `n${i % N_NODES}`, to: `n${(i + 5) % N_NODES}`, name: `c${i}` })
    }
    return { nodes, conns }
}

function instrument(w) {
    const counts = { node: 0, edge: 0 }
    w.findAllComponents(NodeWrapper).wrappers.forEach(c => c.vm.$on('hook:updated', () => { counts.node++ }))
    w.findAllComponents(EdgeWrapper).wrappers.forEach(c => c.vm.$on('hook:updated', () => { counts.edge++ }))
    return counts
}

async function tick(w, n = 1) {
    for (let i = 0; i < n; i++) await w.vm.$nextTick()
}

describe('R1 按鍵狀態不進渲染面', () => {
    test('按住多選鍵20次keydown(模擬repeat)與放開: wrapper 更新 0 次', async () => {
        const w = mount(WFlowVue, { propsData: { opt: buildOpt() }, attachTo: document.body })
        await tick(w, 2)
        const counts = instrument(w)
        for (let i = 0; i < 20; i++) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }))
            await tick(w)
        }
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
        await tick(w, 2)
        expect(counts.node).toBe(0)
        expect(counts.edge).toBe(0)
        w.destroy()
    })
})

describe('R2 框選期間全樹靜止', () => {
    test('拉框40步: wrapper 更新 0 次, 框本身照常更新', async () => {
        const w = mount(WFlowVue, { propsData: { opt: buildOpt() }, attachTo: document.body })
        await tick(w, 2)
        const counts = instrument(w)

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }))
        await tick(w)
        w.find('.vue-flow').trigger('mousedown', { button: 0, clientX: 5, clientY: 5 })
        await tick(w)
        for (let i = 1; i <= 40; i++) {
            document.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true, buttons: 1, shiftKey: true, clientX: 5 + i * 10, clientY: 5 + i * 8,
            }))
            await tick(w)
        }
        //拉框中框狀態確實在走(視覺回饋存在)
        expect(w.vm.selectionVisual.box).toBeTruthy()
        expect(w.vm.selectionVisual.box.width).toBeGreaterThan(0)

        //斷言於 mouseup 之前: 拉框期間 wrapper 完全靜止;
        //mouseup 提交選取後之重渲染屬正當(selected prop 變更), 不在本規格內
        expect(counts.node).toBe(0)
        expect(counts.edge).toBe(0)

        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, shiftKey: true, clientX: 405, clientY: 325 }))
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
        await tick(w, 2)
        //提交後確實有節點被選取(手勢功能未被優化改壞)
        expect(w.vm.selectedNodes.length).toBeGreaterThan(0)
        w.destroy()
    })
})

describe('R3 建線期間全樹靜止', () => {
    test('拉線30步: wrapper 更新 0 次', async () => {
        const w = mount(WFlowVue, { propsData: { opt: buildOpt() }, attachTo: document.body })
        await tick(w, 2)
        document.elementFromPoint = () => null

        const src = w.findAll('.vue-flow__handle--source')
        expect(src.length).toBeGreaterThan(0)
        src.at(0).trigger('mousedown', { button: 0 })
        await tick(w)

        const counts = instrument(w)
        for (let i = 1; i <= 30; i++) {
            document.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true, buttons: 1, clientX: 10 + i * 8, clientY: 10 + i * 6,
            }))
            await tick(w)
        }
        expect(w.vm.isConnecting).toBe(true)
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 300, clientY: 200 }))
        await tick(w, 2)
        expect(counts.node).toBe(0)
        expect(counts.edge).toBe(0)
        w.destroy()
    })
})

describe('R4 宿主自訂 popup slot 之行為不變', () => {
    test('宿主 slot 內容渲染 + reactive 更新傳達 + 無 slot 走 fallback', async () => {
        const Host = {
            components: { WFlowVue },
            data: () => ({ msg: 'M0', opt: buildOpt() }),
            template: `<div><WFlowVue ref="wf" :opt="opt"><template #node-popup="{ node }"><em class="host-node-popup">{{ msg }}-{{ node.id }}</em></template></WFlowVue></div>`,
        }
        const h = mount(Host, { attachTo: document.body })
        await h.vm.$nextTick()

        //以 openInfoPopup 開啟第一顆節點之 popup, 檢查宿主內容
        const nw = h.findAllComponents(NodeWrapper).at(0)
        nw.vm.openInfoPopup()
        await h.vm.$nextTick()
        await h.vm.$nextTick()
        expect(document.body.innerHTML).toContain('M0-n0')

        //宿主 reactive 更新仍傳達
        h.vm.msg = 'M1'
        await h.vm.$nextTick()
        await h.vm.$nextTick()
        expect(document.body.innerHTML).toContain('M1-n0')
        h.destroy()

        //無 slot: 內建 fallback(節點名)照常
        const w = mount(WFlowVue, { propsData: { opt: buildOpt() }, attachTo: document.body })
        await w.vm.$nextTick()
        const nw2 = w.findAllComponents(NodeWrapper).at(0)
        nw2.vm.openInfoPopup()
        await w.vm.$nextTick()
        await w.vm.$nextTick()
        expect(nw2.vm.popupSlotFn).toBeNull()
        w.destroy()
    })
})
