/**
 * 設定表單共用(NodeSettingsForm / ConnSettingsForm): 注入文字/刪除確認態、排除欄位、有效值解析、數值 clamp。
 *
 * 使用元件須提供:
 *   computed item(): 被編輯之節點/連線; defaults(): defNode / defConn
 *   deleteTextKey: 'nodeDelete' | 'connDelete'
 */
import { EDGE_WIDTH_MAX } from '../../js/defaults.mjs'

/**
 * 每欄位之有效值(item → defaults)回退政策(不同欄位之「空值」語義不同, 不用通用規則抹平):
 *   raw            : 只取 item 自身(name/description 之空字串為有效值, 不繼承)
 *   defined        : item 非 undefined/null 即採用(edgeWidth 0、animated false 皆為明確值)
 *   explicit-empty : item 非 undefined/null 即採用, 含 ''(markerStart/End 之 '' 為明確「無」, 不落回 defaults——與 edgeMarker 同一規則)
 *   truthy(預設)   : item 為 truthy 才採用, '' 視為未給 → defaults
 */
export const FIELD_POLICY = {
    name: 'raw',
    description: 'raw',
    edgeWidth: 'defined',
    animated: 'defined',
    markerStart: 'explicit-empty',
    markerEnd: 'explicit-empty',
}

export function effectiveField(key, item, defaults) {
    const v = (item || {})[key]
    const d = (defaults || {})[key]
    const policy = FIELD_POLICY[key] || 'truthy'
    const has = v !== undefined && v !== null
    switch (policy) {
    case 'raw': return has ? v : ''
    case 'defined':
    case 'explicit-empty': return has ? v : (d !== undefined && d !== null ? d : '')
    default: return (has && v !== '') ? v : (d !== undefined && d !== null ? d : '')
    }
}

export default {
    inject: {
        //刪除確認進行中(getter注入, 預設值使本元件可獨立掛載): 等待宿主回覆期間刪除鈕 disabled
        getDeleteConfirming: { default: () => () => false },
        //設定表單文字(刪除鈕/色票確認鈕; 由 WFlowVue 依 opt 注入, 預設英文)
        getSettingsText: { default: () => () => ({}) },
    },
    props: {
        textFontSize: { type: String, default: '' },
        excludes: { type: Array, default: () => [] },
    },
    computed: {
        deleteConfirming() {
            return this.getDeleteConfirming()
        },
        deleteText() {
            return this.getSettingsText()[this.deleteTextKey] || 'Delete'
        },
        colorConfirmText() {
            return this.getSettingsText().colorConfirm || 'Confirm'
        },
        formStyle() {
            const s = {}
            if (this.textFontSize) s.fontSize = this.textFontSize
            return s
        },
        edgeWidthMax() {
            return EDGE_WIDTH_MAX
        },
    },
    methods: {
        isEx(key) {
            return this.excludes.indexOf(key) >= 0
        },
        //有效值(item → defaults; 逐欄位政策 FIELD_POLICY)
        eff(key) {
            return effectiveField(key, this.item, this.defaults)
        },
        onFontSizeInput(val) {
            let n = Number(val)
            const d = this.defaults
            if (!val || isNaN(n) || n < d.fontSizeMin) return
            if (n > d.fontSizeMax) n = d.fontSizeMax
            this.$emit('update', 'fontSize', n)
        },
        onEdgeWidthInput(val) {
            let n = Number(val)
            if (!val || isNaN(n) || n < 1) return
            if (n > EDGE_WIDTH_MAX) n = EDGE_WIDTH_MAX
            this.$emit('update', 'edgeWidth', n)
        },
    },
}
