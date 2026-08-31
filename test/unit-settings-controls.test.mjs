/**
 * 設定表單之控制項封裝(SettingsSelect / SettingsText):
 *   C1 SettingsSelect 之 值 ↔ 項目物件 轉換(對外只進出「值」, 內部才是 WTextSelect 的項目物件)
 *   C2 SettingsSelect 對外事件簽章:只送值, 不送項目物件
 *   C3 SettingsText 收斂 WText 之 (value, err, event) 三參數簽章為只送值
 *   C4 外觀 props 集中於封裝內(呼叫端不得逐處重寫), 且與原生控制項之尺寸對齊
 *
 * why 要有這層封裝: 表單共 7 個下拉 + 4 個文字欄, 外觀 props 若逐處手寫即同一規則手寫 11 次;
 * 且 w-component-vue 之 WTextSelect 以「項目物件」為 value, 與表單持有「值」的模型不同,
 * 轉換若散落各處, 每個欄位都要各自反查一次。
 */
import { mount } from '@vue/test-utils'
import SettingsSelect from '../src/components/ui/SettingsSelect.vue'
import SettingsText from '../src/components/ui/SettingsText.vue'
import WTextSelect from 'w-component-vue/src/components/WTextSelect.vue'
import WText from 'w-component-vue/src/components/WText.vue'

const ITEMS = [
    { value: 'bezier', text: 'Bezier' },
    { value: 'step', text: 'Step' },
    { value: '', text: 'None' },
]
const mountSelect = (propsData = {}) => mount(SettingsSelect, { propsData: { items: ITEMS, value: 'bezier', ...propsData } })

describe('C1 SettingsSelect 之 值 ↔ 項目物件 轉換', () => {
    test('對外傳入值, 對內給 WTextSelect 的是對應之項目物件', () => {
        const w = mountSelect({ value: 'step' })
        expect(w.findComponent(WTextSelect).props('value')).toEqual({ value: 'step', text: 'Step' })
        w.destroy()
    })

    test('空字串亦為合法值(None 選項), 須能對應到項目而非落空', () => {
        const w = mountSelect({ value: '' })
        expect(w.findComponent(WTextSelect).props('value')).toEqual({ value: '', text: 'None' })
        w.destroy()
    })

    test('值不在 items 內時給 null(顯示為空, 不硬湊一個項目)', () => {
        const w = mountSelect({ value: 'nonexistent' })
        expect(w.findComponent(WTextSelect).props('value')).toBeNull()
        w.destroy()
    })

    test('items 原樣下傳, keyText 固定為 text', () => {
        const w = mountSelect()
        expect(w.findComponent(WTextSelect).props('items')).toEqual(ITEMS)
        expect(w.findComponent(WTextSelect).props('keyText')).toBe('text')
        w.destroy()
    })
})

describe('C2 SettingsSelect 對外只送值', () => {
    test('WTextSelect 送出項目物件 → 對外 emit 該項目之值', () => {
        const w = mountSelect()
        w.findComponent(WTextSelect).vm.$emit('input', { value: 'step', text: 'Step' })
        expect(w.emitted('input')[0]).toEqual(['step'])
        w.destroy()
    })

    test('None 選項送出空字串(非 undefined)——與既有 marker 契約一致', () => {
        const w = mountSelect({ value: 'step' })
        w.findComponent(WTextSelect).vm.$emit('input', { value: '', text: 'None' })
        expect(w.emitted('input')[0]).toEqual([''])
        w.destroy()
    })

    test('項目為 null 時送空字串, 不送 undefined', () => {
        const w = mountSelect()
        w.findComponent(WTextSelect).vm.$emit('input', null)
        expect(w.emitted('input')[0]).toEqual([''])
        w.destroy()
    })
})

describe('C3 SettingsText 收斂事件簽章', () => {
    test('WText 之 (value, err, event) 三參數 → 對外只送值', () => {
        const w = mount(SettingsText, { propsData: { value: 'abc' } })
        w.findComponent(WText).vm.$emit('input', 'xyz', null, {})
        expect(w.emitted('input')[0]).toEqual(['xyz'])
        w.destroy()
    })

    test('value 原樣下傳', () => {
        const w = mount(SettingsText, { propsData: { value: '資料來源' } })
        expect(w.findComponent(WText).props('value')).toBe('資料來源')
        w.destroy()
    })

    test('空值不報錯且下傳空字串', () => {
        const w = mount(SettingsText, { propsData: { value: '' } })
        expect(w.findComponent(WText).props('value')).toBe('')
        w.destroy()
    })
})

describe('C4 外觀 props 集中於封裝內', () => {
    test('SettingsSelect: 邊框/圓角/白底/字級由封裝固定, 與原生控制項對齊', () => {
        const w = mountSelect()
        const t = w.findComponent(WTextSelect)
        expect(t.props('borderColor')).toBe('#ccc')
        expect(t.props('borderRadius')).toBe(3)
        expect(t.props('backgroundColor')).toBe('#fff')
        expect(t.props('textFontSize')).toBe('12px')
        //下拉清單之寬度不得由內容自動撐開(否則各欄寬度不一)
        expect(t.props('autoFitMinWidth')).toBe(false)
        expect(t.props('autoFitMaxWidth')).toBe(false)
        w.destroy()
    })

    test('SettingsText: 關掉 WText 預設之底線外觀, 改用四邊框線', () => {
        const w = mount(SettingsText, { propsData: { value: 'a' } })
        const t = w.findComponent(WText)
        expect(t.props('borderColor')).toBe('#ccc')
        expect(t.props('borderRadius')).toBe(3)
        expect(t.props('bottomLineBorderWidth')).toBe(0)
        expect(t.props('bottomLineBorderWidthHover')).toBe(0)
        expect(t.props('bottomLineBorderWidthFocus')).toBe(0)
        w.destroy()
    })

    test('字級可由呼叫端覆寫(供 opt.settingsPopupTextFontSize 之縮放)', () => {
        expect(mountSelect({ fontSize: '16px' }).findComponent(WTextSelect).props('textFontSize')).toBe('16px')
        expect(mount(SettingsText, { propsData: { value: 'a', fontSize: '16px' } }).findComponent(WText).props('textFontSize')).toBe('16px')
    })

    test('兩者皆帶識別 class 供表單 CSS 統一寬度', () => {
        expect(mountSelect().find('.vue-flow__settings-select').exists()).toBe(true)
        expect(mount(SettingsText, { propsData: { value: 'a' } }).find('.vue-flow__settings-text').exists()).toBe(true)
    })
})
