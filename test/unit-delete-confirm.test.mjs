/**
 * 刪除確認契約之驗收(opt.funConfirmDeleting)。
 *
 * 規格:
 * D1 未提供 callback: 三個刪除入口(節點設定表單/連線設定表單/刪除鍵)一律直接刪除,
 *    套件不內建二次確認(確認 UI 已移除)。
 * D2 提供 callback 且回傳 true: 才真的刪除; callback 收到 { nodes, conns, from },
 *    其中 conns 含「因節點被刪而連帶刪除」之邊, from 標明來源入口。
 * D3 回傳非 true(false/undefined/truthy 非 true): 一律不刪, 不發 delete/update 事件。
 * D4 callback 拋錯: 不刪(不可預設為准), 且錯誤不被靜默吞掉。
 * D5 確認進行中(await 未回覆)之重入請求一律被擋, 不重複刪除亦不重複呼叫 callback。
 * D6 await 期間目標已被他途刪除: 以 id 重新解析「已確認之集合」——全數消失則不刪不發事件; 目標節點消失但已確認之連帶邊仍在 → 仍刪該邊(不留孤兒邊), 事件只含實際被刪者。
 * D7 await 期間元件被銷毀: 不再操作狀態。
 * D8 deletable:false 之元素自始排除於確認 payload 與刪除之外。
 * D9 elements-deleted 之 payload 只含實際被刪者。
 */
import Vue from 'vue'
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeSettingsForm from '../src/components/ui/NodeSettingsForm.vue'
import ConnSettingsForm from '../src/components/ui/ConnSettingsForm.vue'

const mkOpt = (extra = {}) => ({
    nodes: [
        { id: '1', type: 'basic', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: '2', type: 'basic', name: 'N2', position: { x: 300, y: 0 }, width: 100, height: 40 },
        { id: '3', type: 'basic', name: 'N3', position: { x: 0, y: 200 }, width: 100, height: 40 },
    ],
    conns: [
        { id: 'e1-2', from: '1', to: '2' },
        { id: 'e2-3', from: '2', to: '3' },
    ],
    deleteKeyEnabled: true,
    ...extra,
})

const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })
//延後回覆之 callback: 供測試控制 await 期間發生什麼事
function deferred() {
    let resolve
    const promise = new Promise(r => { resolve = r })
    return { promise, resolve }
}

describe('D1 未提供 callback: 三入口皆直接刪除', () => {
    test('節點設定表單刪除', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.onNodeSettingsDelete({ node: { id: '1' } })
        expect(w.vm.nodes.map(n => n.id)).toEqual(['2', '3'])
        //節點被刪時其相關連線一併刪除
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        expect(w.emitted('elements-deleted')).toHaveLength(1)
        w.destroy()
    })

    test('連線設定表單刪除', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.onConnSettingsDelete({ conn: { id: 'e1-2' } })
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        expect(w.emitted('elements-deleted')).toHaveLength(1)
        w.destroy()
    })

    test('刪除鍵刪除選取元素', async () => {
        const w = mountFlow(mkOpt())
        w.vm.setSelectedNodes(['1'])
        expect(await w.vm.deleteSelectedElements()).toBe(true)
        expect(w.vm.nodes.map(n => n.id)).toEqual(['2', '3'])
        expect(w.emitted('elements-deleted')).toHaveLength(1)
        w.destroy()
    })
})

describe('D2 callback 回傳 true 才刪除, 且 payload 正確', () => {
    test('節點入口: payload 含連帶刪除之邊與 from', async () => {
        const seen = []
        const w = mountFlow(mkOpt({ funConfirmDeleting: async (p) => { seen.push(p); return true } }))
        await w.vm.onNodeSettingsDelete({ node: { id: '2' } })
        expect(seen).toHaveLength(1)
        expect(seen[0].from).toBe('node-settings')
        expect(seen[0].nodes.map(n => n.id)).toEqual(['2'])
        //節點2之進出邊皆會被連帶刪除, 兩條都須在 payload 內
        expect(seen[0].conns.map(c => c.id).sort()).toEqual(['e1-2', 'e2-3'])
        expect(w.vm.nodes.map(n => n.id)).toEqual(['1', '3'])
        expect(w.vm.conns).toHaveLength(0)
        w.destroy()
    })

    test('連線入口: payload 只含該連線', async () => {
        const seen = []
        const w = mountFlow(mkOpt({ funConfirmDeleting: async (p) => { seen.push(p); return true } }))
        await w.vm.onConnSettingsDelete({ conn: { id: 'e1-2' } })
        expect(seen[0].from).toBe('conn-settings')
        expect(seen[0].nodes).toEqual([])
        expect(seen[0].conns.map(c => c.id)).toEqual(['e1-2'])
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        w.destroy()
    })

    test('刪除鍵入口: payload 含選取節點與其連帶邊', async () => {
        const seen = []
        const w = mountFlow(mkOpt({ funConfirmDeleting: async (p) => { seen.push(p); return true } }))
        w.vm.setSelectedNodes(['1'])
        expect(await w.vm.deleteSelectedElements()).toBe(true)
        expect(seen[0].from).toBe('delete-key')
        expect(seen[0].nodes.map(n => n.id)).toEqual(['1'])
        expect(seen[0].conns.map(c => c.id)).toEqual(['e1-2'])
        expect(w.vm.nodes.map(n => n.id)).toEqual(['2', '3'])
        w.destroy()
    })
})

describe('D3 回傳非 true 一律不刪', () => {
    test.each([
        ['false', false],
        ['undefined', undefined],
        ['truthy 但非 true(字串)', 'yes'],
        ['truthy 但非 true(數字)', 1],
    ])('%s: 不刪且不發事件', async (_label, ret) => {
        const w = mountFlow(mkOpt({ funConfirmDeleting: async () => ret }))
        expect(await w.vm.onNodeSettingsDelete({ node: { id: '1' } })).toBe(false)
        expect(w.vm.nodes).toHaveLength(3)
        expect(w.vm.conns).toHaveLength(2)
        expect(w.emitted('elements-deleted')).toBeFalsy()
        expect(w.emitted('update:nodes')).toBeFalsy()

        w.vm.setSelectedNodes(['1'])
        expect(await w.vm.deleteSelectedElements()).toBe(false)
        expect(w.vm.nodes).toHaveLength(3)
        expect(w.emitted('elements-deleted')).toBeFalsy()
        w.destroy()
    })
})

describe('D4 callback 拋錯: 不刪, 錯誤不被靜默吞掉', () => {
    test('拋錯視為不准刪除', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const w = mountFlow(mkOpt({ funConfirmDeleting: async () => { throw new Error('host boom') } }))
        expect(await w.vm.onConnSettingsDelete({ conn: { id: 'e1-2' } })).toBe(false)
        expect(w.vm.conns).toHaveLength(2)
        expect(w.emitted('elements-deleted')).toBeFalsy()
        expect(spy).toHaveBeenCalled()
        //閘門旗標須於拋錯後釋放(finally), 否則此後所有刪除都被誤擋
        expect(w.vm.deleteConfirming).toBe(false)
        spy.mockRestore()
        w.destroy()
    })
})

describe('D10 確認期間畫面不得先行變動(不可樂觀刪除)', () => {
    //why: 若先刪再問, callback 回 false 時節點會「消失又恢復」而閃爍——刪除須待確認回覆後才發生
    test('await 期間節點與其連線仍在資料與DOM中; 回 false 後全程未曾消失', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        await w.vm.$nextTick()
        const inDom = (id) => !!document.querySelector(`.vue-flow__node[data-id="${id}"]`)
        expect(inDom('1')).toBe(true)

        const p = w.vm.onNodeSettingsDelete({ node: { id: '1' } })
        await w.vm.$nextTick()
        //確認尚未回覆: 節點與連線都必須原封不動
        expect(w.vm.nodes.map(n => n.id)).toEqual(['1', '2', '3'])
        expect(w.vm.conns.map(c => c.id)).toEqual(['e1-2', 'e2-3'])
        expect(inDom('1')).toBe(true)
        //確認期間不得預先發出任何資料異動事件
        expect(w.emitted('update:nodes')).toBeFalsy()
        expect(w.emitted('update:conns')).toBeFalsy()
        expect(w.emitted('elements-deleted')).toBeFalsy()

        d.resolve(false)
        expect(await p).toBe(false)
        await w.vm.$nextTick()
        //回 false: 節點自始至終都在(無「消失又恢復」)
        expect(w.vm.nodes.map(n => n.id)).toEqual(['1', '2', '3'])
        expect(inDom('1')).toBe(true)
        w.destroy()
    })

    test('確認回 true 後才刪除(此時才發出資料異動事件)', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        await w.vm.$nextTick()
        const p = w.vm.onNodeSettingsDelete({ node: { id: '1' } })
        await w.vm.$nextTick()
        expect(document.querySelector('.vue-flow__node[data-id="1"]')).toBeTruthy()

        d.resolve(true)
        expect(await p).toBe(true)
        await w.vm.$nextTick()
        expect(document.querySelector('.vue-flow__node[data-id="1"]')).toBeNull()
        expect(w.emitted('update:nodes')).toHaveLength(1)
        w.destroy()
    })
})

describe('D11 確認期間之操作回饋(刪除鈕進入 pending)', () => {
    test('等待宿主回覆期間刪除鈕 disabled, 回覆後恢復', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        await w.vm.$nextTick()
        expect(w.vm.deleteConfirming).toBe(false)

        const p = w.vm.onNodeSettingsDelete({ node: { id: '1' } })
        await w.vm.$nextTick()
        //閘門進行中旗標為反應式: 供設定表單之刪除鈕呈現 pending(避免使用者以為沒反應而重複點)
        expect(w.vm.deleteConfirming).toBe(true)

        d.resolve(false)
        await p
        await w.vm.$nextTick()
        expect(w.vm.deleteConfirming).toBe(false)
        w.destroy()
    })

    test('設定表單之刪除鈕依 pending 狀態 disabled(節點與連線表單同契約)', async () => {
        //以反應式來源模擬 WFlowVue 之 deleteConfirming(其注入之 getter 讀取 data, 故表單 computed 會隨之更新)
        const st = Vue.observable({ pending: false })
        const provide = { getDeleteConfirming: () => st.pending }
        const nf = mount(NodeSettingsForm, {
            propsData: { node: { id: '1', type: 'basic' }, defNode: {} },
            provide,
        })
        const cf = mount(ConnSettingsForm, {
            propsData: { conn: { id: 'e1', from: '1', to: '2' }, defConn: {} },
            provide,
        })
        expect(nf.find('.vue-flow__delete-btn').attributes('disabled')).toBeUndefined()
        expect(cf.find('.vue-flow__delete-btn').attributes('disabled')).toBeUndefined()

        st.pending = true
        await nf.vm.$nextTick()
        await cf.vm.$nextTick()
        expect(nf.find('.vue-flow__delete-btn').attributes('disabled')).toBe('disabled')
        expect(cf.find('.vue-flow__delete-btn').attributes('disabled')).toBe('disabled')

        st.pending = false
        await nf.vm.$nextTick()
        expect(nf.find('.vue-flow__delete-btn').attributes('disabled')).toBeUndefined()
        nf.destroy()
        cf.destroy()
    })
})

describe('D5 確認進行中之重入被擋', () => {
    test('第二次請求不呼叫 callback 亦不刪除', async () => {
        const d = deferred()
        let calls = 0
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => { calls++; return d.promise } }))
        const p1 = w.vm.onNodeSettingsDelete({ node: { id: '1' } })
        //第一次仍在等待宿主回覆時再次請求(連點兩下刪除鈕)
        const p2 = w.vm.onNodeSettingsDelete({ node: { id: '1' } })
        expect(await p2).toBe(false)
        expect(calls).toBe(1)

        d.resolve(true)
        expect(await p1).toBe(true)
        expect(w.vm.nodes.map(n => n.id)).toEqual(['2', '3'])
        expect(w.emitted('elements-deleted')).toHaveLength(1) //只發一次
        w.destroy()
    })
})

describe('D6 await 期間目標已消失: 不刪不發事件', () => {
    test('確認回覆前該連線已被他途刪除', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        const p = w.vm.onConnSettingsDelete({ conn: { id: 'e1-2' } })
        //宿主尚未回覆期間, 該連線已由他途移除
        w.vm.conns.splice(w.vm.conns.findIndex(c => c.id === 'e1-2'), 1)
        d.resolve(true)
        expect(await p).toBe(false)
        expect(w.emitted('elements-deleted')).toBeFalsy()
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        w.destroy()
    })

    test('刪除鍵: 選取之節點於確認期間已消失, 但已確認之連帶邊仍在 → 仍刪該邊(不留孤兒邊)', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        w.vm.setSelectedNodes(['1'])
        const p = w.vm.deleteSelectedElements()
        //他途只移除節點 1, 其相鄰邊 e1-2 仍留在圖中
        w.vm.nodes.splice(0, 1)
        d.resolve(true)
        expect(await p).toBe(true)
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        const ev = w.emitted('elements-deleted')
        expect(ev).toHaveLength(1)
        expect(ev[0][0].deleted.nodeIds).toEqual([])
        expect(ev[0][0].deleted.connIds).toEqual(['e1-2'])
        expect(ev[0][0].notFound.nodeIds).toEqual(['1'])
        expect(ev[0][0].cascades).toEqual([{ nodeId: '1', connIds: ['e1-2'] }])
        w.destroy()
    })

    test('刪除鍵: 節點與其連帶邊皆於確認期間消失 → not-found, 不發事件', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        w.vm.setSelectedNodes(['1'])
        const p = w.vm.deleteSelectedElements()
        w.vm.nodes.splice(0, 1)
        w.vm.conns.splice(0, 1)
        d.resolve(true)
        expect(await p).toBe(false)
        expect(w.emitted('elements-deleted')).toBeFalsy()
        w.destroy()
    })
})

describe('D7 await 期間元件被銷毀: 不再操作狀態', () => {
    test('銷毀後回覆 true 亦不刪除', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        const p = w.vm.onNodeSettingsDelete({ node: { id: '1' } })
        w.destroy()
        d.resolve(true)
        expect(await p).toBe(false)
        expect(w.emitted('elements-deleted')).toBeFalsy()
    })
})

describe('D8/D9 deletable:false 之排除與 elements-deleted payload', () => {
    test('deletable:false 不進 payload 亦不被刪; elements-deleted 只含實際被刪者', async () => {
        const seen = []
        const opt = mkOpt({ funConfirmDeleting: async (p) => { seen.push(p); return true } })
        opt.nodes[0].deletable = false //節點1 不可刪
        const w = mountFlow(opt)
        w.vm.setSelectedNodes(['1', '2'])
        expect(await w.vm.deleteSelectedElements()).toBe(true)
        //確認 payload 不含不可刪之節點1
        expect(seen[0].nodes.map(n => n.id)).toEqual(['2'])
        //實際只刪節點2(及其連帶邊)
        expect(w.vm.nodes.map(n => n.id)).toEqual(['1', '3'])
        const ev = w.emitted('elements-deleted')
        expect(ev).toHaveLength(1)
        expect(ev[0][0].deleted.nodes.map(n => n.id)).toEqual(['2'])
        w.destroy()
    })

    test('全部選取皆 deletable:false: 不呼叫 callback 亦不發事件', async () => {
        let calls = 0
        const opt = mkOpt({ funConfirmDeleting: async () => { calls++; return true } })
        opt.nodes[0].deletable = false
        const w = mountFlow(opt)
        w.vm.setSelectedNodes(['1'])
        expect(await w.vm.deleteSelectedElements()).toBe(false)
        expect(calls).toBe(0)
        expect(w.emitted('elements-deleted')).toBeFalsy()
        w.destroy()
    })
})
