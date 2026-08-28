/**
 * popupPolicy.mjs(節點/連線 popup 開啟政策, 純函式)與 settingsForm 之欄位有效值政策:
 * Q1 gearVisible 只在 hover 模式且移入時為真。
 * Q2 canOpenPopup: 複選模式或宿主閘門拒絕即 false。canOpenSettings: interactive/locked/settingsEnabled/popupOpen 四者缺一即 false。
 * Q3 infoOpenPlan: 閘門拒 → reject; click+可開設定 → yield; dblclick+可開設定 → defer; 其餘 open。settingsOpensOn 僅同模式事件。
 * Q4 effectiveField(FIELD_POLICY): raw 不繼承且空字串有效; defined 之 0/false 明確; explicit-empty 之 '' 明確; truthy 之 '' 回退。
 * Q5 兩 wrapper 共用 mixin: NodeWrapper / EdgeWrapper 皆含 elementPopups 之方法(對稱性: 同名方法同一實作)。
 */
import { gearVisible, canOpenPopup, canOpenSettings, infoOpenPlan, settingsOpensOn } from '../src/js/popupPolicy.mjs'
import { effectiveField, FIELD_POLICY } from '../src/components/mixins/settingsForm.mjs'
import elementPopups from '../src/components/mixins/elementPopups.mjs'
import NodeWrapper from '../src/components/nodes/NodeWrapper.vue'
import EdgeWrapper from '../src/components/edges/EdgeWrapper.vue'

describe('Q1/Q2 齒輪與閘門', () => {
    test('gearVisible', () => {
        expect(gearVisible('hover', true)).toBe(true)
        expect(gearVisible('hover', false)).toBe(false)
        expect(gearVisible('click', true)).toBe(false)
        expect(gearVisible('dblclick', true)).toBe(false)
    })
    test('canOpenPopup / canOpenSettings', () => {
        expect(canOpenPopup({ multiSelectActive: false, hostCanOpen: true })).toBe(true)
        expect(canOpenPopup({ multiSelectActive: true, hostCanOpen: true })).toBe(false)
        expect(canOpenPopup({ multiSelectActive: false, hostCanOpen: false })).toBe(false)
        const ok = { interactive: true, locked: false, settingsEnabled: true, popupOpen: true }
        expect(canOpenSettings(ok)).toBe(true)
        for (const k of ['interactive', 'settingsEnabled', 'popupOpen']) expect(canOpenSettings({ ...ok, [k]: false })).toBe(false)
        expect(canOpenSettings({ ...ok, locked: true })).toBe(false)
    })
})

describe('Q3 資訊 popup 開啟計畫', () => {
    test('四種處置', () => {
        expect(infoOpenPlan({ trigger: 'click', settingsAllowed: true, popupOpen: false })).toBe('reject')
        expect(infoOpenPlan({ trigger: 'click', settingsAllowed: true, popupOpen: true })).toBe('yield')
        expect(infoOpenPlan({ trigger: 'dblclick', settingsAllowed: true, popupOpen: true })).toBe('defer')
        expect(infoOpenPlan({ trigger: 'dblclick', settingsAllowed: false, popupOpen: true })).toBe('open')
        expect(infoOpenPlan({ trigger: 'hover', settingsAllowed: true, popupOpen: true })).toBe('open')
        expect(settingsOpensOn('click', 'click')).toBe(true)
        expect(settingsOpensOn('dblclick', 'click')).toBe(false)
        expect(settingsOpensOn('hover', 'click')).toBe(false)
    })
})

describe('Q4 欄位有效值政策', () => {
    test('raw / defined / explicit-empty / truthy', () => {
        const d = { name: 'D', edgeWidth: 3, animated: true, markerEnd: 'arrow', edgeColor: '#000', fontSize: 12 }
        expect(FIELD_POLICY.name).toBe('raw')
        expect(effectiveField('name', { name: '' }, d)).toBe('')
        expect(effectiveField('name', {}, d)).toBe('')
        expect(effectiveField('edgeWidth', { edgeWidth: 0 }, d)).toBe(0)
        expect(effectiveField('edgeWidth', {}, d)).toBe(3)
        expect(effectiveField('animated', { animated: false }, d)).toBe(false)
        expect(effectiveField('animated', {}, d)).toBe(true)
        expect(effectiveField('markerEnd', { markerEnd: '' }, d)).toBe('')
        expect(effectiveField('markerEnd', {}, d)).toBe('arrow')
        expect(effectiveField('edgeColor', { edgeColor: '' }, d)).toBe('#000')
        expect(effectiveField('edgeColor', { edgeColor: '#fff' }, d)).toBe('#fff')
        expect(effectiveField('fontSize', {}, {})).toBe('')
    })
})

describe('Q5 兩 wrapper 共用同一 popup 狀態機', () => {
    test('mixin 方法於兩元件皆存在且為同一函式', () => {
        for (const m of ['canOpenPopup', 'canOpenSettings', 'onInfoPopupInput', 'requestInfoPopup', 'cancelPendingInfo', 'onSettingsPopupInput', 'openSettingsPopup', 'openInfoPopup', 'closePopups']) {
            expect(typeof elementPopups.methods[m]).toBe('function')
            expect(NodeWrapper.mixins.some(x => x === elementPopups)).toBe(true)
            expect(EdgeWrapper.mixins.some(x => x === elementPopups)).toBe(true)
            expect(NodeWrapper.methods[m]).toBeUndefined()
            expect(EdgeWrapper.methods[m]).toBeUndefined()
        }
        expect(typeof NodeWrapper.methods.emitActivate).toBe('function')
        expect(typeof EdgeWrapper.methods.emitActivate).toBe('function')
    })
})
