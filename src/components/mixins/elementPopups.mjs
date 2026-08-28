/**
 * 元素 popup 狀態機(NodeWrapper / EdgeWrapper 共用): 資訊/設定 popup 互斥、複選模式關閉、開啟閘門、
 * 設定入口三模式(hover 齒輪 / click / dblclick 直接開)、dblclick 模式之資訊 popup 延後開啟。
 * 判準本體在 js/popupPolicy.mjs(純函式); 本 mixin 只接 data / watch / 生命週期。
 *
 * 使用元件須提供:
 *   props: settingsTrigger, settingsEnabled, locked
 *   computed settingsInteractive(): 元素可互動旗標(節點 draggable / 連線 interactive)
 *   method emitActivate(event): 發 *-activate(直接開設定時該元素成為唯一 active)
 */
import { INFO_POPUP_DEFER_MS } from '../../js/defaults.mjs'
import { gearVisible, canOpenPopup, canOpenSettings, infoOpenPlan } from '../../js/popupPolicy.mjs'

export default {
    inject: {
        //複選鍵是否生效: getter注入而非prop——只被事件handler讀取, 不進渲染面, 按/放複選鍵時不觸發重渲染
        getMultiSelectActive: { default: () => () => false },
        //popup 可否開啟(overlay 規則 §6): 複選模式或任何手勢進行中一律拒開(含公開 API 之程式化開啟)
        getCanOpenPopup: { default: () => () => true },
    },
    data() {
        return {
            hovered: false,
            infoPopupShow: false,
            infoPopupEditable: true,
            settingsPopupShow: false,
        }
    },
    computed: {
        //複選模式(反應式讀取注入getter): 供watcher清popup與各開啟入口gating
        multiSelectActive() {
            return this.getMultiSelectActive()
        },
        gearVisible() {
            return gearVisible(this.settingsTrigger, this.hovered)
        },
    },
    watch: {
        //資訊/設定 popup 互斥
        settingsPopupShow(val) {
            if (val) this.infoPopupShow = false
        },
        infoPopupShow(val) {
            if (val) this.settingsPopupShow = false
        },
        //複選模式引擎時關閉已開之popup(進入模式=畫面收束為純選取操作; 開啟入口另有各自gating, 本watcher只清理既有狀態)
        multiSelectActive(val) {
            if (val) {
                this.infoPopupShow = false
                this.settingsPopupShow = false
            }
        },
    },
    beforeDestroy() {
        this.cancelPendingInfo()
    },
    methods: {
        canOpenPopup() {
            return canOpenPopup({ multiSelectActive: this.getMultiSelectActive(), hostCanOpen: this.getCanOpenPopup() })
        },
        canOpenSettings() {
            return canOpenSettings({ interactive: this.settingsInteractive, locked: this.locked, settingsEnabled: this.settingsEnabled, popupOpen: this.canOpenPopup() })
        },
        //資訊popup之開關請求由本元件裁決(WPopup之isolated為預設false, 故trigger點擊只是$emit請求, 實際狀態由v-model擁有者決定)
        //why: 關閉請求一律放行, 且不可改用editable抑制——editable會連evHide與外部點擊關閉一併擋掉, 使已開之popup關不掉
        onInfoPopupInput(val) {
            if (!val) {
                this.infoPopupShow = false
                return
            }
            this.requestInfoPopup()
        },
        //資訊 popup 開啟請求(popupPolicy.infoOpenPlan): reject / yield / defer / open
        requestInfoPopup() {
            const plan = infoOpenPlan({ trigger: this.settingsTrigger, settingsAllowed: this.canOpenSettings(), popupOpen: this.canOpenPopup() })
            if (plan === 'open') this.infoPopupShow = true
            else if (plan === 'defer') this.deferInfoPopup()
        },
        deferInfoPopup() {
            this.cancelPendingInfo()
            this._infoTimer = setTimeout(() => {
                this._infoTimer = null
                if (this.canOpenPopup()) this.infoPopupShow = true
            }, INFO_POPUP_DEFER_MS)
        },
        cancelPendingInfo() {
            if (this._infoTimer) {
                clearTimeout(this._infoTimer)
                this._infoTimer = null
            }
        },
        //設定popup之開關同樣由本元件裁決(拒開條件同上; 關閉請求一律放行)
        onSettingsPopupInput(val) {
            if (val && !this.canOpenPopup()) return
            this.settingsPopupShow = val
        },
        //click/dblclick 模式之直接開啟: 同閘門, 並如點齒輪般使本元素成為唯一 active
        openSettingsPopup(event) {
            if (!this.canOpenSettings()) return
            this.settingsPopupShow = true
            this.emitActivate(event)
        },
        //宿主API入口同樣gating: 程式化開啟於複選/手勢中亦拒絕(回傳false供呼叫端判斷)
        openInfoPopup() {
            if (!this.canOpenPopup()) return false
            this.infoPopupShow = true
            return true
        },
        //關閉本元素全部 popup(手勢啟動時由 WFlowVue.closeAllPopups 統一呼叫: 把手/四角之 mousedown 帶 .stop,
        //WPopup 掛在 window 之互斥關閉收不到, 實測 A 之資訊 popup 於自 B 把手拉線/縮放 B 期間整段不關)
        closePopups() {
            this.infoPopupShow = false
            this.settingsPopupShow = false
        },
    },
}
