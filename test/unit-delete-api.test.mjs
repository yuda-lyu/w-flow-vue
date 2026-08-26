/**
 * 公開刪除 API 與統一刪除事件之驗收(WFlowVue.vue 檔頭「Deleting」節)。
 *
 * 規格:
 * A1 deleteElements/deleteNodes/deleteConns 公開; 刪節點自動連帶相鄰邊; 回傳 { ok:true, ...payload }。
 * A2 四路徑(節點表單/連線表單/刪除鍵/API)皆發 elements-deleted, payload 形狀一致, from 正確。
 * A3 事件順序: 各入口既有序列原樣保留, elements-deleted 最後發出。
 * A4 API: 僅對實際變動之集合發 update:*。
 * A5 回傳 reason: empty / not-found / excluded / busy / cancelled / confirm-error / destroyed / stale。
 * A6 deletable:false: API 與刪除鍵歸 excluded; 節點/連線表單之刪除鈕 disabled 且入口回 false;
 *    但作為被刪節點之相鄰邊時仍連帶刪除(完整性優先)。
 * A7 locked 不擋 API。
 * A8 opt.confirm=false 靜默刪除(不呼叫 funConfirmDeleting); opt.from 自訂字串透傳至閘門與事件。
 * A9 type 變更移除不相容連線: 發 node-settings-update → update:conns → elements-deleted(from='node-type-change'); 不經閘門。
 * A10 快照深複製: 宿主改動 payload 不影響畫布; deleted.nodes/conns 為被刪當下內容。
 * A11 輔助狀態回收: nodeInternals / dragPositions 之被刪 key 移除; 選取清單移除被刪 id。
 * A12 await 期間新增相鄰邊 → stale, 不刪、不發事件。
 * A13 重複 id 於載入時 console.warn(同組只一次)。
 * A14 低階 removeNode/removeConn 相容保留: 行為與回傳不變(不發事件)。
 */
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
const deferred = () => {
    let resolve
    const promise = new Promise(r => { resolve = r })
    return { promise, resolve }
}
const PAYLOAD_KEYS = ['from', 'requested', 'deleted', 'cascades', 'notFound', 'excluded'].sort()
const shapeOf = (p) => Object.keys(p).sort()
//事件序列(只取與刪除相關者)
const seq = (w) => {
    const names = ['delete', 'update:nodes', 'update:conns', 'node-settings-delete', 'conn-settings-delete', 'elements-deleted', 'node-settings-update']
    const out = []
    for (const n of names) {
        const ev = w.emitted(n)
        if (ev) ev.forEach((args, i) => out.push({ n, order: w.vm.__seqIndex[n][i] }))
    }
    return out.sort((a, b) => a.order - b.order).map(x => x.n)
}
//以 $emit 攔截記錄全域順序(test-utils 之 emitted 不含跨事件順序)
const trackOrder = (w) => {
    const orig = w.vm.$emit.bind(w.vm)
    w.vm.__seqIndex = {}
    let k = 0
    w.vm.$emit = (name, ...args) => {
        if (!w.vm.__seqIndex[name]) w.vm.__seqIndex[name] = []
        w.vm.__seqIndex[name].push(k++)
        return orig(name, ...args)
    }
}

describe('A1 公開 API 基本行為', () => {
    test('deleteNodes 連帶相鄰邊; 回傳 ok 與 payload', async () => {
        const w = mountFlow(mkOpt())
        const r = await w.vm.deleteNodes(['2'])
        expect(r.ok).toBe(true)
        expect(r.from).toBe('api')
        expect(r.deleted.nodeIds).toEqual(['2'])
        expect(r.deleted.connIds.sort()).toEqual(['e1-2', 'e2-3'])
        expect(r.cascades).toEqual([{ nodeId: '2', connIds: ['e1-2', 'e2-3'] }])
        expect(w.vm.nodes.map(n => n.id)).toEqual(['1', '3'])
        expect(w.vm.conns).toHaveLength(0)
        w.destroy()
    })
    test('deleteConns 只刪指定連線; deleteElements 混合', async () => {
        const w = mountFlow(mkOpt())
        const r1 = await w.vm.deleteConns(['e1-2'])
        expect(r1.ok).toBe(true)
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        const r2 = await w.vm.deleteElements({ nodeIds: ['1'], connIds: ['e2-3'] })
        expect(r2.deleted.nodeIds).toEqual(['1'])
        expect(r2.deleted.connIds).toEqual(['e2-3'])
        expect(r2.cascades).toEqual([])
        w.destroy()
    })
})

describe('A2/A3 四路徑皆發 elements-deleted, 形狀一致, 既有順序保留且新事件最後', () => {
    test('節點表單', async () => {
        const w = mountFlow(mkOpt())
        trackOrder(w)
        await w.vm.onNodeSettingsDelete({ node: { id: '2' } })
        expect(seq(w)).toEqual(['update:nodes', 'update:conns', 'node-settings-delete', 'elements-deleted'])
        const p = w.emitted('elements-deleted')[0][0]
        expect(shapeOf(p)).toEqual(PAYLOAD_KEYS)
        expect(p.from).toBe('node-settings')
        expect(p.deleted.connIds.sort()).toEqual(['e1-2', 'e2-3'])
        //既有窄事件 payload 不變
        const legacy = w.emitted('node-settings-delete')[0][0]
        expect(legacy.node.id).toBe('2')
        expect(legacy.conns.map(c => c.id).sort()).toEqual(['e1-2', 'e2-3'])
        w.destroy()
    })
    test('連線表單', async () => {
        const w = mountFlow(mkOpt())
        trackOrder(w)
        await w.vm.onConnSettingsDelete({ conn: { id: 'e1-2' } })
        expect(seq(w)).toEqual(['update:conns', 'conn-settings-delete', 'elements-deleted'])
        const p = w.emitted('elements-deleted')[0][0]
        expect(shapeOf(p)).toEqual(PAYLOAD_KEYS)
        expect(p.from).toBe('conn-settings')
        expect(p.deleted).toMatchObject({ nodeIds: [], connIds: ['e1-2'] })
        expect(w.emitted('conn-settings-delete')[0][0].conn.id).toBe('e1-2')
        w.destroy()
    })
    test('刪除鍵', async () => {
        const w = mountFlow(mkOpt())
        trackOrder(w)
        w.vm.setSelectedNodes(['1'])
        await w.vm.deleteSelectedElements()
        expect(seq(w)).toEqual(['delete', 'update:nodes', 'update:conns', 'elements-deleted'])
        const p = w.emitted('elements-deleted')[0][0]
        expect(shapeOf(p)).toEqual(PAYLOAD_KEYS)
        expect(p.from).toBe('delete-key')
        expect(p.deleted.connIds).toEqual(['e1-2'])
        expect(w.vm.selectedNodes).toEqual([])
        w.destroy()
    })
    test('API(A4: 僅實際變動之集合發 update:*)', async () => {
        const w = mountFlow(mkOpt())
        trackOrder(w)
        await w.vm.deleteConns(['e1-2'])
        expect(seq(w)).toEqual(['update:conns', 'elements-deleted'])
        expect(w.emitted('update:nodes')).toBeFalsy()
        const p = w.emitted('elements-deleted')[0][0]
        expect(shapeOf(p)).toEqual(PAYLOAD_KEYS)
        expect(p.from).toBe('api')
        w.destroy()
    })
    test('API 刪節點: update:nodes → update:conns → elements-deleted', async () => {
        const w = mountFlow(mkOpt())
        trackOrder(w)
        await w.vm.deleteNodes(['1'])
        expect(seq(w)).toEqual(['update:nodes', 'update:conns', 'elements-deleted'])
        w.destroy()
    })
})

describe('A5 回傳 reason', () => {
    test('empty / not-found / excluded', async () => {
        const opt = mkOpt()
        opt.nodes[0].deletable = false
        const w = mountFlow(opt)
        expect(await w.vm.deleteElements({})).toEqual({ ok: false, reason: 'empty' })
        expect(await w.vm.deleteElements()).toEqual({ ok: false, reason: 'empty' })
        const nf = await w.vm.deleteNodes(['x', 'y'])
        expect(nf.ok).toBe(false)
        expect(nf.reason).toBe('not-found')
        expect(nf.notFound.nodeIds).toEqual(['x', 'y'])
        const ex = await w.vm.deleteElements({ nodeIds: ['1', 'zzz'] })
        expect(ex.reason).toBe('excluded')
        expect(ex.excluded.nodeIds).toEqual(['1'])
        expect(ex.notFound.nodeIds).toEqual(['zzz'])
        expect(w.vm.nodes).toHaveLength(3)
        expect(w.emitted('elements-deleted')).toBeFalsy()
        w.destroy()
    })
    test('部分存在: ok:true 且同時帶 notFound', async () => {
        const w = mountFlow(mkOpt())
        const r = await w.vm.deleteNodes(['3', 'nope'])
        expect(r.ok).toBe(true)
        expect(r.notFound.nodeIds).toEqual(['nope'])
        expect(r.requested.nodeIds).toEqual(['3', 'nope'])
        w.destroy()
    })
    test('cancelled / confirm-error / busy', async () => {
        const w = mountFlow(mkOpt({ funConfirmDeleting: async () => false }))
        expect(await w.vm.deleteNodes(['1'])).toEqual({ ok: false, reason: 'cancelled' })
        expect(w.vm.nodes).toHaveLength(3)
        w.destroy()

        const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const w2 = mountFlow(mkOpt({ funConfirmDeleting: async () => { throw new Error('boom') } }))
        expect(await w2.vm.deleteNodes(['1'])).toEqual({ ok: false, reason: 'confirm-error' })
        spy.mockRestore()
        w2.destroy()

        const d = deferred()
        const w3 = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        const p1 = w3.vm.deleteNodes(['1'])
        expect(await w3.vm.deleteNodes(['2'])).toEqual({ ok: false, reason: 'busy' })
        d.resolve(true)
        expect((await p1).ok).toBe(true)
        w3.destroy()
    })
    test('destroyed', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        const p = w.vm.deleteNodes(['1'])
        w.destroy()
        d.resolve(true)
        expect(await p).toEqual({ ok: false, reason: 'destroyed' })
    })
    test('await 期間目標全數消失 → not-found, 不發事件', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        const p = w.vm.deleteConns(['e1-2'])
        w.vm.removeConn('e1-2')
        d.resolve(true)
        const r = await p
        expect(r.reason).toBe('not-found')
        expect(w.emitted('elements-deleted')).toBeFalsy()
        w.destroy()
    })
})

describe('A6 deletable:false', () => {
    test('API/刪除鍵歸 excluded; 表單入口回 false 且不呼叫閘門', async () => {
        let calls = 0
        const opt = mkOpt({ funConfirmDeleting: async () => { calls++; return true } })
        opt.nodes[0].deletable = false
        opt.conns[1].deletable = false
        const w = mountFlow(opt)
        expect(await w.vm.onNodeSettingsDelete({ node: { id: '1' } })).toBe(false)
        expect(await w.vm.onConnSettingsDelete({ conn: { id: 'e2-3' } })).toBe(false)
        expect(calls).toBe(0)
        expect(w.vm.nodes).toHaveLength(3)
        expect(w.vm.conns).toHaveLength(2)
        expect(w.emitted('elements-deleted')).toBeFalsy()
        const r = await w.vm.deleteElements({ nodeIds: ['1', '3'], connIds: ['e2-3'] })
        expect(r.ok).toBe(true)
        expect(r.excluded.nodeIds).toEqual(['1'])
        //e2-3 直接指定被擋, 但為節點3之相鄰邊 → 仍連帶刪, 不列 excluded
        expect(r.excluded.connIds).toEqual([])
        expect(r.deleted.connIds).toEqual(['e2-3'])
        expect(w.vm.nodes.map(n => n.id)).toEqual(['1', '2'])
        w.destroy()
    })
    test('表單刪除鈕於 deletable:false 時 disabled', () => {
        const provide = { getDeleteConfirming: () => false }
        const nf = mount(NodeSettingsForm, { propsData: { node: { id: '1', type: 'basic', deletable: false }, defNode: {} }, provide })
        const cf = mount(ConnSettingsForm, { propsData: { conn: { id: 'e', from: '1', to: '2', deletable: false }, defConn: {} }, provide })
        expect(nf.find('.vue-flow__delete-btn').attributes('disabled')).toBe('disabled')
        expect(cf.find('.vue-flow__delete-btn').attributes('disabled')).toBe('disabled')
        nf.destroy()
        cf.destroy()
    })
})

describe('A7/A8 locked 不擋 API; confirm:false 靜默; from 自訂', () => {
    test('locked 下 API 仍可刪', async () => {
        const w = mountFlow(mkOpt({ locked: true }))
        expect(w.vm.locked).toBe(true)
        expect((await w.vm.deleteNodes(['1'])).ok).toBe(true)
        w.destroy()
    })
    test('confirm:false 不呼叫閘門; from 透傳', async () => {
        const seen = []
        const w = mountFlow(mkOpt({ funConfirmDeleting: async (p) => { seen.push(p); return true } }))
        const r = await w.vm.deleteNodes(['1'], { confirm: false, from: 'my-batch' })
        expect(seen).toHaveLength(0)
        expect(r.from).toBe('my-batch')
        expect(w.emitted('elements-deleted')[0][0].from).toBe('my-batch')
        const r2 = await w.vm.deleteNodes(['2'], { from: 'undo-stack' })
        expect(seen[0].from).toBe('undo-stack')
        expect(seen[0].nodes.map(n => n.id)).toEqual(['2'])
        expect(seen[0].conns.map(c => c.id)).toEqual(['e2-3'])
        expect(r2.ok).toBe(true)
        w.destroy()
    })
})

describe('A9 type 變更移除不相容連線', () => {
    test('發 node-settings-update → update:conns → elements-deleted(node-type-change), 不經閘門', async () => {
        let calls = 0
        const w = mountFlow(mkOpt({ funConfirmDeleting: async () => { calls++; return true } }))
        trackOrder(w)
        w.vm.onNodeSettingsUpdate({ node: { id: '2' }, key: 'type', value: 'input' })
        expect(calls).toBe(0)
        expect(seq(w)).toEqual(['node-settings-update', 'update:conns', 'elements-deleted'])
        const p = w.emitted('elements-deleted')[0][0]
        expect(shapeOf(p)).toEqual(PAYLOAD_KEYS)
        expect(p.from).toBe('node-type-change')
        expect(p.deleted.connIds).toEqual(['e1-2'])
        expect(p.cascades).toEqual([{ nodeId: '2', connIds: ['e1-2'] }])
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        expect(w.vm.nodes[1].type).toBe('input')
        w.destroy()
    })
    test('無不相容連線時只發 node-settings-update', () => {
        const w = mountFlow(mkOpt())
        w.vm.onNodeSettingsUpdate({ node: { id: '1' }, key: 'type', value: 'input' })
        expect(w.emitted('update:conns')).toBeFalsy()
        expect(w.emitted('elements-deleted')).toBeFalsy()
        w.destroy()
    })
})

describe('A10 快照深複製', () => {
    test('宿主改動 payload 不影響畫布; 快照為被刪當下內容', async () => {
        const w = mountFlow(mkOpt())
        const r = await w.vm.deleteNodes(['1'])
        expect(r.deleted.nodes[0]).toEqual({ id: '1', type: 'basic', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 })
        r.deleted.nodes[0].name = 'HACK'
        r.deleted.conns[0].from = 'HACK'
        //剩餘資料不受影響, 且事件與回傳為同一份快照(同一 payload)
        expect(w.vm.nodes.find(n => n.name === 'HACK')).toBeUndefined()
        expect(w.vm.conns.map(c => c.id)).toEqual(['e2-3'])
        w.destroy()
    })
})

describe('A11 輔助狀態回收', () => {
    test('nodeInternals / dragPositions / 選取清單移除被刪 id', async () => {
        const w = mountFlow(mkOpt())
        w.vm.updateNodeInternals('2', { width: 10, height: 10 })
        expect('2' in w.vm.nodeInternals).toBe(true)
        expect('2' in w.vm.dragPositions).toBe(true)
        w.vm.setSelectedNodes(['1', '2'])
        w.vm.setSelectedConns(['e2-3'])
        await w.vm.deleteNodes(['2'])
        expect('2' in w.vm.nodeInternals).toBe(false)
        expect('2' in w.vm.dragPositions).toBe(false)
        //API 之選取政策為僅移除被刪 id(非清空)
        expect(w.vm.selectedNodes).toEqual(['1'])
        expect(w.vm.selectedConns).toEqual([])
        w.destroy()
    })
})

describe('A12 await 期間新增相鄰邊 → stale', () => {
    test('不刪、不發事件、回 stale', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        const p = w.vm.deleteNodes(['1'])
        //等待期間宿主新增一條連到節點1之邊(未在確認 payload 內)
        w.vm.conns.push({ id: 'e3-1', from: '3', to: '1' })
        d.resolve(true)
        const r = await p
        expect(r).toEqual({ ok: false, reason: 'stale' })
        expect(w.vm.nodes).toHaveLength(3)
        expect(w.vm.conns).toHaveLength(3)
        expect(w.emitted('elements-deleted')).toBeFalsy()
        expect(w.emitted('update:nodes')).toBeFalsy()
        w.destroy()
    })
    test('await 期間部分目標消失: 只刪剩餘, notFound 併入', async () => {
        const d = deferred()
        const w = mountFlow(mkOpt({ funConfirmDeleting: () => d.promise }))
        const p = w.vm.deleteNodes(['1', '3'])
        w.vm.removeNode('3')
        d.resolve(true)
        const r = await p
        expect(r.ok).toBe(true)
        expect(r.deleted.nodeIds).toEqual(['1'])
        expect(r.notFound.nodeIds).toEqual(['3'])
        w.destroy()
    })
})

describe('A13 重複 id 警告', () => {
    test('載入時 console.warn, 同組只一次', async () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
        //Vue 對重複 :key 亦會 console.error(Duplicate keys), 屬同一資料錯誤之下游現象, 靜音以保持測試輸出乾淨
        const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const opt = mkOpt()
        opt.nodes.push({ id: '1', type: 'basic', name: 'dup', position: { x: 0, y: 0 } })
        const w = mountFlow(opt)
        await w.vm.$nextTick()
        const hits = spy.mock.calls.filter(c => String(c[0]).includes('duplicate nodes id'))
        expect(hits).toHaveLength(1)
        expect(String(hits[0][0])).toContain('1')
        spy.mockRestore()
        errSpy.mockRestore()
        w.destroy()
    })
})

describe('A14 低階 removeNode/removeConn 相容保留', () => {
    test('removeNode 回傳連帶邊、清選取、不發事件; removeConn 同', () => {
        const w = mountFlow(mkOpt())
        w.vm.setSelectedNodes(['2'])
        w.vm.setSelectedConns(['e1-2'])
        const removed = w.vm.removeNode('2')
        expect(removed.map(c => c.id).sort()).toEqual(['e1-2', 'e2-3'])
        expect(w.vm.nodes.map(n => n.id)).toEqual(['1', '3'])
        expect(w.vm.selectedNodes).toEqual([])
        expect(w.vm.selectedConns).toEqual([])
        expect(w.vm.removeNode('nope')).toEqual([])
        expect(w.emitted('elements-deleted')).toBeFalsy()
        expect(w.emitted('update:nodes')).toBeFalsy()
        w.destroy()
    })
    test('removeNode 不套 deletable 政策: deletable:false 節點指定即刪且連帶相鄰邊(不留孤兒邊)', () => {
        const opt = mkOpt()
        opt.nodes[1].deletable = false
        const w = mountFlow(opt)
        const removed = w.vm.removeNode('2')
        expect(removed.map(c => c.id).sort()).toEqual(['e1-2', 'e2-3'])
        expect(w.vm.nodes.map(n => n.id)).toEqual(['1', '3'])
        expect(w.vm.conns).toHaveLength(0)
        w.destroy()
    })
})
