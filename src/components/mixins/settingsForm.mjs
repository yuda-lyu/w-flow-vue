/**
 * 設定表單共用(NodeSettingsForm / ConnSettingsForm): 注入文字/刪除確認態、排除欄位、有效值解析、數值 clamp、
 * 屬性分群之展開態。
 *
 * 使用元件須提供:
 *   computed item(): 被編輯之節點/連線; defaults(): defNode / defConn
 *   computed groupDefs(): 分群定義(js/settingsGroups.mjs 之 NODE_SETTING_GROUPS / CONN_SETTING_GROUPS)
 *   deleteTextKey: 'nodeDelete' | 'connDelete'
 */
import { EDGE_WIDTH_MAX } from '../../js/defaults.mjs'
import { DEFAULT_OPEN_GROUPS, visibleGroups } from '../../js/settingsGroups.mjs'

/**
 * 每欄位之有效值(item → defaults)回退政策(不同欄位之「空值」語義不同, 不用通用規則抹平):
 *   raw            : 只取 item 自身(name/description 之空字串為有效值, 不繼承)
 *   defined        : item 非 undefined/null 即採用(edgeWidth 0、animated false 皆為明確值)
 *   explicit-empty : item 非 undefined/null 即採用, 含 ''(markerFrom/End 之 '' 為明確「無」, 不落回 defaults——與 edgeMarker 同一規則)
 *   truthy(預設)   : item 為 truthy 才採用, '' 視為未給 → defaults
 */
export const FIELD_POLICY = {
    name: 'raw',
    description: 'raw',
    edgeWidth: 'defined',
    animated: 'defined',
    markerFrom: 'explicit-empty',
    markerTo: 'explicit-empty',
}

/**
 * 判斷一個 CSS 色字串是否為深色(相對亮度 < 0.5)。支援 #rgb / #rrggbb / rgb(a)();
 * 認不得的字串(具名色、hsl、漸層…)一律回 false —— 寧可維持淺色預設, 不亂猜。
 *
 * 用途: 群標題之底色/三角形色須隨 popup 底色走。淺色底以「疊黑」加深、深色底須改為「疊白」加亮,
 * 否則深色 popup 上的標題帶會比背景更暗、三角形直接看不見。
 */
export function isDarkColor(css) {
    if (typeof css !== 'string') return false
    let r, g, b
    const hex = css.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
    if (hex) {
        const h = hex[1]
        const f = h.length === 3 ? h.split('').map(c => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)]
        ;[r, g, b] = f.map(v => parseInt(v, 16))
    }
    else {
        const m = css.trim().match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
        if (!m) return false
        ;[r, g, b] = [m[1], m[2], m[3]].map(Number)
    }
    if (![r, g, b].every(v => isFinite(v))) return false
    const lin = (c) => {
        c /= 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return (0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)) < 0.5
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
        //表單最大高度(CSS 長度字串, 如 '400px' / '50vh'); 超出即於表單內捲動。空字串為不設限
        maxHeight: { type: String, default: '' },
        //popup 底色: 群標題之分隔線取此色(相鄰收合群之間的 1px 區隔), 宿主換深色主題時分隔線才跟著走
        backgroundColor: { type: String, default: '' },
        excludes: { type: Array, default: () => [] },
        //預設展開之群鍵(其餘收合); 各群展開態彼此獨立, 開一群不會關掉別群。
        //語義為「初值」而非受控 prop: 只在建立時取用一次, 掛載後再改本 prop 不生效, 故命名為 default*。
        //表單亦不送出展開態變更事件 —— popup 每次開啟都會重建表單(NodeWrapper/EdgeWrapper 之 v-if),
        //展開態刻意不跨開關記憶; 宿主若要記憶, 以 SettingsGroup 自行組裝表單。
        defaultOpenGroups: { type: Array, default: () => DEFAULT_OPEN_GROUPS.slice() },
    },
    data() {
        return {
            //展開態為表單本地狀態(popup 關閉重建即回到 defaultOpenGroups)
            openGroupsLocal: this.defaultOpenGroups.slice(),
        }
    },
    //預設展開鍵可能因 excludes 而全數不可見(如 basic 整群被排除), 那會讓 popup 一開全是收合的標題列;
    //此時退而展開第一個可見群, 使 popup 開啟即有內容可改
    created() {
        const gs = this.groups
        if (gs.length && !gs.some(g => this.openGroupsLocal.indexOf(g.key) >= 0)) {
            this.openGroupsLocal = [gs[0].key]
        }
    },
    computed: {
        //實際渲染之群(整群欄位都被 excludes 排除者不出現, 不留空群)
        groups() {
            return visibleGroups(this.groupDefs, this.excludes)
        },
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
            //群標題各層顏色隨 popup 底色走(CSS 變數; 宿主仍可自行覆寫這些變數再細調):
            //分隔線取 popup 底色本身; 底色為深色時, 標題帶改「疊白」加亮、三角形改淺色, 否則深色主題下
            //標題帶會比背景更暗、三角形直接看不見。
            if (this.backgroundColor) {
                s['--vf-settings-bg'] = this.backgroundColor
                if (isDarkColor(this.backgroundColor)) {
                    s['--vf-settings-surface'] = 'rgba(255, 255, 255, 0.10)'
                    s['--vf-settings-surface-hover'] = 'rgba(255, 255, 255, 0.20)'
                    s['--vf-settings-caret'] = 'rgba(255, 255, 255, 0.72)'
                    s['--vf-settings-caret-hover'] = 'rgba(255, 255, 255, 0.95)'
                    s['--vf-settings-rule'] = 'rgba(255, 255, 255, 0.16)'
                }
            }
            //超出上限即表單內捲動(非讓 popup 無限長高)。
            //刻意不用 scrollbar-gutter:stable —— 它在不需捲動時也永遠預留捲動條空間, 於 240px 寬的 popup
            //內是一條明顯的無用留白; 改以 thin 捲動條, 只在真的超出時出現。
            if (this.maxHeight) {
                s.maxHeight = this.maxHeight
                s.overflowY = 'auto'
                s.scrollbarWidth = 'thin'
            }
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
        isGroupOpen(key) {
            return this.openGroupsLocal.indexOf(key) >= 0
        },
        setGroupOpen(key, b) {
            const i = this.openGroupsLocal.indexOf(key)
            if (b && i < 0) this.openGroupsLocal.push(key)
            else if (!b && i >= 0) this.openGroupsLocal.splice(i, 1)
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
