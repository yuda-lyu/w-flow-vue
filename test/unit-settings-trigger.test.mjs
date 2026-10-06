/**
 * 設定入口方式(opt.nodesSettingsTrigger / opt.connsSettingsTrigger ∈ hover | click | dblclick, 預設 dblclick):
 * G1 預設 dblclick: hover 不出齒輪; 雙擊本體 → 直接開設定 popup(不顯示齒輪 icon, 錨區 --silent), 並成為唯一 active. 連線同.
 * G2 click 模式: 單擊即開設定 popup; 資訊 popup 讓位不開.
 * G3 hover 模式: 移入出齒輪、移出收(既有行為); 點擊/雙擊本體不直接開設定.
 * G4 非法值回退 dblclick; 把手上之雙擊不開; 手勢/複選中拒開; locked 不開.
 * G5 dblclick 模式: 單擊之資訊 popup 延後 250ms 再開(雙擊前必先派發 click, 不得閃現); 期間雙擊即取消, 只開設定.
 * G6 設定 popup 之開啟方向(節點 node.popupDirection → opt.defNodePopupDirection → right; 連線 conn.popupDirection →
 *    opt.defConnPopupDirection → right; 同一組測試驗兩種元素): 錨點角與 WPopup placement 依方向; 非四方位回退 right;
 *    popup 開啟期間凍結方向(表單改方向於下次開啟生效).
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import WPopup from 'w-component-vue/src/components/WPopup.vue'

const base = () => ({
    nodes: [
        { id: 'a', name: 'A', description: 'dA', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: 'b', name: 'B', position: { x: 300, y: 200 }, width: 100, height: 40 },
    ],
    conns: [{ id: 'e', from: 'a', to: 'b', name: 'E' }],
})
const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })
const nw = (w, id) => w.vm.$refs.nodeRenderer.$refs.wrappers.find(c => c.node.id === id)
const ew = (w) => w.vm.$refs.edgeRenderer.$refs.wrappers[0]
const nodeAnchor = (w, id) => w.find(`.vue-flow__node[data-id="${id}"] .vue-flow__node-settings-anchor`)
const edgeAnchor = (w) => w.find('.vue-flow__edge-settings-anchor')
const tick = async (w) => { await w.vm.$nextTick(); await w.vm.$nextTick() }
const clickNode = async (w, id) => {
    const el = w.find(`.vue-flow__node[data-id="${id}"]`)
    await el.trigger('mousedown', { button: 0, clientX: 10, clientY: 10 })
    await el.trigger('mouseup', { button: 0, clientX: 10, clientY: 10 })
    await el.trigger('click', { button: 0, clientX: 10, clientY: 10 })
}

describe('G1 預設 dblclick: 直接開設定 popup, 無齒輪', () => {
    test('節點', async () => {
        const w = mountFlow(base())
        await tick(w)
        expect(w.vm.nodesSettingsTrigger).toBe('dblclick')
        nw(w, 'a').hovered = true
        await tick(w)
        expect(nodeAnchor(w, 'a').exists()).toBe(false)
        const el = w.find('.vue-flow__node[data-id="a"]')
        await clickNode(w, 'a')
        await el.trigger('dblclick')
        await tick(w)
        expect(nw(w, 'a').settingsPopupShow).toBe(true)
        expect(nw(w, 'a').infoPopupShow).toBe(false)
        expect(w.vm.selectedNodes).toEqual(['a'])
        expect(w.emitted('node-double-click')).toHaveLength(1)
        //錨區僅供定位, 齒輪 icon 隱藏(--silent)
        expect(nodeAnchor(w, 'a').exists()).toBe(true)
        expect(nodeAnchor(w, 'a').classes()).toContain('vue-flow__node-settings-anchor--silent')
        w.destroy()
    })
    test('連線', async () => {
        const w = mountFlow(base())
        await tick(w)
        ew(w).hovered = true
        await tick(w)
        expect(edgeAnchor(w).exists()).toBe(false)
        const g = w.find('.vue-flow__edge .vue-flow__edge-interaction')
        await g.trigger('click')
        await g.trigger('dblclick')
        await tick(w)
        expect(ew(w).settingsPopupShow).toBe(true)
        expect(ew(w).infoPopupShow).toBe(false)
        expect(w.vm.selectedConns).toEqual(['e'])
        expect(edgeAnchor(w).classes()).toContain('vue-flow__edge-settings-anchor--silent')
        w.destroy()
    })
})

describe('G2 click 模式', () => {
    test('單擊節點/連線即開設定 popup, 資訊 popup 讓位', async () => {
        const w = mountFlow({ ...base(), nodesSettingsTrigger: 'click', connsSettingsTrigger: 'click' })
        await tick(w)
        await clickNode(w, 'a')
        await tick(w)
        expect(nw(w, 'a').settingsPopupShow).toBe(true)
        expect(nw(w, 'a').infoPopupShow).toBe(false)
        nw(w, 'a').onInfoPopupInput(true)
        expect(nw(w, 'a').infoPopupShow).toBe(false)
        await w.find('.vue-flow__edge .vue-flow__edge-interaction').trigger('click')
        await tick(w)
        expect(ew(w).settingsPopupShow).toBe(true)
        expect(ew(w).infoPopupShow).toBe(false)
        w.destroy()
    })
})

describe('G3 hover 模式', () => {
    test('移入出齒輪、移出收; 雙擊本體不直接開設定', async () => {
        const w = mountFlow({ ...base(), nodesSettingsTrigger: 'hover', connsSettingsTrigger: 'hover' })
        await tick(w)
        nw(w, 'a').hovered = true
        ew(w).hovered = true
        await tick(w)
        expect(nodeAnchor(w, 'a').exists()).toBe(true)
        expect(nodeAnchor(w, 'a').classes()).not.toContain('vue-flow__node-settings-anchor--silent')
        expect(edgeAnchor(w).exists()).toBe(true)
        await w.find('.vue-flow__node[data-id="a"]').trigger('dblclick')
        await tick(w)
        expect(nw(w, 'a').settingsPopupShow).toBe(false)
        nw(w, 'a').hovered = false
        ew(w).hovered = false
        await tick(w)
        expect(nodeAnchor(w, 'a').exists()).toBe(false)
        expect(edgeAnchor(w).exists()).toBe(false)
        w.destroy()
    })
})

describe('G4 非法值與閘門', () => {
    test('非法值回退 dblclick; 把手上之 dblclick 不開; locked 不開', async () => {
        const w = mountFlow({ ...base(), nodesSettingsTrigger: 'bogus' })
        await tick(w)
        expect(w.vm.nodesSettingsTrigger).toBe('dblclick')
        await w.find('.vue-flow__node[data-id="a"] .vue-flow__handle--bottom').trigger('dblclick')
        await tick(w)
        expect(nw(w, 'a').settingsPopupShow).toBe(false)
        w.vm.toggleInteractive()
        await tick(w)
        await w.find('.vue-flow__node[data-id="a"]').trigger('dblclick')
        await tick(w)
        expect(nw(w, 'a').settingsPopupShow).toBe(false)
        w.destroy()
    })
})

describe('G5 dblclick 模式: 資訊 popup 延後, 雙擊取消', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())
    test('節點/連線: click 後 250ms 內無資訊 popup; 逾時才開; 雙擊到來則取消且只開設定', async () => {
        const w = mountFlow(base())
        await tick(w)
        nw(w, 'a').onInfoPopupInput(true)
        expect(nw(w, 'a').infoPopupShow).toBe(false)
        jest.advanceTimersByTime(249)
        expect(nw(w, 'a').infoPopupShow).toBe(false)
        jest.advanceTimersByTime(2)
        expect(nw(w, 'a').infoPopupShow).toBe(true)
        nw(w, 'a').infoPopupShow = false
        nw(w, 'a').onInfoPopupInput(true)
        await w.find('.vue-flow__node[data-id="a"]').trigger('dblclick')
        jest.advanceTimersByTime(300)
        expect(nw(w, 'a').infoPopupShow).toBe(false)
        expect(nw(w, 'a').settingsPopupShow).toBe(true)
        //連線
        const g = w.find('.vue-flow__edge .vue-flow__edge-interaction')
        await g.trigger('click')
        expect(ew(w).infoPopupShow).toBe(false)
        await g.trigger('dblclick')
        jest.advanceTimersByTime(300)
        expect(ew(w).infoPopupShow).toBe(false)
        expect(ew(w).settingsPopupShow).toBe(true)
        w.destroy()
    })
})

describe('G6 設定 popup 之開啟方向', () => {
    //節點與連線同一規則(契約 §6), 以同一組測試驗兩種元素(對稱性): 第一個元素為 a / e, 第二個為 b / f
    const ewOf = (w, id) => w.vm.$refs.edgeRenderer.$refs.wrappers.find(c => c.conn.id === id)
    const KINDS = {
        節點: {
            ids: ['a', 'b'],
            wrapper: nw,
            anchor: nodeAnchor,
            cls: 'vue-flow__node-settings-anchor--',
            list: (opt) => opt.nodes,
            data: (w, i) => w.vm.nodes[i],
            wrappers: (w) => w.vm.$refs.nodeRenderer.$refs.wrappers,
            defKey: 'defNodePopupDirection',
            triggerKey: 'nodesSettingsTrigger',
        },
        連線: {
            ids: ['e', 'f'],
            wrapper: ewOf,
            anchor: (w, id) => w.find(`.vue-flow__edge[data-id="${id}"] .vue-flow__edge-settings-anchor`),
            cls: 'vue-flow__edge-settings-anchor--',
            list: (opt) => opt.conns,
            data: (w, i) => w.vm.conns[i],
            wrappers: (w) => w.vm.$refs.edgeRenderer.$refs.wrappers,
            defKey: 'defConnPopupDirection',
            triggerKey: 'connsSettingsTrigger',
        },
    }
    //第二條連線(反向, 有 label)供「單一元素覆寫 vs opt 預設」之比對
    const base2 = () => {
        const opt = base()
        opt.conns.push({ id: 'f', from: 'b', to: 'a', name: 'F' })
        return opt
    }
    const settingsPopup = (k, w, id) => k.anchor(w, id).findComponent(WPopup)
    const openSettings = async (k, w, id) => {
        k.wrapper(w, id).settingsPopupShow = true
        await tick(w)
    }
    const closeAll = async (k, w) => {
        for (const c of k.wrappers(w)) c.settingsPopupShow = false
        await tick(w)
    }
    const DIRS = [
        ['right', 'top-right', 'right-start'],
        ['top', 'top-right', 'top-end'],
        ['left', 'top-left', 'left-start'],
        ['bottom', 'bottom-right', 'bottom-end'],
    ]

    describe.each(Object.keys(KINDS))('%s', (kind) => {
        const k = KINDS[kind]
        const [id0, id1] = k.ids

        test.each(DIRS)('popupDirection=%s → 錨點 %s、placement %s', async (dir, corner, placement) => {
            const opt = base2()
            k.list(opt)[0].popupDirection = dir
            const w = mountFlow(opt)
            await tick(w)
            await openSettings(k, w, id0)
            expect(k.anchor(w, id0).classes()).toContain(k.cls + corner)
            expect(settingsPopup(k, w, id0).props('placement')).toBe(placement)
            w.destroy()
        })

        test('未給 → opt 預設方向鍵; 皆未給 → right(原定位); 非四方位 → right', async () => {
            const w1 = mountFlow(base2())
            await tick(w1)
            await openSettings(k, w1, id0)
            expect(settingsPopup(k, w1, id0).props('placement')).toBe('right-start')
            expect(k.anchor(w1, id0).classes()).toContain(k.cls + 'top-right')
            w1.destroy()

            const opt2 = { ...base2(), [k.defKey]: 'left' }
            k.list(opt2)[1].popupDirection = 'bottom'
            const w2 = mountFlow(opt2)
            await tick(w2)
            await openSettings(k, w2, id0)
            expect(settingsPopup(k, w2, id0).props('placement')).toBe('left-start')
            await closeAll(k, w2)
            await openSettings(k, w2, id1)
            expect(settingsPopup(k, w2, id1).props('placement')).toBe('bottom-end')
            w2.destroy()

            const opt3 = base2()
            k.list(opt3)[0].popupDirection = 'diagonal'
            const w3 = mountFlow(opt3)
            await tick(w3)
            await openSettings(k, w3, id0)
            expect(settingsPopup(k, w3, id0).props('placement')).toBe('right-start')
            w3.destroy()
        })

        test('開啟期間改方向不移動錨點與 placement; 關閉後下次開啟即用新方向', async () => {
            const w = mountFlow(base2())
            await tick(w)
            await openSettings(k, w, id0)
            expect(settingsPopup(k, w, id0).props('placement')).toBe('right-start')
            //經表單改方向(與使用者於 Advanced 群選 Left 同一路徑: 表單 update → *-settings-update → 寫回資料)
            k.wrapper(w, id0).onSettingsUpdate('popupDirection', 'left')
            await tick(w)
            expect(k.data(w, 0).popupDirection).toBe('left')
            expect(k.anchor(w, id0).classes()).toContain(k.cls + 'top-right')
            expect(settingsPopup(k, w, id0).props('placement')).toBe('right-start')
            k.wrapper(w, id0).settingsPopupShow = false
            await tick(w)
            await openSettings(k, w, id0)
            expect(k.anchor(w, id0).classes()).toContain(k.cls + 'top-left')
            expect(settingsPopup(k, w, id0).props('placement')).toBe('left-start')
            w.destroy()
        })

        test('hover 模式: 齒輪(錨點)於開啟前即位於方向對應之角', async () => {
            const opt = { ...base2(), [k.triggerKey]: 'hover' }
            k.list(opt)[0].popupDirection = 'bottom'
            const w = mountFlow(opt)
            await tick(w)
            k.wrapper(w, id0).hovered = true
            await tick(w)
            expect(k.anchor(w, id0).exists()).toBe(true)
            expect(k.anchor(w, id0).classes()).toContain(k.cls + 'bottom-right')
            w.destroy()
        })
    })

    test('連線無 name(label 不渲染, 錨點以 label 中點之零尺寸元素為參考)亦依方向', async () => {
        const k = KINDS['連線']
        const opt = base2()
        delete opt.conns[0].name
        opt.conns[0].popupDirection = 'left'
        const w = mountFlow(opt)
        await tick(w)
        expect(w.find('.vue-flow__edge[data-id="e"] .vue-flow__edge-label').exists()).toBe(false)
        await openSettings(k, w, 'e')
        expect(k.anchor(w, 'e').classes()).toContain(k.cls + 'top-left')
        expect(settingsPopup(k, w, 'e').props('placement')).toBe('left-start')
        w.destroy()
    })
})
