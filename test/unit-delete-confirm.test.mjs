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
 * D6 await 期間目標已被他途刪除: 不再刪除, 不發事件(以 id 重新解析目標)。
 * D7 await 期間元件被銷毀: 不再操作狀態。
 * D8 deletable:false 之元素自始排除於確認 payload 與刪除之外。
 * D9 delete 事件之 payload 只含實際被刪者。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'

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
        expect(w.emitted('node-settings-delete')).toHaveLength(1)
        w.destroy()
    })

    test('連線設定表單刪除', async () => {
        const w = mountFlow(mkOpt())
        await w.vm.onConnSettingsDelete({ conn: { id: 'e1-2' } })
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        expect(w.emitted('conn-settings-delete')).toHaveLength(1)
        w.destroy()
    })

    test('刪除鍵刪除選取元素', async () => {
        const w = mountFlow(mkOpt())
        w.vm.setSelectedNodes(['1'])
        expect(await w.vm.deleteSelectedElements()).toBe(true)
        expect(w.vm.nodes.map(n => n.id)).toEqual(['2', '3'])
        expect(w.emitted('delete')).toHaveLength(1)
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
        expect(w.emitted('node-settings-delete')).toBeFalsy()
        expect(w.emitted('update:nodes')).toBeFalsy()

        w.vm.setSelectedNodes(['1'])
        expect(await w.vm.deleteSelectedElements()).toBe(false)
        expect(w.vm.nodes).toHaveLength(3)
        expect(w.emitted('delete')).toBeFalsy()
        w.destroy()
    })
})

describe('D4 callback 拋錯: 不刪, 錯誤不被靜默吞掉', () => {
    test('拋錯視為不准刪除', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const w = mountFlow(mkOpt({ funConfirmDeleting: async () => { throw new Error('host boom') } }))
        expect(await w.vm.onConnSettingsDelete({ conn: { id: 'e1-2' } })).toBe(false)
        expect(w.vm.conns).toHaveLength(2)
        expect(w.emitted('conn-settings-delete')).toBeFalsy()
        expect(spy).toHaveBeenCalled()
        //閘門旗標須於拋錯後釋放(finally), 否則此後所有刪除都被誤擋
        expect(w.vm._deleteConfirming).toBe(false)
        spy.mockRestore()
        w.destroy()
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
        expect(w.emitted('node-settings-delete')).toHaveLength(1) //只發一次
        w.destroy()
    })
})

describe('D6 await 期間目標已消失: 不刪不發事件', () => {
    test('確認回覆前該連線已被他途刪除', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        const p = w.vm.onConnSettingsDelete({ conn: { id: 'e1-2' } })
        //宿主尚未回覆期間, 該連線已由他途移除
        w.vm.removeConn('e1-2')
        d.resolve(true)
        expect(await p).toBe(false)
        expect(w.emitted('conn-settings-delete')).toBeFalsy()
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        w.destroy()
    })

    test('刪除鍵: 選取之節點於確認期間已消失', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        w.vm.setSelectedNodes(['1'])
        const p = w.vm.deleteSelectedElements()
        w.vm.removeNode('1')
        d.resolve(true)
        expect(await p).toBe(false)
        expect(w.emitted('delete')).toBeFalsy()
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
        expect(w.emitted('node-settings-delete')).toBeFalsy()
    })
})

describe('D8/D9 deletable:false 之排除與 delete 事件 payload', () => {
    test('deletable:false 不進 payload 亦不被刪; delete 事件只含實際被刪者', async () => {
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
        const ev = w.emitted('delete')
        expect(ev).toHaveLength(1)
        expect(ev[0][0].nodes.map(n => n.id)).toEqual(['2'])
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
        expect(w.emitted('delete')).toBeFalsy()
        w.destroy()
    })
})
