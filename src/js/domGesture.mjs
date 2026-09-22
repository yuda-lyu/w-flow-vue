/**
 * document 層手勢工具 —— 節點拖曳/縮放、轉折點拖曳、label 位移追蹤共用同一份「掛/卸監聽 + 全域游標 + 終止原因」。
 *
 * 輸入來源為雙通道(spec/流程_互動契約.md §1 輸入事件): 滑鼠走既有 mouse 事件, 觸控/觸控筆走 pointer 事件,
 * 以 isFromMouse 分流——滑鼠會同時送 pointer 與 mouse 兩套事件, 兩邊都處理即一次手勢被啟動兩遍。
 *
 * 終止原因(reason): 'mouseup' | 'pointerup'(非滑鼠來源之放開, 與 mouseup 同為提交語義)| 'blur'
 *   | 'buttons-lost'(move 時主鍵已放開: 視窗外放開未送達 mouseup)| 'cancel'(pointercancel: 手勢被系統中斷, 取消語義)
 *   | 'dispose'(呼叫端主動收尾, 如銷毀/被新手勢取代)。
 * 契約(spec/流程_互動契約.md §5 終止列): 任一原因皆走同一收尾——卸 document/window 監聽、移除全域游標樣式; 提交/取消語義由呼叫端依 reason 決定。
 */

/** 拖曳啟動門檻(px): 畫布框選/平移、節點拖曳、label 位移判定共用 */
export const DRAG_THRESHOLD_PX = 3

/** 自 (x0,y0) 位移是否跨過門檻(任一軸 >= threshold) */
export function crossedThreshold(x0, y0, x1, y1, threshold = DRAG_THRESHOLD_PX) {
    return Math.abs(x1 - x0) >= threshold || Math.abs(y1 - y0) >= threshold
}

/**
 * 手勢啟動守衛(把手/四角/轉折點/節點共用之三段判準): 主鍵、非複選模式、無進行中手勢。
 * @returns {string|null} 拒絕原因 'button' | 'multiselect' | 'gesture', 可啟動回 null
 */
export function gestureBlockedReason({ button, multiSelectActive, activeGesture }) {
    if (multiSelectActive) return 'multiselect'
    if (activeGesture) return 'gesture'
    if (button !== undefined && button !== 0) return 'button'
    return null
}

/**
 * 事件是否來自滑鼠通道(pointer 通道之分流判準, 全套件單一來源)。
 * 滑鼠會同時送出 pointerdown 與 mousedown, 故 pointer 監聽一律跳過 pointerType==='mouse', 由既有 mouse 路徑處理;
 * 觸控/觸控筆只有 pointer 事件(拖曳期間瀏覽器不補送相容滑鼠事件), 由 pointer 路徑處理。
 * 原生 MouseEvent 無 pointerType(undefined), 視為滑鼠通道。
 */
export function isFromMouse(event) {
    return !event || !event.pointerType || event.pointerType === 'mouse'
}

/**
 * 阻止原生預設行為(選字/原生拖曳), 但只在滑鼠通道上做。
 * why: 觸控之 down 事件一旦 preventDefault, 瀏覽器即不再補送該次點按之相容滑鼠事件(實測只剩 click),
 *      而點按語義(node-click / canvas-click / WPopup 之 window 層互斥關閉)全靠那些相容事件;
 *      觸控拖曳改以 CSS touch-action: none 向瀏覽器要手勢, 不需要也不可以在此 preventDefault。
 */
export function preventNativeDefault(event) {
    if (!isFromMouse(event)) return false
    event.preventDefault()
    return true
}

/** 全域游標鎖定(手勢期間整頁同一游標); 回傳移除函式(可重複呼叫) */
export function installGlobalCursor(cursor) {
    if (!cursor || typeof document === 'undefined') return () => {}
    const el = document.createElement('style')
    el.setAttribute('data-vf-cursor', cursor)
    el.textContent = '* { cursor: ' + cursor + ' !important; }'
    document.head.appendChild(el)
    return () => {
        if (el.parentNode) el.parentNode.removeChild(el)
    }
}

/**
 * pointer 通道(觸控/觸控筆)之手勢啟動閘門: 接觸當下不啟動, 待跨越拖曳門檻才以「按下當下之事件」啟動。
 *
 * why 延後:
 * ①觸控之純點按(tap)會由瀏覽器補送整組相容滑鼠事件, 若接觸當下就啟動, 同一次點按會被 pointer 與 mouse 兩條路各跑一遍
 *   (平移起訖各發一次 viewport-change、縮放發一次無位移之 node-resize-end…);拖曳期間則不補送相容事件, 故只有拖曳走 pointer 路。
 * ②點一下把手/四角/轉折點本就不該開始建線或縮放——與節點拖曳既有之「跨門檻才 drag-start」同一語義。
 *
 * onStart 收到的是**按下當下**之事件(pointerdown): 其 button 為 0、座標為接觸點, 故呼叫端既有之主鍵守衛與起點計算皆可原樣沿用
 * (pointermove 之 button 為 -1, 傳它會被主鍵守衛誤擋)。
 *
 * @param {PointerEvent} downEvent 觸發之 pointerdown
 * @param {(downEvent:PointerEvent, moveEvent:PointerEvent)=>void} onStart 跨門檻時呼叫(恰一次)
 * @param {Object} [opt]
 * @param {number} [opt.threshold] 門檻(px), 預設同 DRAG_THRESHOLD_PX
 * @returns {{ dispose: () => boolean, isArmed: () => boolean }}
 */
export function armPointerGesture(downEvent, onStart, opt) {
    const o = opt || {}
    const x0 = downEvent ? downEvent.clientX : 0
    const y0 = downEvent ? downEvent.clientY : 0
    const pid = downEvent ? downEvent.pointerId : undefined
    let armed = true
    //同一指才算數: 多指時其他指之移動不得啟動本手勢(捏合由畫布層另行接管)
    const samePointer = (e) => pid === undefined || e.pointerId === undefined || e.pointerId === pid
    const teardown = () => {
        if (!armed) return false
        armed = false
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onEnd)
        document.removeEventListener('pointercancel', onEnd)
        return true
    }
    const onMove = (e) => {
        if (isFromMouse(e) || !samePointer(e)) return
        if (!crossedThreshold(x0, y0, e.clientX, e.clientY, o.threshold)) return
        if (!teardown()) return
        onStart(downEvent, e)
    }
    const onEnd = (e) => {
        if (isFromMouse(e) || !samePointer(e)) return
        teardown()
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onEnd)
    return {
        dispose: () => teardown(),
        isArmed: () => armed,
    }
}

/**
 * 啟動一段 document 層手勢。
 * @param {Object} o
 * @param {(e:MouseEvent|PointerEvent)=>void} [o.onMove] 每次 mousemove / pointermove(非滑鼠來源, 主鍵仍按著時)
 * @param {(reason:string, e?:Event)=>void} [o.onEnd] 終止(任一原因恰呼叫一次); reason 為 'cancel' 時呼叫端須走取消而非提交
 * @param {string} [o.cursor] 期間鎖定之全域游標
 * @param {boolean} [o.requirePrimary=true] move 時主鍵已放開即以 'buttons-lost' 終止(觸控之 pointermove 接觸中 buttons 為 1, 不受影響)
 * @returns {{ dispose: () => boolean, isActive: () => boolean }} dispose 回傳是否確實收掉一個進行中手勢(以 'dispose' 終止, 不呼叫 onEnd)
 */
export function startDocumentGesture(o) {
    const opt = o || {}
    const requirePrimary = opt.requirePrimary !== false
    let active = true
    const removeCursor = installGlobalCursor(opt.cursor)
    const teardown = () => {
        if (!active) return false
        active = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerCancel)
        window.removeEventListener('blur', onBlur)
        removeCursor()
        return true
    }
    const finish = (reason, e) => {
        if (!teardown()) return
        if (opt.onEnd) opt.onEnd(reason, e)
    }
    const onMove = (e) => {
        if (requirePrimary && (e.buttons & 1) === 0) {
            finish('buttons-lost', e)
            return
        }
        if (opt.onMove) opt.onMove(e)
    }
    const onUp = (e) => finish('mouseup', e)
    const onBlur = (e) => finish('blur', e)
    //pointer 通道(觸控/觸控筆): 滑鼠由上方 mouse 監聽處理, 此處跳過以免同一手勢被走兩遍
    const onPointerMove = (e) => {
        if (isFromMouse(e)) return
        onMove(e)
    }
    const onPointerUp = (e) => {
        if (isFromMouse(e)) return
        finish('pointerup', e)
    }
    //pointercancel: 手勢被系統/瀏覽器中斷(非使用者放開), 取消語義——其座標實測為 (0,0), 呼叫端不得據以做落點判定
    const onPointerCancel = (e) => {
        if (isFromMouse(e)) return
        finish('cancel', e)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('blur', onBlur)
    return {
        dispose: () => teardown(),
        isActive: () => active,
    }
}
