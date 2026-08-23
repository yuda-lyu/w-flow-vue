/**
 * 節點 mousedown 拖曳武裝之修正驗收(缺陷 C)。
 *
 * 修正前:mousedown 當下即 emit drag-start,不分按鍵、無位移門檻,
 *        故純點擊也會走完 endDrag → 回寫座標 → emit update:nodes,
 *        宿主收到未變更之全量節點而誤判有未儲存變更。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'

const sampleNodes = [
    { id: '1', type: 'input', name: 'Node 1', position: { x: 50, y: 50 }, width: 100, height: 40 },
    { id: '2', type: 'output', name: 'Node 2', position: { x: 300, y: 300 }, width: 100, height: 40 },
]

function createWrapper(optOverrides = {}) {
    return mount(WFlowVue, {
        propsData: {
            opt: {
                nodes: JSON.parse(JSON.stringify(sampleNodes)),
                conns: [],
                ...optOverrides,
            },
        },
        attachTo: document.body,
    })
}

const nodeEl = (w, id) => w.find(`.vue-flow__node[data-id="${id}"]`)

//以真實 DOM 事件驅動:mousedown/mouseup 打在節點元素上, mousemove 打在 document(與實作註冊位置一致)
function mouseDownOn(el, { x = 0, y = 0, button = 0 } = {}) {
    el.element.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, clientX: x, clientY: y, button, buttons: button === 0 ? 1 : 2,
    }))
}
function mouseMoveDoc({ x = 0, y = 0, buttons = 1 } = {}) {
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y, buttons }))
}
function mouseUpOn(el, { x = 0, y = 0 } = {}) {
    //節點元素上放開:先觸發元素層之 onMouseUp, 冒泡後才到 document 之 onDocMouseUp
    el.element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y, buttons: 0 }))
}

describe('純點擊不得走拖曳生命週期', () => {
    test('點擊節點無位移: 不發 node-drag-start / node-drag-stop / update:nodes', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100 })
        mouseUpOn(n, { x: 100, y: 100 })
        await w.vm.$nextTick()
        expect(w.emitted('node-drag-start')).toBeFalsy()
        expect(w.emitted('node-drag-stop')).toBeFalsy()
        expect(w.emitted('update:nodes')).toBeFalsy()
        expect(w.emitted('node-click')).toBeTruthy()
        w.destroy()
    })

    test('位移 2px(未跨門檻)後放開: 仍視為點擊', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100 })
        mouseMoveDoc({ x: 102, y: 100 })
        mouseUpOn(n, { x: 102, y: 100 })
        await w.vm.$nextTick()
        expect(w.emitted('node-drag-start')).toBeFalsy()
        expect(w.emitted('update:nodes')).toBeFalsy()
        expect(w.emitted('node-click')).toBeTruthy()
        w.destroy()
    })
})

describe('跨越位移門檻才啟動拖曳', () => {
    test('位移超過 2px: node-drag-start 恰發一次', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100 })
        mouseMoveDoc({ x: 110, y: 100 })
        mouseMoveDoc({ x: 120, y: 100 })
        mouseMoveDoc({ x: 130, y: 100 })
        await w.vm.$nextTick()
        expect(w.emitted('node-drag-start')).toHaveLength(1)
        w.destroy()
    })

    test('跨門檻後立即放開: 節點仍套用該次位移(不得原地不動)', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '1')
        const x0 = w.vm.opt.nodes[0].position.x
        mouseDownOn(n, { x: 100, y: 100 })
        mouseMoveDoc({ x: 140, y: 100 })
        mouseUpOn(n, { x: 140, y: 100 })
        await w.vm.$nextTick()
        expect(w.vm.opt.nodes[0].position.x).not.toBe(x0)
        w.destroy()
    })

    test('跨門檻拖出後又移回原點放開: 不得再發 node-click', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100 })
        mouseMoveDoc({ x: 140, y: 100 })
        mouseMoveDoc({ x: 100, y: 100 })
        mouseUpOn(n, { x: 100, y: 100 })
        await w.vm.$nextTick()
        expect(w.emitted('node-drag-start')).toHaveLength(1)
        expect(w.emitted('node-click')).toBeFalsy()
        w.destroy()
    })
})

describe('非主鍵不啟動拖曳', () => {
    test('右鍵按於節點: 不發 drag-start 與 node-click', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100, button: 2 })
        mouseMoveDoc({ x: 140, y: 100, buttons: 2 })
        mouseUpOn(n, { x: 140, y: 100 })
        await w.vm.$nextTick()
        expect(w.emitted('node-drag-start')).toBeFalsy()
        expect(w.emitted('node-click')).toBeFalsy()
        w.destroy()
    })

    test('中鍵按於節點: 不發 drag-start', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100, button: 1 })
        mouseMoveDoc({ x: 140, y: 100, buttons: 4 })
        await w.vm.$nextTick()
        expect(w.emitted('node-drag-start')).toBeFalsy()
        w.destroy()
    })
})

describe('mouseup 遺失後不得幽靈拖曳', () => {
    test('主鍵已放開(buttons=0)之 mousemove 不得跨門檻啟動拖曳', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100 })
        //模擬使用者在視窗外放開:document 收不到 mouseup, 回到視窗後移動時 buttons 已為 0
        mouseMoveDoc({ x: 300, y: 300, buttons: 0 })
        mouseMoveDoc({ x: 400, y: 400, buttons: 0 })
        await w.vm.$nextTick()
        expect(w.emitted('node-drag-start')).toBeFalsy()
        expect(w.vm.isDraggingNode).toBe(false)
        w.destroy()
    })
})

describe('不可拖節點之點擊判準不受影響', () => {
    test('nodesDraggable=false 時移動 4px 放開: 不得發 node-click(距離判準仍在)', async () => {
        const w = createWrapper({ nodesDraggable: false })
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100 })
        mouseMoveDoc({ x: 104, y: 100 })
        mouseUpOn(n, { x: 104, y: 100 })
        await w.vm.$nextTick()
        expect(w.emitted('node-drag-start')).toBeFalsy()
        expect(w.emitted('node-click')).toBeFalsy()
        w.destroy()
    })

    test('nodesDraggable=false 時原地點擊: node-click 照常發出', async () => {
        const w = createWrapper({ nodesDraggable: false })
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100 })
        mouseUpOn(n, { x: 100, y: 100 })
        await w.vm.$nextTick()
        expect(w.emitted('node-click')).toBeTruthy()
        w.destroy()
    })
})

describe('選取時機不因拖曳延後而改變', () => {
    test('selectNodesOnDrag=true: mousedown 當下即選取(不必等 mouseup)', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '2')
        mouseDownOn(n, { x: 100, y: 100 })
        await w.vm.$nextTick()
        expect(w.vm.selectedNodes).toContain('2')
        w.destroy()
    })

    test('locked=true: mousedown 不選取亦不啟動拖曳', async () => {
        const w = createWrapper({ locked: true })
        const n = nodeEl(w, '2')
        mouseDownOn(n, { x: 100, y: 100 })
        mouseMoveDoc({ x: 140, y: 100 })
        await w.vm.$nextTick()
        expect(w.emitted('node-drag-start')).toBeFalsy()
        expect(w.vm.selectedNodes).not.toContain('2')
        w.destroy()
    })
})

describe('元件銷毀時清理 document 監聽器', () => {
    test('拖曳進行中銷毀: 後續 mousemove 不得再觸發任何 emit', async () => {
        const w = createWrapper()
        const n = nodeEl(w, '1')
        mouseDownOn(n, { x: 100, y: 100 })
        const addSpy = jest.spyOn(document, 'removeEventListener')
        w.destroy()
        const removed = addSpy.mock.calls.filter(c => c[0] === 'mousemove' || c[0] === 'mouseup')
        expect(removed.length).toBeGreaterThan(0)
        addSpy.mockRestore()
    })
})

describe('resize 手勢收尾: 全域游標樣式不得殘留', () => {
    //why: onResizeStart 會往 document.head 插入 `* { cursor: X !important; }`,
    //     原本只在自身之 document mouseup 移除; 若元件於 resize 中被銷毀或視窗失焦後於視窗外放開,
    //     該樣式會永久殘留, 使整頁每個元素卡在 resize 游標直到重新整理
    const cursorStyles = () => Array.from(document.head.querySelectorAll('style'))
        .filter(s => /\*\s*\{\s*cursor:/.test(s.textContent || ''))

    const startResize = (w) => {
        const nw = w.findComponent({ name: 'NodeWrapper' })
        nw.vm.onResizeStart({ clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {} }, 'bottom-right')
        return nw
    }

    test('resize 進行中銷毀元件: 全域游標樣式須被移除', () => {
        const w = createWrapper()
        const n0 = cursorStyles().length
        startResize(w)
        expect(cursorStyles()).toHaveLength(n0 + 1)
        w.destroy()
        expect(cursorStyles()).toHaveLength(n0)
    })

    test('resize 進行中視窗失焦: 全域游標樣式須被移除', () => {
        const w = createWrapper()
        const n0 = cursorStyles().length
        startResize(w)
        expect(cursorStyles()).toHaveLength(n0 + 1)
        window.dispatchEvent(new Event('blur'))
        expect(cursorStyles()).toHaveLength(n0)
        w.destroy()
    })

    test('正常 mouseup 收尾: 樣式移除且發出 node-resize-end 恰一次', () => {
        const w = createWrapper()
        const n0 = cursorStyles().length
        const nw = startResize(w)
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, buttons: 0 }))
        expect(cursorStyles()).toHaveLength(n0)
        expect(nw.emitted('node-resize-end')).toHaveLength(1)
        //收尾後再來一次 mouseup 不得重複發出
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, buttons: 0 }))
        expect(nw.emitted('node-resize-end')).toHaveLength(1)
        w.destroy()
    })
})

describe('拖曳態 class(缺陷 E: dragging 由父層下傳)', () => {
    //why: 原本 NodeWrapper 之本地 isDragging 為死旗標(定義了、綁上了、有 CSS, 就是沒有寫入點)。
    //改由 WFlowVue 之 dragNodeStartPositions 下傳, 使 (a)父層拒絕之手勢不會誤標拖曳態
    //(b)多選整組拖曳時全部節點都標上, 而非只有被滑鼠抓住的那顆。
    const hasDragClass = (w, id) => nodeEl(w, id).classes().includes('vue-flow__node--dragging')

    //跨門檻當下父層會同步跑第一次 doDrag, 此時 DOM 尚未更新, 故取樣一律等一次 nextTick
    const crossThreshold = async (w, id, x = 140) => {
        mouseDownOn(nodeEl(w, id), { x: 100, y: 100 })
        mouseMoveDoc({ x, y: 100 })
        await w.vm.$nextTick()
    }

    test('跨門檻後被拖節點掛上 --dragging', async () => {
        const w = createWrapper()
        expect(hasDragClass(w, '1')).toBe(false)
        await crossThreshold(w, '1')
        expect(hasDragClass(w, '1')).toBe(true)
        w.destroy()
    })

    test('未跨門檻之純點擊全程不得出現 --dragging', async () => {
        const w = createWrapper()
        mouseDownOn(nodeEl(w, '1'), { x: 100, y: 100 })
        mouseMoveDoc({ x: 102, y: 100 })
        await w.vm.$nextTick()
        expect(hasDragClass(w, '1')).toBe(false)
        mouseUpOn(nodeEl(w, '1'), { x: 102, y: 100 })
        await w.vm.$nextTick()
        expect(hasDragClass(w, '1')).toBe(false)
        w.destroy()
    })

    test('放開後移除 --dragging', async () => {
        const w = createWrapper()
        await crossThreshold(w, '1')
        expect(hasDragClass(w, '1')).toBe(true)
        mouseUpOn(nodeEl(w, '1'), { x: 140, y: 100 })
        await w.vm.$nextTick()
        expect(hasDragClass(w, '1')).toBe(false)
        w.destroy()
    })

    test('視窗失焦後移除 --dragging', async () => {
        const w = createWrapper()
        await crossThreshold(w, '1')
        expect(hasDragClass(w, '1')).toBe(true)
        window.dispatchEvent(new Event('blur'))
        await w.vm.$nextTick()
        expect(hasDragClass(w, '1')).toBe(false)
        w.destroy()
    })

    test('locked=true: 跨門檻亦不得出現 --dragging', async () => {
        const w = createWrapper({ locked: true })
        await crossThreshold(w, '1')
        expect(hasDragClass(w, '1')).toBe(false)
        w.destroy()
    })

    //坑一: 本地旗標方案在此組合下會誤標(NodeWrapper 只擋 draggable 不擋 nodesDraggable)
    test('nodesDraggable=false + node.draggable=true: 父層拒絕, 不得出現假 --dragging', async () => {
        const w = mount(WFlowVue, {
            propsData: {
                opt: {
                    nodes: [{ id: '1', type: 'input', name: 'N1', position: { x: 50, y: 50 }, width: 100, height: 40, draggable: true }],
                    conns: [],
                    nodesDraggable: false,
                },
            },
            attachTo: document.body,
        })
        const x0 = w.vm.opt.nodes[0].position.x
        await crossThreshold(w, '1')
        expect(w.vm.isDraggingNode).toBe(false)
        expect(hasDragClass(w, '1')).toBe(false)
        expect(w.vm.opt.nodes[0].position.x).toBe(x0)
        w.destroy()
    })

    //坑二: 多選為整組移動, 本地旗標只會套到被抓住的那顆
    test('多選整組拖曳: 參與移動之節點全部掛上 --dragging', async () => {
        const w = createWrapper()
        w.vm.setSelectedNodes(['1', '2'])
        //按住多選鍵, 否則 drag-prepare 會把選取收斂成單顆
        w.vm.keysPressed = { ...w.vm.keysPressed, Shift: true }
        await crossThreshold(w, '1')
        //先確認選取未被 drag-prepare 收斂成單顆, 否則下面的斷言會變成假通過
        expect(Object.keys(w.vm.dragNodeStartPositions).sort()).toEqual(['1', '2'])
        expect(hasDragClass(w, '1')).toBe(true)
        expect(hasDragClass(w, '2')).toBe(true)
        w.destroy()
    })

    //坑三: 舊 CSS 之 z-index:1000 !important 會把自訂較高層級之節點反向降級
    test('自訂 zIndex=5000 之節點, 拖曳前後皆維持 5000(不得被降級)', async () => {
        const w = mount(WFlowVue, {
            propsData: {
                opt: {
                    nodes: [{ id: '1', type: 'input', name: 'N1', position: { x: 50, y: 50 }, width: 100, height: 40, zIndex: 5000 }],
                    conns: [],
                },
            },
            attachTo: document.body,
        })
        expect(nodeEl(w, '1').element.style.zIndex).toBe('5000')
        await crossThreshold(w, '1')
        expect(hasDragClass(w, '1')).toBe(true)
        expect(nodeEl(w, '1').element.style.zIndex).toBe('5000')
        w.destroy()
    })

    test('resize 不得誤標為拖曳態', async () => {
        const w = createWrapper()
        const nw = w.findComponent({ name: 'NodeWrapper' })
        nw.vm.onResizeStart({ clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {} }, 'bottom-right')
        await w.vm.$nextTick()
        expect(hasDragClass(w, '1')).toBe(false)
        w.destroy()
    })
})
