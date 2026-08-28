/**
 * document 層滑鼠手勢工具 —— 節點拖曳/縮放、轉折點拖曳、label 位移追蹤共用同一份「掛/卸監聽 + 全域游標 + 終止原因」。
 *
 * 終止原因(reason): 'mouseup' | 'blur' | 'buttons-lost'(mousemove 時主鍵已放開: 視窗外放開未送達 mouseup)| 'dispose'(呼叫端主動收尾, 如銷毀/被新手勢取代)。
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
 * 啟動一段 document 層手勢。
 * @param {Object} o
 * @param {(e:MouseEvent)=>void} [o.onMove] 每次 mousemove(主鍵仍按著時)
 * @param {(reason:string, e?:Event)=>void} [o.onEnd] 終止(任一原因恰呼叫一次)
 * @param {string} [o.cursor] 期間鎖定之全域游標
 * @param {boolean} [o.requirePrimary=true] mousemove 時主鍵已放開即以 'buttons-lost' 終止
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
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    window.addEventListener('blur', onBlur)
    return {
        dispose: () => teardown(),
        isActive: () => active,
    }
}
