/**
 * 設定彈窗之顯示文字 —— opt 層與文字模組之契約(spec/流程_互動契約.md §12; 表單與傳遞鏈見 unit-settings-text):
 * X1 每句文字一個 opt 鍵: 鍵集與英文預設 = §12 表(節點 26、連線 48, 逐一列舉, 無多無少); 皆登記於 OPT_SPEC(kind text)
 * X2 逐鍵回退: 非字串或空字串 → 該鍵預設; 純空白照收; 中文照收; 只影響該鍵
 * X3 命名規則: opt 鍵 = {nodes|conns}Settings + 表單 prop 名; 群標題 {群鍵}GroupTitle、欄位標籤 textLabel{欄位}、
 *    選項 {類別}TextFor{值}(類別 = 欄位共同字根, 值 kebab → PascalCase, 空字串為 None), 鍵集 = settingsGroups 與值域之笛卡兒
 * X4 選項預設文字: 例外表(Smooth Step / Arrow Closed)→ Title Case; 值域新增之值自動有鍵與文字
 * X5 節點與連線各自一組鍵(不共用); 共用語彙之預設相同
 * X6 誤用偵測: 已移除之 settingsColorConfirmText 點名新鍵; 設定類鍵族之未知鍵; 文字鍵之值非字串; 合法 opt 不報; 不讀資料鍵
 */
import { OPT_SPEC, resolveOptValue, collectOptIssues, REMOVED_OPT_KEYS } from '../src/js/resolveOpt.mjs'
import { NODE_SETTINGS_TEXTS, CONN_SETTINGS_TEXTS, settingsTextOptKey, settingsTextProps, resolveSettingsTexts, optionTextProp, defaultOptionText, titleCase, groupTitleProp, fieldLabelProp } from '../src/js/settingsTexts.mjs'
import { NODE_SETTING_GROUPS, CONN_SETTING_GROUPS } from '../src/js/settingsGroups.mjs'
import { SHAPES } from '../src/js/nodeStyle.mjs'
import { SIDES } from '../src/js/anchorPolicy.mjs'
import { EDGE_TYPES } from '../src/js/edgePath.mjs'
import { MARKER_TYPES } from '../src/js/edgeMarker.mjs'
//§12 表之抄本(逐字抄自 spec, 不由被測模組推導)
import { NODE_TEXT, CONN_TEXT, propOf } from './tools/settingsTextsSpec.mjs'

const KINDS = [
    ['節點', 'node', NODE_TEXT, NODE_SETTINGS_TEXTS],
    ['連線', 'conn', CONN_TEXT, CONN_SETTINGS_TEXTS],
]
//模組之「prop 名 → 預設」換成「opt 鍵 → 預設」
const asOptKeys = (kind, texts) => {
    const r = {}
    for (const p of Object.keys(texts)) r[settingsTextOptKey(kind, p)] = texts[p]
    return r
}

describe('X1 每句文字一個 opt 鍵, 鍵集與預設 = §12 表', () => {
    test('鍵數: 節點 26、連線 48', () => {
        expect(Object.keys(NODE_TEXT)).toHaveLength(26)
        expect(Object.keys(CONN_TEXT)).toHaveLength(48)
    })

    test.each(KINDS)('%s: 文字模組產生之鍵與預設 = §12 表(無多無少)', (name, kind, table, texts) => {
        expect(asOptKeys(kind, texts)).toEqual(table)
    })

    test.each(KINDS)('%s: 每個鍵皆登記於 OPT_SPEC(kind text), 未給時解析為 §12 預設', (name, kind, table) => {
        for (const k of Object.keys(table)) {
            expect(OPT_SPEC[k]).toEqual({ kind: 'text', def: table[k] })
            expect(resolveOptValue({}, k)).toBe(table[k])
        }
    })

    test('OPT_SPEC 之 text 鍵恰為兩表之聯集(沒有多出未列入 spec 之文字鍵)', () => {
        const textKeys = Object.keys(OPT_SPEC).filter(k => OPT_SPEC[k].kind === 'text').sort()
        expect(textKeys).toEqual(Object.keys({ ...NODE_TEXT, ...CONN_TEXT }).sort())
    })

    test('文字表凍結(預設不外洩可改)', () => {
        expect(Object.isFrozen(NODE_SETTINGS_TEXTS)).toBe(true)
        expect(Object.isFrozen(CONN_SETTINGS_TEXTS)).toBe(true)
    })
})

describe('X2 逐鍵回退', () => {
    test.each([
        ['數值', 123], ['布林', true], ['物件', { a: 1 }], ['陣列', ['x']], ['null', null], ['undefined', undefined], ['函式', () => 'x'], ['空字串', ''],
    ])('值為%s → 該鍵預設(每個文字鍵皆驗)', (name, v) => {
        for (const table of [NODE_TEXT, CONN_TEXT]) {
            for (const k of Object.keys(table)) expect(resolveOptValue({ [k]: v }, k)).toBe(table[k])
        }
    })

    test('非空字串照收(含中文、純空白不 trim)', () => {
        expect(resolveOptValue({ nodesSettingsTextLabelName: '名稱' }, 'nodesSettingsTextLabelName')).toBe('名稱')
        expect(resolveOptValue({ connsSettingsDeleteText: ' ' }, 'connsSettingsDeleteText')).toBe(' ')
    })

    test.each(KINDS)('%s: 只影響該鍵(逐鍵覆寫, 其餘維持預設)', (name, kind, table) => {
        for (const k of Object.keys(table)) {
            const opt = { [k]: '覆寫' }
            for (const k2 of Object.keys(table)) expect(resolveOptValue(opt, k2)).toBe(k2 === k ? '覆寫' : table[k2])
        }
    })

    test.each(KINDS)('%s: 表單層回退(resolveSettingsTexts)與 opt 層同一規則', (name, kind, table) => {
        const src = {}
        const keys = Object.keys(table)
        src[propOf(keys[0])] = '中文'
        src[propOf(keys[1])] = ''
        src[propOf(keys[2])] = 5
        const r = resolveSettingsTexts(kind, src)
        expect(r[propOf(keys[0])]).toBe('中文')
        expect(r[propOf(keys[1])]).toBe(table[keys[1]])
        expect(r[propOf(keys[2])]).toBe(table[keys[2]])
        expect(Object.keys(r)).toEqual(keys.map(propOf))
        expect(resolveSettingsTexts(kind, null)).toEqual(Object.fromEntries(keys.map(k => [propOf(k), table[k]])))
    })
})

describe('X3 命名規則', () => {
    test.each([
        ['節點', 'node', NODE_SETTING_GROUPS, NODE_TEXT],
        ['連線', 'conn', CONN_SETTING_GROUPS, CONN_TEXT],
    ])('%s: 群標題鍵 = settingsGroups 群鍵 × GroupTitle; 欄位標籤鍵 = settingsGroups 欄位 × textLabel', (name, kind, groups, table) => {
        const keys = Object.keys(table)
        for (const g of groups) expect(keys).toContain(settingsTextOptKey(kind, groupTitleProp(g.key)))
        const fields = [].concat(...groups.map(g => g.fields))
        for (const f of fields) expect(keys).toContain(settingsTextOptKey(kind, fieldLabelProp(f)))
        expect(keys.filter(k => /GroupTitle$/.test(k))).toHaveLength(groups.length)
        expect(keys.filter(k => /SettingsTextLabel/.test(k))).toHaveLength(fields.length)
    })

    test.each([
        ['節點', 'node', { shape: SHAPES, popupDirection: SIDES }, NODE_TEXT],
        ['連線', 'conn', { type: EDGE_TYPES, position: SIDES, marker: MARKER_TYPES, popupDirection: SIDES }, CONN_TEXT],
    ])('%s: 選項鍵 = 類別 × 值域(值域取自值域模組), 空字串為 None', (name, kind, cats, table) => {
        const want = []
        for (const c of Object.keys(cats)) for (const v of cats[c]) want.push(settingsTextOptKey(kind, optionTextProp(c, v)))
        expect(Object.keys(table).filter(k => /TextFor/.test(k)).sort()).toEqual(want.sort())
        expect(optionTextProp('marker', '')).toBe('markerTextForNone')
        expect(optionTextProp('shape', 'triangle-up')).toBe('shapeTextForTriangleUp')
    })

    test('opt 鍵 ↔ 表單 prop 名: 前綴 + 首字大寫; 表單之文字 props 恰為表中之 prop 名, 皆為 String', () => {
        expect(settingsTextOptKey('node', 'textLabelName')).toBe('nodesSettingsTextLabelName')
        expect(settingsTextOptKey('conn', 'deleteText')).toBe('connsSettingsDeleteText')
        for (const [kind, table] of [['node', NODE_TEXT], ['conn', CONN_TEXT]]) {
            const props = settingsTextProps(kind)
            expect(Object.keys(props)).toEqual(Object.keys(table).map(propOf))
            for (const p of Object.keys(props)) {
                expect(props[p].type).toBe(String)
                expect(settingsTextOptKey(kind, p)).toBe((kind === 'conn' ? 'connsSettings' : 'nodesSettings') + p.charAt(0).toUpperCase() + p.slice(1))
            }
        }
    })

    test('既有之 nodesSettingsDeleteText / connsSettingsDeleteText 鍵名不變(非破壞性)', () => {
        expect(NODE_TEXT.nodesSettingsDeleteText).toBe('Delete')
        expect(CONN_TEXT.connsSettingsDeleteText).toBe('Delete')
        expect(OPT_SPEC.nodesSettingsDeleteText.kind).toBe('text')
        expect(OPT_SPEC.connsSettingsDeleteText.kind).toBe('text')
    })
})

describe('X4 選項預設文字', () => {
    test('例外表: smoothstep / arrowclosed; 其餘 Title Case; 空字串 → None', () => {
        expect(defaultOptionText('smoothstep')).toBe('Smooth Step')
        expect(defaultOptionText('arrowclosed')).toBe('Arrow Closed')
        expect(defaultOptionText('triangle-up')).toBe('Triangle Up')
        expect(defaultOptionText('')).toBe('None')
        expect(titleCase('top')).toBe('Top')
    })

    test('值域新增之值不必登記: 鍵名與預設文字由值產生', () => {
        expect(optionTextProp('shape', 'hexagon')).toBe('shapeTextForHexagon')
        expect(defaultOptionText('hexagon')).toBe('Hexagon')
        expect(optionTextProp('type', 'round-step')).toBe('typeTextForRoundStep')
        expect(defaultOptionText('round-step')).toBe('Round Step')
        //鍵名撞到原型屬性亦不取到原型上之值
        expect(defaultOptionText('constructor')).toBe('Constructor')
    })
})

describe('X5 節點與連線各自一組鍵', () => {
    test('兩表無共用鍵; 覆寫節點之鍵不影響連線', () => {
        const nk = Object.keys(NODE_TEXT)
        const ck = Object.keys(CONN_TEXT)
        expect(nk.filter(k => ck.indexOf(k) >= 0)).toEqual([])
        expect(nk.every(k => k.indexOf('nodesSettings') === 0)).toBe(true)
        expect(ck.every(k => k.indexOf('connsSettings') === 0)).toBe(true)
        const opt = { nodesSettingsBasicGroupTitle: '節點基本' }
        expect(resolveOptValue(opt, 'nodesSettingsBasicGroupTitle')).toBe('節點基本')
        expect(resolveOptValue(opt, 'connsSettingsBasicGroupTitle')).toBe('Basic')
    })

    test('共用語彙之預設兩組相同(§11 對稱性)', () => {
        for (const suffix of ['BasicGroupTitle', 'AppearanceGroupTitle', 'TextGroupTitle', 'TextLabelName', 'TextLabelDescription', 'TextLabelEdgeColor', 'TextLabelEdgeWidth', 'TextLabelFontSize', 'TextLabelFontColor', 'DeleteText', 'ColorConfirmText']) {
            expect(NODE_TEXT['nodesSettings' + suffix]).toBe(CONN_TEXT['connsSettings' + suffix])
        }
    })
})

describe('X6 誤用偵測(collectOptIssues)', () => {
    test('合法 opt(含既有之設定類鍵與文字鍵)→ 無', () => {
        expect(collectOptIssues({
            nodes: [],
            conns: [],
            width: 800,
            nodesSettingsEnabled: true,
            connsSettingsTrigger: 'click',
            nodesSettingsExcludes: ['name'],
            settingsPopupMaxHeight: '',
            settingsPopupBackgroundColor: '#222',
            nodesSettingsTextLabelName: '名稱',
            connsSettingsMarkerTextForNone: '無',
            nodesSettingsDeleteText: '',
            connsSettingsDeleteText: null,
            menuZoomInTooltip: '放大',
        })).toEqual([])
        expect(collectOptIssues(undefined)).toEqual([])
        expect(collectOptIssues('x')).toEqual([])
    })

    test('已移除之 settingsColorConfirmText: 點名節點與連線之新鍵(任何非 undefined 值皆報)', () => {
        expect(Object.keys(REMOVED_OPT_KEYS)).toEqual(['settingsColorConfirmText'])
        const msg = 'opt.settingsColorConfirmText has been removed and has no effect; use opt.nodesSettingsColorConfirmText and opt.connsSettingsColorConfirmText instead'
        expect(collectOptIssues({ settingsColorConfirmText: '確定' })).toEqual([msg])
        expect(collectOptIssues({ settingsColorConfirmText: '' })).toEqual([msg])
        expect(collectOptIssues({ settingsColorConfirmText: undefined })).toEqual([])
    })

    test('設定類鍵族之未知鍵(拼錯、物件型文字包)列成一則; 其他鍵族不檢', () => {
        expect(collectOptIssues({
            nodesSettingsTextLabelNmae: '名稱',
            nodesSettingsLabels: { fields: {} },
            connsSettingsLabels: {},
            settingsLabels: {},
            menuZoomInTooltipp: 'x',
        })).toEqual(['unknown opt keys ignored: nodesSettingsTextLabelNmae, nodesSettingsLabels, connsSettingsLabels, settingsLabels'])
    })

    test('文字鍵之值非字串列成一則(undefined / null / 空字串為「用預設」不列)', () => {
        expect(collectOptIssues({ nodesSettingsTextLabelName: 1, connsSettingsDeleteText: {}, nodesSettingsDeleteText: '', connsSettingsTextLabelType: null }))
            .toEqual(['opt texts must be strings, defaults used for: nodesSettingsTextLabelName, connsSettingsDeleteText'])
    })

    test('不讀取資料鍵之值(警告之 computed 不得依賴到 nodes / conns)', () => {
        const read = []
        const opt = { nodesSettingsTextLabelName: '名稱' }
        for (const k of ['nodes', 'conns', 'width']) {
            Object.defineProperty(opt, k, {
                enumerable: true,
                get() {
                    read.push(k)
                    return []
                },
            })
        }
        expect(collectOptIssues(opt)).toEqual([])
        expect(read).toEqual([])
    })
})
