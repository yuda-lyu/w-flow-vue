/**
 * resolveOpt.mjs(opt 解析單一來源)契約:
 * O1 每個 OPT_SPEC 鍵三態: 未給 → 預設; 明確合法值 → 採用; 非法/空值 → 依 kind 回退(defined 只回退 undefined; truthy 回退 falsy;
 *    enum 回退非枚舉; nonneg 回退負數/非數; notFalse 只有 false 關閉; fn 非函式為 null)。
 * O2 群組: resolveDefNode / resolveDefConn 逐欄回退 NODE_DEFAULTS / CONN_DEFAULTS(edgeWidth 0 合法); resolveSettingsText 非字串回退。
 * O3 pickMenuOpt 原樣透傳(不套預設, 預設在 Controls.menuDef)。
 * O4 WFlowVue 之 computed 名稱 = OPT_SPEC 鍵名(optComputeds 展開), 值與 resolveOptValue 一致。
 */
import { mount } from '@vue/test-utils'
import WFlowVue from '../src/components/WFlowVue.vue'
import { OPT_SPEC, resolveOptValue, resolveOpt, optComputeds, resolveDefNode, resolveDefConn, resolveSettingsText, pickMenuOpt, MENU_OPT_KEYS } from '../src/js/resolveOpt.mjs'
import { NODE_DEFAULTS, CONN_DEFAULTS } from '../src/js/defaults.mjs'

describe('O1 每鍵三態', () => {
    test('未給 → 預設', () => {
        const r = resolveOpt({})
        expect(r.widthInp).toBe(800); expect(r.heightInp).toBe(600)
        expect(r.nodesDraggable).toBe(true); expect(r.deleteKeyEnabled).toBe(false)
        expect(r.nodesSettingsTrigger).toBe('dblclick'); expect(r.zoomMin).toBe(0.5); expect(r.zoomMax).toBe(2)
        expect(r.center).toEqual([0, 0]); expect(r.panLimits).toBeNull(); expect(r.fitViewOnInit).toBe(true)
        //padding 一律正規化為四邊(螢幕像素)
        expect(r.fitViewPadding).toEqual({ top: 50, right: 50, bottom: 50, left: 50 })
        expect(r.defConnCreatingEdgeColor).toBe(CONN_DEFAULTS.edgeColor); expect(r.platformBackgroundColor).toBe('#fff')
        expect(r.funConfirmDeleting).toBeNull(); expect(r.funValidConnCreating).toBeNull()
    })
    test('明確值採用; 依 kind 回退', () => {
        expect(resolveOptValue({ nodesDraggable: false }, 'nodesDraggable')).toBe(false)
        expect(resolveOptValue({ nodesDraggable: null }, 'nodesDraggable')).toBeNull() //defined: 只回退 undefined
        expect(resolveOptValue({ width: 0 }, 'widthInp')).toBe(800) //truthy: 0 回退
        expect(resolveOptValue({ width: 300 }, 'widthInp')).toBe(300)
        expect(resolveOptValue({ nodesSettingsTrigger: 'hover' }, 'nodesSettingsTrigger')).toBe('hover')
        expect(resolveOptValue({ nodesSettingsTrigger: 'bogus' }, 'nodesSettingsTrigger')).toBe('dblclick')
        const sides = (v) => ({ top: v, right: v, bottom: v, left: v })
        expect(resolveOptValue({ fitViewPadding: 0 }, 'fitViewPadding')).toEqual(sides(0))
        expect(resolveOptValue({ fitViewPadding: -1 }, 'fitViewPadding')).toEqual(sides(50))
        expect(resolveOptValue({ fitViewPadding: '10' }, 'fitViewPadding')).toEqual(sides(50))
        //padding kind: 物件形式逐邊採用, 缺漏之邊回退 def
        expect(resolveOptValue({ fitViewPadding: { left: 120, top: 0 } }, 'fitViewPadding')).toEqual({ top: 0, right: 50, bottom: 50, left: 120 })
        expect(resolveOptValue({ fitViewOnInit: false }, 'fitViewOnInit')).toBe(false)
        expect(resolveOptValue({ fitViewOnInit: 0 }, 'fitViewOnInit')).toBe(true)
        expect(resolveOptValue({ funConfirmDeleting: 'x' }, 'funConfirmDeleting')).toBeNull()
        const f = () => true
        expect(resolveOptValue({ funConfirmDeleting: f }, 'funConfirmDeleting')).toBe(f)
        expect(resolveOptValue({ zoomMin: 0 }, 'zoomMin')).toBe(0)
        expect(() => resolveOptValue({}, 'nope')).toThrow()
    })
    test('每個 spec 鍵皆可解析且 kind 合法', () => {
        for (const name of Object.keys(OPT_SPEC)) {
            expect(() => resolveOptValue({}, name)).not.toThrow()
        }
    })
})

describe('O2 群組解析', () => {
    test('defNode / defConn 逐欄回退, 0 合法', () => {
        const dn = resolveDefNode({ defNodeEdgeWidth: 0, defHandleEdgeWidth: 0 })
        expect(dn.edgeWidth).toBe(0); expect(dn.handleEdgeWidth).toBe(0)
        expect(dn.width).toBe(NODE_DEFAULTS.width); expect(dn.shape).toBe(NODE_DEFAULTS.shape)
        const dc = resolveDefConn({ defConnEdgeWidth: 0, defConnAnimated: true, defOffset: 0 })
        expect(dc.edgeWidth).toBe(0); expect(dc.animated).toBe(true); expect(dc.defOffset).toBe(0)
        expect(dc.fromPosition).toBe(CONN_DEFAULTS.fromPosition); expect(dc.markerEnd).toBe(CONN_DEFAULTS.markerEnd)
        expect(resolveDefConn({}).defOffset).toBe(CONN_DEFAULTS.defOffset)
    })
    test('settingsText 非字串回退', () => {
        expect(resolveSettingsText({ nodesSettingsDeleteText: 123, connsSettingsDeleteText: '', settingsColorConfirmText: '確定' }))
            .toEqual({ nodeDelete: 'Delete', connDelete: 'Delete', colorConfirm: '確定' })
    })
})

describe('O3 menu 透傳', () => {
    test('不套預設', () => {
        const m = pickMenuOpt({ useMenu: false, menuIconSize: 30 })
        expect(m.useMenu).toBe(false); expect(m.menuIconSize).toBe(30); expect(m.menuPosition).toBeUndefined()
        expect(Object.keys(m)).toEqual(MENU_OPT_KEYS)
    })
})

describe('O4 WFlowVue computed 與 spec 一致', () => {
    test('optComputeds 鍵集合 = OPT_SPEC; 元件 computed 值 = resolveOptValue', async () => {
        expect(Object.keys(optComputeds())).toEqual(Object.keys(OPT_SPEC))
        const opt = { nodes: [], conns: [], width: 500, nodesDraggable: false, nodesSettingsTrigger: 'click', zoomMax: 3, fitViewPadding: 0 }
        const w = mount(WFlowVue, { propsData: { opt } })
        await w.vm.$nextTick()
        for (const name of Object.keys(OPT_SPEC)) {
            expect(w.vm[name]).toEqual(resolveOptValue(opt, name))
        }
        expect(w.vm.defNode).toEqual(resolveDefNode(opt))
        expect(w.vm.defConn).toEqual(resolveDefConn(opt))
        w.destroy()
    })
})
