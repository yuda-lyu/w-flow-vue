/**
 * 設定彈窗(節點 / 連線)之顯示文字 —— 鍵、預設與回退之單一來源(內部模組, 不對外)。
 *
 * 對外介面一律逐字展開, 一句文字一個鍵(業主規範, 見 CLAUDE.md「opt 設計規範」):
 *   opt 鍵   = {nodes|conns}Settings + 文字 prop 名(首字大寫), 如 opt.nodesSettingsTextLabelName
 *   表單 prop = 文字 prop 名, 如 NodeSettingsForm 之 textLabelName
 * 文字 prop 名沿用 w-component-vue 之文字 prop 慣例:
 *   群標題     {群鍵}GroupTitle          (同 uploadModeTitle 之 {對象}Title)
 *   欄位標籤   textLabel{欄位鍵}          (同 textLabelDataName)
 *   下拉選項   {類別}TextFor{值}          (同 uploadModeTextForReplace; 類別 = 所服務之欄位鍵, 兩欄共用一張下拉者取共同字根
 *                                         position / marker; 值 kebab → PascalCase, 空字串之「無」為 None)
 *   按鈕文字   deleteText / colorConfirmText(deleteText 即既有之 opt.nodesSettingsDeleteText / connsSettingsDeleteText)
 *   圖示鈕提示 pointsAddBtnTooltip / pointsRemoveBtnTooltip(同 saveBtnTooltip; 亦作 aria-label)
 *   空狀態     pointsTextEmpty            (同 textEmpty)
 *   輸入框提示 pointsXTooltip / pointsYTooltip
 * 選項之鍵由值域模組產生(值域新增之值自動有鍵, 預設文字由值轉寫); 鍵集與 spec 之對照由單元測試把關。
 * 內部傳遞(WFlowVue → Renderer → Wrapper → 表單)以「prop 名 → 文字」物件下傳再展開到表單 prop, 屬內部機制。
 *
 * 回退: 非字串或空字串 → 預設; 純空白字串照收(與工具列 tooltip 同規則)。
 */
import { NODE_SETTING_GROUPS, CONN_SETTING_GROUPS } from './settingsGroups.mjs'
import { SHAPES } from './nodeStyle.mjs'
import { SIDES } from './anchorPolicy.mjs'
import { EDGE_TYPES } from './edgePath.mjs'
import { MARKER_TYPES } from './edgeMarker.mjs'

//兩表單共用之欄位標籤(同一件事在兩個 popup 用同一個字, 只定義一次)
const COMMON_LABELS = {
    name: 'Name',
    description: 'Description',
    edgeColor: 'Edge Color',
    edgeWidth: 'Edge Width',
    fontSize: 'Font Size',
    fontColor: 'Font Color',
    popupDirection: 'Popup Direction',
}

const NODE_FIELD_LABELS = {
    name: COMMON_LABELS.name,
    description: COMMON_LABELS.description,
    shape: 'Shape',
    faceColor: 'Face Color',
    edgeColor: COMMON_LABELS.edgeColor,
    edgeWidth: COMMON_LABELS.edgeWidth,
    fontSize: COMMON_LABELS.fontSize,
    fontColor: COMMON_LABELS.fontColor,
    popupDirection: COMMON_LABELS.popupDirection,
}

const CONN_FIELD_LABELS = {
    name: COMMON_LABELS.name,
    description: COMMON_LABELS.description,
    type: 'Type',
    fromPosition: 'From Anchor',
    toPosition: 'To Anchor',
    points: 'Waypoints',
    edgeColor: COMMON_LABELS.edgeColor,
    edgeWidth: COMMON_LABELS.edgeWidth,
    animated: 'Animated',
    markerFrom: 'From Marker',
    markerFromSize: 'From Marker Size',
    markerFromFaceColor: 'From Marker Face Color',
    markerFromEdgeColor: 'From Marker Edge Color',
    markerTo: 'To Marker',
    markerToSize: 'To Marker Size',
    markerToFaceColor: 'To Marker Face Color',
    markerToEdgeColor: 'To Marker Edge Color',
    fontSize: COMMON_LABELS.fontSize,
    fontColor: COMMON_LABELS.fontColor,
    popupDirection: COMMON_LABELS.popupDirection,
}

//下拉之選項類別 → 值域(值域單一來源在各值域模組, 此處只引用)
const NODE_OPTION_VALUES = { shape: SHAPES, popupDirection: SIDES }
const CONN_OPTION_VALUES = { type: EDGE_TYPES, position: SIDES, marker: MARKER_TYPES, popupDirection: SIDES }

//轉寫不出正確英文之值才收(不得擴成完整對照表: 值域新增之值自動以 Title Case 呈現)
const OPTION_TEXT_EXCEPTIONS = Object.freeze({
    smoothstep: 'Smooth Step',
    arrowclosed: 'Arrow Closed',
})

/** kebab-case 值 → 顯示文字(triangle-up → Triangle Up) */
export function titleCase(v) {
    return String(v).split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

//kebab / camel → PascalCase(triangle-up → TriangleUp, faceColor → FaceColor)
function pascal(v) {
    return String(v).split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
}

//選項值 → 鍵用之值: 空字串為「無」
function optionValueKey(value) {
    return value === '' ? 'none' : String(value)
}

/** 群標題之 prop 名(basic → basicGroupTitle) */
export function groupTitleProp(groupKey) {
    return groupKey + 'GroupTitle'
}

/** 欄位標籤之 prop 名(faceColor → textLabelFaceColor) */
export function fieldLabelProp(fieldKey) {
    return 'textLabel' + pascal(fieldKey)
}

/** 下拉選項之 prop 名(shape, triangle-up → shapeTextForTriangleUp; marker, '' → markerTextForNone) */
export function optionTextProp(category, value) {
    return category + 'TextFor' + pascal(optionValueKey(value))
}

/** 選項之預設文字: 例外表 → Title Case */
export function defaultOptionText(value) {
    const k = optionValueKey(value)
    return Object.prototype.hasOwnProperty.call(OPTION_TEXT_EXCEPTIONS, k) ? OPTION_TEXT_EXCEPTIONS[k] : titleCase(k)
}

function build(groups, fieldLabels, optionValues, buttons) {
    const t = {}
    for (const g of groups) t[groupTitleProp(g.key)] = g.title
    for (const k of Object.keys(fieldLabels)) t[fieldLabelProp(k)] = fieldLabels[k]
    for (const c of Object.keys(optionValues)) {
        for (const v of optionValues[c]) t[optionTextProp(c, v)] = defaultOptionText(v)
    }
    for (const k of Object.keys(buttons)) t[k] = buttons[k]
    return Object.freeze(t)
}

/** 節點設定彈窗: 文字 prop 名 → 英文預設(26 句) */
export const NODE_SETTINGS_TEXTS = build(NODE_SETTING_GROUPS, NODE_FIELD_LABELS, NODE_OPTION_VALUES, {
    deleteText: 'Delete',
    colorConfirmText: 'Confirm',
})

/** 連線設定彈窗: 文字 prop 名 → 英文預設(48 句) */
export const CONN_SETTINGS_TEXTS = build(CONN_SETTING_GROUPS, CONN_FIELD_LABELS, CONN_OPTION_VALUES, {
    pointsAddBtnTooltip: 'Add Waypoint',
    pointsRemoveBtnTooltip: 'Remove Waypoint',
    pointsTextEmpty: 'None (auto-routed)',
    pointsXTooltip: 'X',
    pointsYTooltip: 'Y',
    deleteText: 'Delete',
    colorConfirmText: 'Confirm',
})

function textsOf(kind) {
    return kind === 'conn' ? CONN_SETTINGS_TEXTS : NODE_SETTINGS_TEXTS
}

/** 文字 prop 名 → opt 鍵(node, textLabelName → nodesSettingsTextLabelName) */
export function settingsTextOptKey(kind, prop) {
    return (kind === 'conn' ? 'connsSettings' : 'nodesSettings') + prop.charAt(0).toUpperCase() + prop.slice(1)
}

/** OPT_SPEC 用: 每個文字 opt 鍵一筆 { kind: 'text', def } */
export function settingsTextOptSpec() {
    const r = {}
    for (const kind of ['node', 'conn']) {
        const t = textsOf(kind)
        for (const p of Object.keys(t)) r[settingsTextOptKey(kind, p)] = { kind: 'text', def: t[p] }
    }
    return r
}

/** 表單之文字 props(每句一個 String prop; 未給為空字串 → 回退預設) */
export function settingsTextProps(kind) {
    const r = {}
    for (const p of Object.keys(textsOf(kind))) r[p] = { type: String, default: '' }
    return r
}

function isText(v) {
    return typeof v === 'string' && v !== ''
}

/** 解析表單文字: 自 src(表單實例或任一物件)逐 prop 取值, 非字串或空字串回退預設; 回傳新物件 */
export function resolveSettingsTexts(kind, src) {
    const defs = textsOf(kind)
    const r = {}
    for (const p of Object.keys(defs)) {
        const v = src ? src[p] : undefined
        r[p] = isText(v) ? v : defs[p]
    }
    return r
}

/** WFlowVue 內部下傳用: 由各文字 opt 鍵之 computed 組成「表單 prop 名 → 文字」 */
export function pickSettingsTexts(kind, vm) {
    const r = {}
    for (const p of Object.keys(textsOf(kind))) r[p] = vm[settingsTextOptKey(kind, p)]
    return r
}
