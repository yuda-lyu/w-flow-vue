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

/**
 * 節點設定 popup 之開啟方向(node.popupDirection → defNode.popupDirection)→ 齒輪錨點所在角 + WPopup placement。
 *
 * 為何移動錨點而不是放大參考框: WPopup(popper)以觸發元素(齒輪錨點)為定位參考, 且以「觸發元素之矩形」判定點擊是否在外
 * (buildPopper 之 domIsClientXYIn); 若把參考框放大成整個節點, 點節點本體就不再關閉 popup, 行為會變。
 * 故錨點留 20px 齒輪大小, 改放到彈窗那一側之角, 彈窗即落在節點外: 齒輪外凸 8px, 再加 WPopup 預設之 5px 距離。
 *   right  → 右上角 + right-start(即原本寫死之定位, 預設值不變)
 *   top    → 右上角 + top-end(彈窗右緣對齊齒輪右緣, 往上開)
 *   left   → 左上角 + left-start(right 之鏡像)
 *   bottom → 右下角 + bottom-end(彈窗右緣對齊齒輪右緣, 往下開)
 * 空間不足時 popper 之 flip 會翻到另一側(既有行為, 與方向無關)。非四方位之值回退 right。
 */
export const SETTINGS_POPUP_LAYOUTS = Object.freeze({
    right: Object.freeze({ corner: 'top-right', placement: 'right-start' }),
    top: Object.freeze({ corner: 'top-right', placement: 'top-end' }),
    left: Object.freeze({ corner: 'top-left', placement: 'left-start' }),
    bottom: Object.freeze({ corner: 'bottom-right', placement: 'bottom-end' }),
})

export function settingsPopupLayout(direction) {
    return Object.prototype.hasOwnProperty.call(SETTINGS_POPUP_LAYOUTS, direction) ? SETTINGS_POPUP_LAYOUTS[direction] : SETTINGS_POPUP_LAYOUTS.right
}
