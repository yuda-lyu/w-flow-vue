/**
 * 設定表單可改文字(WFlowVue JSDoc「Settings Popup」節):
 * T1 預設: 節點/連線刪除鈕 'Delete'; 色票(WColorSelect)確認鈕 btnText 'Confirm'。
 * T2 opt.nodesSettingsDeleteText / connsSettingsDeleteText / settingsColorConfirmText 可改(中文亦可); 非字串/空字串回退預設。
 * T3 連線表單兩端箭頭欄位標籤為 From Marker / To Marker(+ Size / Color)。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeSettingsForm from '../src/components/ui/NodeSettingsForm.vue'
import ConnSettingsForm from '../src/components/ui/ConnSettingsForm.vue'
import { SHAPES } from '../src/js/nodeStyle.mjs'
import WColorSelect from 'w-component-vue/src/components/WColorSelect.vue'

const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })
const base = {
    nodes: [
        { id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: 'b', name: 'B', position: { x: 300, y: 200 }, width: 100, height: 40 },
    ],
    conns: [{ id: 'e', from: 'a', to: 'b', markerTo: 'arrowclosed' }],
}
const openForms = async (w) => {
    w.vm.$refs.nodeRenderer.$refs.wrappers[0].settingsPopupShow = true
    w.vm.$refs.edgeRenderer.$refs.wrappers[0].settingsPopupShow = true
    await w.vm.$nextTick(); await w.vm.$nextTick()
    return { nf: w.findComponent(NodeSettingsForm), cf: w.findComponent(ConnSettingsForm) }
}

describe('T1 預設文字', () => {
    test('刪除鈕 Delete, 色票確認鈕 Confirm', async () => {
        const w = mountFlow(base)
        await w.vm.$nextTick()
        const { nf, cf } = await openForms(w)
        expect(nf.find('.vue-flow__delete-btn').text()).toBe('Delete')
        expect(cf.find('.vue-flow__delete-btn').text()).toBe('Delete')
        for (const f of [nf, cf]) {
            const pickers = f.findAllComponents(WColorSelect)
            expect(pickers.length).toBeGreaterThan(0)
            pickers.wrappers.forEach(p => expect(p.props('btnText')).toBe('Confirm'))
        }
        w.destroy()
    })
})

describe('T2 opt 可改', () => {
    test('中文文字注入; 非字串回退', async () => {
        const w = mountFlow({ ...base, nodesSettingsDeleteText: '刪除節點', connsSettingsDeleteText: '刪除連接線', settingsColorConfirmText: '確定' })
        await w.vm.$nextTick()
        const { nf, cf } = await openForms(w)
        expect(nf.find('.vue-flow__delete-btn').text()).toBe('刪除節點')
        expect(cf.find('.vue-flow__delete-btn').text()).toBe('刪除連接線')
        expect(cf.findAllComponents(WColorSelect).at(0).props('btnText')).toBe('確定')
        w.destroy()
        const w2 = mountFlow({ ...base, nodesSettingsDeleteText: 123, connsSettingsDeleteText: '', settingsColorConfirmText: null })
        await w2.vm.$nextTick()
        expect(w2.vm.settingsText).toEqual({ nodeDelete: 'Delete', connDelete: 'Delete', colorConfirm: 'Confirm' })
        w2.destroy()
    })
})

describe('T3 箭頭欄位標籤', () => {
    test('From Marker / To Marker(+ Size / Face Color / Edge Color)', () => {
        const w = mount(ConnSettingsForm, { propsData: { conn: { id: 'e', from: 'a', to: 'b', markerFrom: 'arrow', markerTo: 'arrowclosed' }, defConn: {} } })
        const labels = w.findAll('label').wrappers.map(l => l.text().split('\n')[0].trim())
        for (const t of [
            'From Marker', 'From Marker Size', 'From Marker Face Color', 'From Marker Edge Color',
            'To Marker', 'To Marker Size', 'To Marker Face Color', 'To Marker Edge Color',
        ]) {
            expect(labels.some(x => x.startsWith(t))).toBe(true)
        }
        expect(labels.some(x => /^Marker (Start|End)/.test(x))).toBe(false)
        //填色/框色須分列, 不得再出現不分家的舊標籤
        expect(labels.some(x => /^(From|To) Marker Color$/.test(x))).toBe(false)
        w.destroy()
    })
})

describe('T4 形狀選項之顯示文字', () => {
    const shapeItems = () => {
        const w = mount(NodeSettingsForm, { propsData: { node: { id: 'n' }, defNode: {} } })
        const items = w.vm.shapeItems
        w.destroy()
        return items
    }

    test('值域 === nodeStyle.SHAPES(不在表單另抄一份)', () => {
        expect(shapeItems().map(v => v.value)).toEqual(SHAPES)
    })

    test('四向三角形之值皆為具方向性之 kebab(triangle-up 而非 triangle)', () => {
        const vals = shapeItems().map(v => v.value)
        expect(vals).toContain('triangle-up')
        //不得再有無方向的裸 triangle —— 四向理應對稱命名
        expect(vals).not.toContain('triangle')
    })

    test('顯示文字為純文字, 不得含方向符號', () => {
        for (const it of shapeItems()) {
            expect(it.text).not.toMatch(/[▲▶▼◀→←↑↓]/)
        }
    })

    test('顯示文字由值轉寫(kebab → Title Case), 與值一一對應', () => {
        expect(shapeItems()).toEqual([
            { value: 'rectangle', text: 'Rectangle' },
            { value: 'diamond', text: 'Diamond' },
            { value: 'ellipse', text: 'Ellipse' },
            { value: 'triangle-up', text: 'Triangle Up' },
            { value: 'triangle-right', text: 'Triangle Right' },
            { value: 'triangle-down', text: 'Triangle Down' },
            { value: 'triangle-left', text: 'Triangle Left' },
        ])
    })
})
