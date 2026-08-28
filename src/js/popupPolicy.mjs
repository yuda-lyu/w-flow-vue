/**
 * 元素(節點/連線)popup 之開啟政策 —— 純函式(spec/流程_互動契約.md §6 overlay 規則、§3 設定入口方式)。
 * NodeWrapper 與 EdgeWrapper 經 mixins/elementPopups 共用同一份判準, 兩者不再各自手寫。
 */

/** 齒輪 icon 是否顯示: 只有 hover 模式於移入時顯示(click/dblclick 模式不顯示齒輪, 直接開設定 popup) */
export function gearVisible(settingsTrigger, hovered) {
    return settingsTrigger === 'hover' && !!hovered
}

/** popup 開啟閘門: 複選模式 或 任何手勢進行中(宿主 getCanOpenPopup)一律拒開 */
export function canOpenPopup({ multiSelectActive, hostCanOpen }) {
    return !multiSelectActive && !!hostCanOpen
}

/** 設定 popup 可否開: 元素可互動(節點 draggable / 連線 interactive)、未上鎖、設定功能啟用、且 popup 閘門放行 */
export function canOpenSettings({ interactive, locked, settingsEnabled, popupOpen }) {
    return !!interactive && !locked && !!settingsEnabled && !!popupOpen
}

/**
 * 資訊 popup 開啟請求之處置:
 *   'reject' 閘門不放行;
 *   'yield'  click 模式且可開設定: 資訊 popup 讓位給設定 popup(兩者同為點擊觸發, 不可同時);
 *   'defer'  dblclick 模式且可開設定: 延後一個雙擊判定窗再開(瀏覽器於雙擊前必先派發 click, 立即開會先閃現再被設定 popup 取代);
 *   'open'   立即開。
 */
export function infoOpenPlan({ trigger, settingsAllowed, popupOpen }) {
    if (!popupOpen) return 'reject'
    if (settingsAllowed && trigger === 'click') return 'yield'
    if (settingsAllowed && trigger === 'dblclick') return 'defer'
    return 'open'
}

/** 某互動事件(click / dblclick)是否為當前模式之「直接開設定」入口 */
export function settingsOpensOn(trigger, eventKind) {
    return (trigger === 'click' || trigger === 'dblclick') && trigger === eventKind
}
