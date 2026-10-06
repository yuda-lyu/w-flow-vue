/**
 * 設定表單之顯示文字 —— 表單與傳遞鏈(spec/流程_互動契約.md §12; opt 層與文字模組見 unit-settings-texts):
 * T1 預設(未給任何文字鍵): 刪除鈕 Delete、色票確認鈕 Confirm、群標題、轉折點 ＋/× 之名稱、座標框 title、空狀態皆為 §12 英文預設
 * T2 opt 文字鍵逐鍵個別傳入 → 表單之同名(去前綴)prop; 節點與連線各自生效、同一群鍵可不同文字; 值非字串 → 預設
 * T3 連線表單兩端箭頭欄位標籤為 From Marker / To Marker(+ Size / Face Color / Edge Color)
 * T4 形狀選項之值域與顯示文字
 * T5 表單之文字 prop(獨立掛載): 每個文字站點皆取自其 prop —— 群標題、欄位標籤、選項(依 §12 選項類別規則)、刪除鈕、
 *    色票確認鈕、＋/× 之 title 與 aria-label、座標框 title、空狀態; 模板內無殘留之字面文字; 每個 prop 皆有站點
 * T6 反應性: 表單 prop 改變、opt 既有鍵賦值、Vue.set 新增鍵皆即時生效
 * T7 誤用之可觀察性(§12): 已移除之 settingsColorConfirmText 點名新鍵且值不生效; 未知鍵與非字串值各列成一則; 同一則只警告一次; 無誤用不警告
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import NodeSettingsForm from '../src/components/ui/NodeSettingsForm.vue'
import ConnSettingsForm from '../src/components/ui/ConnSettingsForm.vue'
import SettingsGroup from '../src/components/ui/SettingsGroup.vue'
import SettingsSelect from '../src/components/ui/SettingsSelect.vue'
import SettingsText from '../src/components/ui/SettingsText.vue'
import { SHAPES } from '../src/js/nodeStyle.mjs'
import { SIDES } from '../src/js/anchorPolicy.mjs'
import { EDGE_TYPES } from '../src/js/edgePath.mjs'
import { MARKER_TYPES } from '../src/js/edgeMarker.mjs'
import WColorSelect from 'w-component-vue/src/components/WColorSelect.vue'
import { NODE_TEXT, CONN_TEXT, propOf, categoryOfField, sentinelProps } from './tools/settingsTextsSpec.mjs'

const mountFlow = (opt) => mount(WFlowVue, { propsData: { opt }, attachTo: document.body })
const base = () => ({
    nodes: [
        { id: 'a', name: 'A', position: { x: 0, y: 0 }, width: 100, height: 40 },
        { id: 'b', name: 'B', position: { x: 300, y: 200 }, width: 100, height: 40 },
    ],
    conns: [{ id: 'e', from: 'a', to: 'b', markerTo: 'arrowclosed' }],
})
const openForms = async (w) => {
    w.vm.$refs.nodeRenderer.$refs.wrappers[0].settingsPopupShow = true
    w.vm.$refs.edgeRenderer.$refs.wrappers[0].settingsPopupShow = true
    await w.vm.$nextTick(); await w.vm.$nextTick()
    return { nf: w.findComponent(NodeSettingsForm), cf: w.findComponent(ConnSettingsForm) }
}
const groupTitles = (f) => f.findAllComponents(SettingsGroup).wrappers.map(g => g.props('title'))
//欄位標籤 = <label> 之第一個文字節點(§12); 轉折點區塊之標籤在其標題列之 span
const fieldLabel = (f, key) => {
    const el = f.element.querySelector(`[data-field-key="${key}"]`)
    if (!el) return null
    if (el.tagName === 'LABEL') return el.childNodes[0].textContent.trim()
    return el.querySelector('.vue-flow__waypoints-head > span').textContent.trim()
}
const pickerTexts = (f) => f.findAllComponents(WColorSelect).wrappers.map(p => p.props('btnText'))
const selectOf = (f, key) => f.findAllComponents(SettingsSelect).wrappers.find(s => s.element.closest('[data-field-key]').getAttribute('data-field-key') === key)

describe('T1 預設文字(未給任何文字鍵)', () => {
    test('刪除鈕 Delete、色票確認鈕 Confirm、群標題與轉折點文字皆為 §12 預設', async () => {
        const w = mountFlow(base())
        await w.vm.$nextTick()
        const { nf, cf } = await openForms(w)
        expect(nf.find('.vue-flow__delete-btn').text()).toBe(NODE_TEXT.nodesSettingsDeleteText)
        expect(cf.find('.vue-flow__delete-btn').text()).toBe(CONN_TEXT.connsSettingsDeleteText)
        for (const f of [nf, cf]) {
            const t = pickerTexts(f)
            expect(t.length).toBeGreaterThan(0)
            t.forEach(x => expect(x).toBe('Confirm'))
        }
        expect(groupTitles(nf)).toEqual(['Basic', 'Appearance', 'Text', 'Advanced'])
        expect(groupTitles(cf)).toEqual(['Basic', 'Path', 'Appearance', 'Arrows', 'Text'])
        //轉折點: 無點時之提示; ＋ 鈕之 title 與 aria-label(圖示鈕之可及名稱)
        expect(cf.find('.vue-flow__waypoints-empty').text()).toBe(CONN_TEXT.connsSettingsPointsTextEmpty)
        const add = cf.find('.vue-flow__waypoints-add')
        expect(add.attributes('title')).toBe(CONN_TEXT.connsSettingsPointsAddBtnTooltip)
        expect(add.attributes('aria-label')).toBe(CONN_TEXT.connsSettingsPointsAddBtnTooltip)
        //新增一點後: × 鈕與座標框之文字
        await add.trigger('click')
        const del = cf.find('.vue-flow__waypoints-del')
        expect(del.attributes('title')).toBe(CONN_TEXT.connsSettingsPointsRemoveBtnTooltip)
        expect(del.attributes('aria-label')).toBe(CONN_TEXT.connsSettingsPointsRemoveBtnTooltip)
        const xy = cf.findAll('.vue-flow__waypoints-row input').wrappers.map(i => i.attributes('title'))
        expect(xy).toEqual([CONN_TEXT.connsSettingsPointsXTooltip, CONN_TEXT.connsSettingsPointsYTooltip])
        expect(cf.find('.vue-flow__waypoints-empty').exists()).toBe(false)
        w.destroy()
    })
})

describe('T2 opt 文字鍵逐鍵個別傳入', () => {
    const nodeKeys = () => ({ nodesSettingsBasicGroupTitle: '節點基本', nodesSettingsTextLabelName: '節點名稱', nodesSettingsShapeTextForRectangle: '矩形', nodesSettingsDeleteText: '刪除節點', nodesSettingsColorConfirmText: '確定' })
    const connKeys = () => ({ connsSettingsBasicGroupTitle: '連線基本', connsSettingsTextLabelName: '連線名稱', connsSettingsMarkerTextForNone: '無', connsSettingsPointsTextEmpty: '無轉折點', connsSettingsDeleteText: '刪除連線', connsSettingsColorConfirmText: '套用' })

    test('每個 opt 文字鍵 → 表單之同名(去前綴)prop; 未給之鍵為英文預設', async () => {
        const w = mountFlow({ ...base(), ...nodeKeys(), ...connKeys() })
        await w.vm.$nextTick()
        const { nf, cf } = await openForms(w)
        for (const [form, table, given] of [[nf, NODE_TEXT, nodeKeys()], [cf, CONN_TEXT, connKeys()]]) {
            for (const k of Object.keys(table)) {
                expect(form.props(propOf(k))).toBe(given[k] !== undefined ? given[k] : table[k])
            }
        }
        w.destroy()
    })

    test('節點與連線各自生效; 同一群鍵 / 欄位鍵於兩個 popup 顯示不同文字', async () => {
        const w = mountFlow({ ...base(), ...nodeKeys(), ...connKeys() })
        await w.vm.$nextTick()
        const { nf, cf } = await openForms(w)
        expect(nf.find('.vue-flow__delete-btn').text()).toBe('刪除節點')
        expect(cf.find('.vue-flow__delete-btn').text()).toBe('刪除連線')
        pickerTexts(nf).forEach(x => expect(x).toBe('確定'))
        pickerTexts(cf).forEach(x => expect(x).toBe('套用'))
        expect(groupTitles(nf)).toEqual(['節點基本', 'Appearance', 'Text', 'Advanced'])
        expect(groupTitles(cf)).toEqual(['連線基本', 'Path', 'Appearance', 'Arrows', 'Text'])
        expect(fieldLabel(nf, 'name')).toBe('節點名稱')
        expect(fieldLabel(cf, 'name')).toBe('連線名稱')
        expect(fieldLabel(nf, 'description')).toBe('Description')
        expect(selectOf(nf, 'shape').props('items')[0]).toEqual({ value: 'rectangle', text: '矩形' })
        expect(selectOf(nf, 'shape').props('items')[1]).toEqual({ value: 'diamond', text: 'Diamond' })
        expect(selectOf(cf, 'markerTo').props('items')[0]).toEqual({ value: '', text: '無' })
        expect(cf.find('.vue-flow__waypoints-empty').text()).toBe('無轉折點')
        w.destroy()
    })

    test('值非字串或空字串 → 該句英文預設', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const w = mountFlow({ ...base(), nodesSettingsDeleteText: 123, nodesSettingsTextLabelName: '', connsSettingsBasicGroupTitle: { zh: '基本' } })
        await w.vm.$nextTick()
        const { nf, cf } = await openForms(w)
        expect(nf.find('.vue-flow__delete-btn').text()).toBe('Delete')
        expect(fieldLabel(nf, 'name')).toBe('Name')
        expect(groupTitles(cf)[0]).toBe('Basic')
        w.destroy()
        warn.mockRestore()
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

describe('T5 表單之文字 prop: 每個文字站點皆取自其 prop', () => {
    //上游元件(色票、下拉、文字框)內部之文字不屬本表單模板, 掃描時略過(其不可覆寫者記於帳本 §8)
    const UPSTREAM = [WColorSelect, SettingsSelect, SettingsText]
    //表單模板自身之可見文字節點與 title / aria-label
    function templateTexts(f) {
        const skip = []
        for (const C of UPSTREAM) skip.push(...f.findAllComponents(C).wrappers.map(c => c.element))
        const out = []
        const walker = document.createTreeWalker(f.element, NodeFilter.SHOW_TEXT)
        let n
        while ((n = walker.nextNode())) {
            const t = n.textContent.trim()
            if (t && !skip.some(el => el.contains(n))) out.push(t)
        }
        for (const el of f.element.querySelectorAll('[title],[aria-label]')) {
            if (skip.some(s => s.contains(el))) continue
            if (el.hasAttribute('title')) out.push(el.getAttribute('title'))
            if (el.hasAttribute('aria-label')) out.push(el.getAttribute('aria-label'))
        }
        return out
    }
    //值域(與文字模組同一來源; 驗「類別 × 值」之選項文字逐一對應)
    const VALUES = { shape: SHAPES, popupDirection: SIDES, type: EDGE_TYPES, position: SIDES, marker: MARKER_TYPES }
    const optionProp = (cat, v) => cat + 'TextFor' + (v === '' ? 'None' : v.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(''))

    test.each([
        ['節點', NodeSettingsForm, { node: { id: 'n' }, defNode: {} }, NODE_TEXT, ['popupDirection', 'shape']],
        ['連線', ConnSettingsForm, { conn: { id: 'e', from: 'a', to: 'b' }, defConn: {} }, CONN_TEXT, ['marker', 'position', 'type']],
    ])('%s表單', async (name, Form, props, table, cats) => {
        const texts = sentinelProps(table)
        const w = mount(Form, { propsData: { ...props, ...texts } })
        const isConn = Form === ConnSettingsForm
        if (isConn) await w.find('.vue-flow__waypoints-add').trigger('click') //使列出現(× 鈕、座標框)
        const seen = new Set()

        //群標題(全部群)
        for (const g of w.findAllComponents(SettingsGroup).wrappers) {
            expect(g.props('title')).toBe('§' + g.props('groupKey') + 'GroupTitle')
            seen.add(g.props('title'))
        }
        //欄位標籤: 每個欄位(data-field-key)之標籤皆為其 textLabel{欄位} prop, 且全部標籤 prop 皆有站點
        const fieldKeys = Array.from(w.element.querySelectorAll('[data-field-key]')).map(el => el.getAttribute('data-field-key'))
        const labelProps = Object.keys(texts).filter(p => p.indexOf('textLabel') === 0)
        expect(fieldKeys.map(k => 'textLabel' + k.charAt(0).toUpperCase() + k.slice(1)).sort()).toEqual(labelProps.sort())
        for (const k of fieldKeys) {
            const p = 'textLabel' + k.charAt(0).toUpperCase() + k.slice(1)
            expect(fieldLabel(w, k)).toBe('§' + p)
            seen.add('§' + p)
        }
        //選項: 每張下拉依「類別 = 欄位鍵之共同字根」取 {類別}TextFor{值} 之 prop; 值序 = 值域模組; 用到之類別 = §12 類別全集
        const usedCats = new Set()
        for (const s of w.findAllComponents(SettingsSelect).wrappers) {
            const field = s.element.closest('[data-field-key]').getAttribute('data-field-key')
            const cat = categoryOfField(field)
            usedCats.add(cat)
            expect(s.props('items')).toEqual(VALUES[cat].map(v => ({ value: v, text: '§' + optionProp(cat, v) })))
            s.props('items').forEach(it => seen.add(it.text))
        }
        expect(Array.from(usedCats).sort()).toEqual(cats)
        //色票確認鈕、刪除鈕
        pickerTexts(w).forEach(t => expect(t).toBe('§colorConfirmText'))
        seen.add('§colorConfirmText')
        expect(w.find('.vue-flow__delete-btn').text()).toBe('§deleteText')
        seen.add('§deleteText')
        //轉折點(連線): ＋/× 之 title 與 aria-label、座標框 title; 移除後之空狀態
        if (isConn) {
            for (const [sel, p] of [['.vue-flow__waypoints-add', 'pointsAddBtnTooltip'], ['.vue-flow__waypoints-del', 'pointsRemoveBtnTooltip']]) {
                expect(w.find(sel).attributes('title')).toBe('§' + p)
                expect(w.find(sel).attributes('aria-label')).toBe('§' + p)
                seen.add('§' + p)
            }
            expect(w.findAll('.vue-flow__waypoints-row input').wrappers.map(i => i.attributes('title'))).toEqual(['§pointsXTooltip', '§pointsYTooltip'])
            seen.add('§pointsXTooltip'); seen.add('§pointsYTooltip')
            //模板無殘留字面文字: 自身文字節點與 title / aria-label 只剩覆寫值、序號與 ＋ / × 符號
            for (const t of templateTexts(w)) expect(t).toMatch(/^(§.+|\d+|＋|×)$/)
            await w.find('.vue-flow__waypoints-del').trigger('click')
            expect(w.find('.vue-flow__waypoints-empty').text()).toBe('§pointsTextEmpty')
            seen.add('§pointsTextEmpty')
        }
        for (const t of templateTexts(w)) expect(t).toMatch(/^(§.+|\d+|＋|×)$/)
        //每個文字 prop 皆有站點(無「開了 prop 卻沒用到」者)
        expect(Array.from(seen).sort()).toEqual(Object.values(texts).sort())
        w.destroy()
    })
})

describe('T6 反應性', () => {
    test('表單: 文字 prop 改變即時生效; 改為空字串回到預設', async () => {
        const w = mount(NodeSettingsForm, { propsData: { node: { id: 'n' }, defNode: {}, textLabelName: '名稱', shapeTextForEllipse: '橢圓' } })
        expect(fieldLabel(w, 'name')).toBe('名稱')
        expect(selectOf(w, 'shape').props('items')[2]).toEqual({ value: 'ellipse', text: '橢圓' })
        await w.setProps({ textLabelName: '名字', deleteText: '移除' })
        expect(fieldLabel(w, 'name')).toBe('名字')
        expect(w.find('.vue-flow__delete-btn').text()).toBe('移除')
        await w.setProps({ textLabelName: '' })
        expect(fieldLabel(w, 'name')).toBe('Name')
        w.destroy()
    })

    test('WFlowVue: opt 既有鍵賦值、Vue.set 新增鍵 → 已開啟之表單即時更新', async () => {
        const opt = { ...base(), nodesSettingsDeleteText: 'A' }
        const w = mountFlow(opt)
        await w.vm.$nextTick()
        const { nf, cf } = await openForms(w)
        expect(nf.find('.vue-flow__delete-btn').text()).toBe('A')
        opt.nodesSettingsDeleteText = 'A2'
        w.vm.$set(opt, 'connsSettingsDeleteText', 'B')
        await w.vm.$nextTick()
        expect(nf.find('.vue-flow__delete-btn').text()).toBe('A2')
        expect(cf.find('.vue-flow__delete-btn').text()).toBe('B')
        w.destroy()
    })
})

describe('T7 誤用之可觀察性', () => {
    let warn
    beforeEach(() => {
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
        warn.mockRestore()
    })
    const messages = () => warn.mock.calls.map(c => c[0])

    test('已移除之 settingsColorConfirmText: 點名新鍵, 值不生效; 同一則只警告一次', async () => {
        const opt = { ...base(), settingsColorConfirmText: '確定' }
        const w = mountFlow(opt)
        await w.vm.$nextTick()
        expect(messages()).toEqual([
            '[w-flow-vue] opt.settingsColorConfirmText has been removed and has no effect; use opt.nodesSettingsColorConfirmText and opt.connsSettingsColorConfirmText instead',
        ])
        const { nf, cf } = await openForms(w)
        pickerTexts(nf).forEach(t => expect(t).toBe('Confirm'))
        pickerTexts(cf).forEach(t => expect(t).toBe('Confirm'))
        //opt 其他變動使檢查重算: 同樣之訊息不再重發
        w.vm.$set(opt, 'nodesSettingsDeleteText', '刪除')
        await w.vm.$nextTick()
        expect(warn).toHaveBeenCalledTimes(1)
        w.destroy()
    })

    test('未知鍵與非字串值各列成一則; 改正後不再新增警告', async () => {
        const opt = { ...base(), nodesSettingsTextLabelNmae: '名', connsSettingsLabels: {}, connsSettingsDeleteText: 1 }
        const w = mountFlow(opt)
        await w.vm.$nextTick()
        expect(messages()).toEqual([
            '[w-flow-vue] unknown opt keys ignored: nodesSettingsTextLabelNmae, connsSettingsLabels',
            '[w-flow-vue] opt texts must be strings, defaults used for: connsSettingsDeleteText',
        ])
        opt.connsSettingsDeleteText = '刪除'
        await w.vm.$nextTick()
        expect(warn).toHaveBeenCalledTimes(2)
        w.destroy()
    })

    test('無誤用 → 不警告(未給文字鍵、合法文字鍵)', async () => {
        const w1 = mountFlow(base())
        const w2 = mountFlow({ ...base(), nodesSettingsBasicGroupTitle: '基本', nodesSettingsShapeTextForRectangle: '矩形', connsSettingsPointsAddBtnTooltip: '新增', connsSettingsMarkerTextForNone: '無' })
        await w1.vm.$nextTick()
        await w2.vm.$nextTick()
        expect(warn).not.toHaveBeenCalled()
        w1.destroy()
        w2.destroy()
    })
})
