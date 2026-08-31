/**
 * 設定表單之屬性分群(spec/流程_互動契約.md §11):
 *   G1 分群定義涵蓋表單全部欄位, 無重複, 陣列順序即呈現順序
 *   G2 visibleGroups 依 excludes 過濾, 整群欄位被排除即不出現(不留空群)
 *   G3 SettingsGroup 之狀態指示: 三角形朝右=收合 / 朝下=展開, 且 aria-expanded 與之一致
 *   G4 整條標題列(非只有三角形)可點, 點擊送出相反之 update:open
 *   G5 表單預設只展開 DEFAULT_OPEN_GROUPS
 *   G6 各群獨立顯隱: 開一群不會關掉別群
 *   G7 excludes 之群層行為: 整群排除該群消失; 部分排除該群仍在
 *   G8 節點/連線兩表單之對稱性: 共用群鍵一致, 刪除區皆不歸入任何群
 */
import { mount } from '@vue/test-utils'
import NodeSettingsForm from '../src/components/ui/NodeSettingsForm.vue'
import ConnSettingsForm from '../src/components/ui/ConnSettingsForm.vue'
import SettingsGroup from '../src/components/ui/SettingsGroup.vue'
import { NODE_SETTING_GROUPS, CONN_SETTING_GROUPS, DEFAULT_OPEN_GROUPS, visibleGroups } from '../src/js/settingsGroups.mjs'
import { isDarkColor } from '../src/components/mixins/settingsForm.mjs'
import { resolveOptValue } from '../src/js/resolveOpt.mjs'

const mountNode = (propsData = {}) => mount(NodeSettingsForm, {
    propsData: { node: { id: 'n1' }, defNode: {}, ...propsData },
})
const mountConn = (propsData = {}) => mount(ConnSettingsForm, {
    propsData: { conn: { id: 'e1', from: 'a', to: 'b' }, defConn: {}, ...propsData },
})
const groupTitles = (w) => w.findAllComponents(SettingsGroup).wrappers.map(g => g.props('title'))

//表單實際擁有之欄位鍵(規格全集; 新增欄位時本清單與分群定義須同步更新, 否則 G1 失敗)
const NODE_FIELDS = ['name', 'description', 'shape', 'faceColor', 'edgeColor', 'edgeWidth', 'fontSize', 'fontColor', 'popupDirection']
const CONN_FIELDS = [
    'name', 'description', 'type', 'fromPosition', 'toPosition', 'points',
    'edgeColor', 'edgeWidth', 'animated',
    'markerFrom', 'markerFromSize', 'markerFromFaceColor', 'markerFromEdgeColor', 'markerTo', 'markerToSize', 'markerToFaceColor', 'markerToEdgeColor',
    'fontSize', 'fontColor',
]

/**
 * 自實際 DOM 反查 欄位鍵 → 群鍵 之映射(欄位帶 data-field-key, 群內容區帶 data-group-key)。
 * 這是欄位歸屬的唯一可信驗證點: 只比對「分群定義」與「另一份手寫清單」會構成假的單一來源——
 * 兩份都是人寫的, 把欄位從 A 群移到 B 群卻不改 template 時仍可能全綠。
 */
function domFieldToGroup(w) {
    const map = {}
    for (const el of w.element.querySelectorAll('[data-field-key]')) {
        const panel = el.closest('[data-group-key]')
        map[el.getAttribute('data-field-key')] = panel ? panel.getAttribute('data-group-key') : null
    }
    return map
}
/** 由分群定義推出的期望映射 */
function defFieldToGroup(groups) {
    const map = {}
    for (const g of groups) for (const f of g.fields) map[f] = g.key
    return map
}

describe('G1 分群定義涵蓋全部欄位且無重複', () => {
    test.each([
        ['節點', NODE_SETTING_GROUPS, NODE_FIELDS],
        ['連線', CONN_SETTING_GROUPS, CONN_FIELDS],
    ])('%s: 各群 fields 之聯集 = 表單欄位全集', (name, groups, all) => {
        const flat = groups.flatMap(g => g.fields)
        expect(flat.slice().sort()).toEqual(all.slice().sort())
        expect(new Set(flat).size).toBe(flat.length) //同一欄位不得歸入兩群
    })

    test.each([
        ['節點', NODE_SETTING_GROUPS, mountNode],
        ['連線', CONN_SETTING_GROUPS, mountConn],
    ])('%s: DOM 實際渲染之 欄位→群 映射 === 分群定義(不是兩份手寫清單互比)', (name, groups, mnt) => {
        const w = mnt()
        const actual = domFieldToGroup(w)
        expect(actual).toEqual(defFieldToGroup(groups))
        //每個欄位都必須真的落在某個群的內容區內(closest 找得到 data-group-key)
        Object.entries(actual).forEach(([f, g]) => expect(g).not.toBeNull())
        w.destroy()
    })

    test.each([
        ['節點', NODE_FIELDS, mountNode],
        ['連線', CONN_FIELDS, mountConn],
    ])('%s: template 未渲染全集以外的欄位, 也沒有漏渲染', (name, all, mnt) => {
        const w = mnt()
        expect(Object.keys(domFieldToGroup(w)).sort()).toEqual(all.slice().sort())
        w.destroy()
    })

    test.each([
        ['節點', NODE_FIELDS, mountNode],
        ['連線', CONN_FIELDS, mountConn],
    ])('%s: 逐鍵 exclude 後該欄位確實自 DOM 消失(證明鍵確實驅動一個真實欄位)', (name, all, mnt) => {
        for (const f of all) {
            const w = mnt({ excludes: [f] })
            const keys = Object.keys(domFieldToGroup(w))
            expect(keys).not.toContain(f)
            expect(keys).toHaveLength(all.length - 1)
            w.destroy()
        }
    })

    test.each([
        ['節點', NODE_SETTING_GROUPS],
        ['連線', CONN_SETTING_GROUPS],
    ])('%s: 群鍵唯一且皆有標題', (name, groups) => {
        const keys = groups.map(g => g.key)
        expect(new Set(keys).size).toBe(keys.length)
        groups.forEach(g => expect(typeof g.title === 'string' && g.title !== '').toBe(true))
    })

    test.each([
        ['節點', NODE_SETTING_GROUPS, mountNode],
        ['連線', CONN_SETTING_GROUPS, mountConn],
    ])('%s: 陣列順序即渲染順序', (name, groups, mnt) => {
        const w = mnt()
        expect(groupTitles(w)).toEqual(groups.map(g => g.title))
        w.destroy()
    })
})

describe('G2 visibleGroups 依 excludes 過濾', () => {
    test('未排除時全數保留(且為同一組物件)', () => {
        expect(visibleGroups(NODE_SETTING_GROUPS, [])).toEqual(NODE_SETTING_GROUPS)
        expect(visibleGroups(NODE_SETTING_GROUPS, undefined)).toEqual(NODE_SETTING_GROUPS)
    })

    test('整群欄位被排除 → 該群不出現', () => {
        const r = visibleGroups(NODE_SETTING_GROUPS, ['name', 'description'])
        expect(r.map(g => g.key)).not.toContain('basic')
        expect(r).toHaveLength(NODE_SETTING_GROUPS.length - 1)
    })

    test('只排除群內部分欄位 → 該群仍在', () => {
        const r = visibleGroups(NODE_SETTING_GROUPS, ['name'])
        expect(r.map(g => g.key)).toContain('basic')
    })
})

describe('G3 三角形朝向即狀態(朝右收合 / 朝下展開), 與 aria-expanded 一致', () => {
    test('收合: 無 --open class, aria-expanded=false, panel 帶 --closed', () => {
        const w = mount(SettingsGroup, { propsData: { title: 'Basic', open: false } })
        expect(w.find('.vue-flow__settings-group-caret').classes()).not.toContain('vue-flow__settings-group-caret--open')
        expect(w.find('.vue-flow__settings-group-head').attributes('aria-expanded')).toBe('false')
        expect(w.find('.vue-flow__settings-group-panel').classes()).toContain('vue-flow__settings-group-panel--closed')
        w.destroy()
    })

    test('展開: 帶 --open class(CSS 轉 90 度朝下), aria-expanded=true, panel 無 --closed', () => {
        const w = mount(SettingsGroup, { propsData: { title: 'Basic', open: true } })
        expect(w.find('.vue-flow__settings-group-caret').classes()).toContain('vue-flow__settings-group-caret--open')
        expect(w.find('.vue-flow__settings-group-head').attributes('aria-expanded')).toBe('true')
        expect(w.find('.vue-flow__settings-group-panel').classes()).not.toContain('vue-flow__settings-group-panel--closed')
        w.destroy()
    })

    test('標題按鈕以 aria-controls 指向內容區, 內容區以 aria-labelledby 指回標題(W3C APG accordion)', () => {
        const w = mount(SettingsGroup, { propsData: { title: 'Basic', open: true } })
        const head = w.find('.vue-flow__settings-group-head')
        const panel = w.find('.vue-flow__settings-group-panel')
        expect(head.attributes('aria-controls')).toBe(panel.attributes('id'))
        expect(panel.attributes('aria-labelledby')).toBe(head.attributes('id'))
        expect(head.attributes('type')).toBe('button')
        expect(panel.attributes('role')).toBe('region')
        w.destroy()
    })

    //APG accordion 明文要求 header button 包在 heading 且帶 aria-level(僅 button + aria-expanded 只達 disclosure)
    test('標題按鈕包在 role="heading" 內並帶 aria-level(APG accordion 之結構要求)', () => {
        const w = mount(SettingsGroup, { propsData: { title: 'Basic', open: true } })
        const head = w.find('.vue-flow__settings-group-head').element
        const heading = head.closest('[role="heading"]')
        expect(heading).not.toBeNull()
        expect(heading.getAttribute('aria-level')).toBe('3')
        w.destroy()
    })

    test('headingLevel 可由宿主指定', () => {
        const w = mount(SettingsGroup, { propsData: { title: 'Basic', open: true, headingLevel: 4 } })
        expect(w.find('[role="heading"]').attributes('aria-level')).toBe('4')
        w.destroy()
    })
})

describe('G4 整條標題列可點', () => {
    test.each([
        ['點三角形', '.vue-flow__settings-group-caret'],
        ['點標題文字', '.vue-flow__settings-group-title'],
        ['點標題列空白處', '.vue-flow__settings-group-head'],
    ])('%s: 該處落在同一顆可點按鈕內, 點擊送出 update:open 為相反值', async (name, sel) => {
        const w = mount(SettingsGroup, { propsData: { title: 'Basic', open: false } })
        const head = w.find('.vue-flow__settings-group-head')
        //三處都必須落在同一顆 <button> 內 —— 瀏覽器之 click 由此冒泡至按鈕, 故三處皆可點
        expect(w.find(sel).element.closest('button')).toBe(head.element)
        await head.trigger('click')
        expect(w.emitted('update:open')).toBeTruthy()
        expect(w.emitted('update:open')[0]).toEqual([true])
        w.destroy()
    })

    test('已展開時點擊送出 false(收合)', async () => {
        const w = mount(SettingsGroup, { propsData: { title: 'Basic', open: true } })
        await w.find('.vue-flow__settings-group-head').trigger('click')
        expect(w.emitted('update:open')[0]).toEqual([false])
        w.destroy()
    })
})

describe('G5 / G6 表單之展開態', () => {
    test.each([
        ['節點', mountNode],
        ['連線', mountConn],
    ])('%s: 預設只展開 DEFAULT_OPEN_GROUPS', (name, mnt) => {
        const w = mnt()
        const gs = w.findAllComponents(SettingsGroup).wrappers
        const openKeys = w.vm.groups.filter(g => w.vm.isGroupOpen(g.key)).map(g => g.key)
        expect(openKeys).toEqual(DEFAULT_OPEN_GROUPS)
        expect(gs.filter(g => g.props('open'))).toHaveLength(DEFAULT_OPEN_GROUPS.length)
        w.destroy()
    })

    test.each([
        ['節點', mountNode],
        ['連線', mountConn],
    ])('%s: 開第二群不會關掉原本展開的群(各群獨立顯隱)', async (name, mnt) => {
        const w = mnt()
        const second = w.vm.groups[1].key
        w.vm.setGroupOpen(second, true)
        await w.vm.$nextTick()
        expect(w.vm.isGroupOpen(second)).toBe(true)
        DEFAULT_OPEN_GROUPS.forEach(k => expect(w.vm.isGroupOpen(k)).toBe(true))
        //再關掉第二群, 原本展開者不受影響
        w.vm.setGroupOpen(second, false)
        await w.vm.$nextTick()
        expect(w.vm.isGroupOpen(second)).toBe(false)
        DEFAULT_OPEN_GROUPS.forEach(k => expect(w.vm.isGroupOpen(k)).toBe(true))
        w.destroy()
    })

    test('defaultOpenGroups prop 可由宿主指定預設展開之群', () => {
        const w = mountNode({ defaultOpenGroups: ['appearance', 'text'] })
        expect(w.vm.isGroupOpen('appearance')).toBe(true)
        expect(w.vm.isGroupOpen('text')).toBe(true)
        expect(w.vm.isGroupOpen('basic')).toBe(false)
        w.destroy()
    })
})

describe('G9 maxHeight(表單高度上限)', () => {
    test.each([
        ['節點', mountNode],
        ['連線', mountConn],
    ])('%s: 給 maxHeight 即設上限並於表單內捲動', (name, mnt) => {
        const w = mnt({ maxHeight: '400px' })
        const s = w.vm.formStyle
        expect(s.maxHeight).toBe('400px')
        expect(s.overflowY).toBe('auto')
        //刻意不用 scrollbar-gutter:stable(不需捲動時也會永遠預留一條無用留白)
        expect(s.scrollbarGutter).toBeUndefined()
        expect(w.find('.vue-flow__settings-form').attributes('style')).toContain('max-height: 400px')
        w.destroy()
    })

    test.each([
        ['節點', mountNode],
        ['連線', mountConn],
    ])('%s: 未給 maxHeight 即不設限, 也不加 overflow', (name, mnt) => {
        const w = mnt()
        expect(w.vm.formStyle.maxHeight).toBeUndefined()
        expect(w.vm.formStyle.overflowY).toBeUndefined()
        w.destroy()
    })

    test('maxHeight 與 textFontSize 可並存', () => {
        const w = mountNode({ maxHeight: '50vh', textFontSize: '13px' })
        expect(w.vm.formStyle).toMatchObject({ maxHeight: '50vh', overflowY: 'auto', fontSize: '13px' })
        w.destroy()
    })

    //空字串是「明確不設限」之合法值; opt 層若用 kind:'truthy' 會把它回退成 '400px' 而使此契約失效
    test('opt.settingsPopupMaxHeight 之空字串保持為空(不回退預設)', () => {
        expect(resolveOptValue({ settingsPopupMaxHeight: '' }, 'settingsPopupMaxHeight')).toBe('')
        expect(resolveOptValue({ settingsPopupMaxHeight: '50vh' }, 'settingsPopupMaxHeight')).toBe('50vh')
        expect(resolveOptValue({}, 'settingsPopupMaxHeight')).toBe('400px')
    })
})

describe('G10 主題適應(群標題之顏色不得硬寫)', () => {
    test.each([
        ['#fff', false], ['#ffffff', false], ['rgb(255,255,255)', false], ['#f7f8f9', false],
        ['#2b2b30', true], ['#000', true], ['rgba(20, 22, 26, 1)', true], ['#333', true],
    ])('isDarkColor(%s) === %s', (css, expected) => {
        expect(isDarkColor(css)).toBe(expected)
    })

    test('認不得的色字串一律視為淺色(不亂猜)', () => {
        ;['', 'rebeccapurple', 'hsl(200 50% 40%)', 'linear-gradient(#fff,#000)', null, undefined, 123].forEach((v) => {
            expect(isDarkColor(v)).toBe(false)
        })
    })

    test.each([
        ['節點', mountNode],
        ['連線', mountConn],
    ])('%s: 淺色底不覆寫疊加色, 只注入分隔線色', (name, mnt) => {
        const w = mnt({ backgroundColor: '#fff' })
        const s = w.vm.formStyle
        expect(s['--vf-settings-bg']).toBe('#fff')
        //淺色維持 CSS 預設值(疊黑), 不由 JS 覆寫
        expect(s['--vf-settings-surface']).toBeUndefined()
        expect(s['--vf-settings-caret']).toBeUndefined()
        w.destroy()
    })

    test.each([
        ['節點', mountNode],
        ['連線', mountConn],
    ])('%s: 深色底改為疊白加亮並改用淺色三角形', (name, mnt) => {
        const w = mnt({ backgroundColor: '#2b2b30' })
        const s = w.vm.formStyle
        expect(s['--vf-settings-bg']).toBe('#2b2b30')
        expect(s['--vf-settings-surface']).toBe('rgba(255, 255, 255, 0.10)')
        expect(s['--vf-settings-surface-hover']).toBe('rgba(255, 255, 255, 0.20)')
        expect(s['--vf-settings-caret']).toBe('rgba(255, 255, 255, 0.72)')
        w.destroy()
    })

    test('未給 backgroundColor 時不注入任何主題變數', () => {
        const s = mountNode().vm.formStyle
        expect(Object.keys(s).some(k => k.startsWith('--vf-settings'))).toBe(false)
    })
})

describe('G11 excludes 之邊界: 預設展開群不可見時', () => {
    test('排除整個 basic 群 → 自動展開第一個可見群(不讓 popup 開啟即全部收合)', () => {
        const w = mountNode({ excludes: ['name', 'description'] })
        expect(w.vm.groups[0].key).toBe('appearance')
        expect(w.vm.isGroupOpen('appearance')).toBe(true)
        expect(w.findAllComponents(SettingsGroup).filter(g => g.props('open'))).toHaveLength(1)
        w.destroy()
    })

    test('只剩一個非 basic 群時, 該群即為展開', () => {
        const w = mountConn({ excludes: [...CONN_FIELDS.filter(f => !['fontSize', 'fontColor'].includes(f))] })
        expect(w.vm.groups.map(g => g.key)).toEqual(['text'])
        expect(w.vm.isGroupOpen('text')).toBe(true)
        w.destroy()
    })

    test('全部欄位被排除 → 無群, 僅剩刪除區(不拋錯)', () => {
        const w = mountNode({ excludes: NODE_FIELDS.slice() })
        expect(w.vm.groups).toHaveLength(0)
        expect(w.findAllComponents(SettingsGroup)).toHaveLength(0)
        expect(w.find('.vue-flow__delete-area').exists()).toBe(true)
        w.destroy()
    })

    test('basic 仍可見時維持原預設(不受本機制影響)', () => {
        const w = mountNode({ excludes: ['name'] })
        expect(w.vm.isGroupOpen('basic')).toBe(true)
        expect(w.findAllComponents(SettingsGroup).filter(g => g.props('open'))).toHaveLength(1)
        w.destroy()
    })
})

describe('G7 excludes 之群層行為(表單)', () => {
    test('節點: 排除整個 basic 群之欄位 → 少一群, 且 Name 欄位消失', () => {
        const w = mountNode({ excludes: ['name', 'description'] })
        expect(groupTitles(w)).not.toContain('Basic')
        expect(w.findAll('input[type="text"]')).toHaveLength(0)
        expect(w.findAllComponents(SettingsGroup)).toHaveLength(NODE_SETTING_GROUPS.length - 1)
        w.destroy()
    })

    test('節點: 只排除 name → Basic 群仍在, 僅剩 Description', () => {
        const w = mountNode({ excludes: ['name'] })
        expect(groupTitles(w)).toContain('Basic')
        expect(w.findAll('input[type="text"]')).toHaveLength(1)
        w.destroy()
    })

    test('連線: 排除整個 arrows 群之欄位 → 少一群', () => {
        const w = mountConn({ excludes: ['markerFrom', 'markerFromSize', 'markerFromFaceColor', 'markerFromEdgeColor', 'markerTo', 'markerToSize', 'markerToFaceColor', 'markerToEdgeColor'] })
        expect(groupTitles(w)).not.toContain('Arrows')
        expect(w.findAllComponents(SettingsGroup)).toHaveLength(CONN_SETTING_GROUPS.length - 1)
        w.destroy()
    })
})

describe('G8 節點/連線兩表單之對稱性', () => {
    test('共用群鍵之標題一致(同一件事在兩個 popup 用同一語彙)', () => {
        const nodeMap = Object.fromEntries(NODE_SETTING_GROUPS.map(g => [g.key, g.title]))
        const connMap = Object.fromEntries(CONN_SETTING_GROUPS.map(g => [g.key, g.title]))
        const shared = Object.keys(nodeMap).filter(k => k in connMap)
        expect(shared).toEqual(expect.arrayContaining(['basic', 'appearance', 'text']))
        shared.forEach(k => expect(nodeMap[k]).toBe(connMap[k]))
    })

    test.each([
        ['節點', mountNode],
        ['連線', mountConn],
    ])('%s: 刪除區為破壞性操作, 不歸入任何群(在群組之外)', (name, mnt) => {
        const w = mnt()
        const del = w.find('.vue-flow__delete-area')
        expect(del.exists()).toBe(true)
        expect(del.element.closest('.vue-flow__settings-group')).toBe(null)
        //且恆為表單最後一列
        expect(w.find('.vue-flow__settings-form').element.lastElementChild).toBe(del.element)
        w.destroy()
    })
})
