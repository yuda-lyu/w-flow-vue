/**
 * 建線之 DOM target adapter: 把游標下的 DOM 正規化為 endpoint descriptor,
 * 並管理把手上的暫態視覺標記(dataset, 非 class——Vue 對 class 綁定整串覆寫,
 * 外加 class 會於重渲染時被抹除; 未列於模板之 data-* 屬性則不受 patch 影響)。
 * 樣式端以 [data-connect-role] / [data-connect-status] 選擇器對應(Handle.vue)。
 */

/**
 * 取游標座標下之把手元素(無則 null)。
 */
export function findHandleElAt(clientX, clientY) {
    //jsdom 無版面未實作 elementFromPoint(測試各自 stub); 無此函式即視為無把手
    if (typeof document.elementFromPoint !== 'function') return null
    const el = document.elementFromPoint(clientX, clientY)
    return (el && el.closest) ? el.closest('.vue-flow__handle') : null
}

/**
 * 把手元素 → endpoint descriptor。
 * flowId 歸屬檢查: 把手必須屬於本 flow 實例(頁面可能有多個/巢狀 flow,
 * elementFromPoint 可能撿到他 flow 之把手; 以最近之 [data-flow-id] 祖先比對, 不符即回 null)。
 */
export function describeHandleEndpoint(handleEl, flowId) {
    if (!handleEl || !handleEl.closest) return null
    const root = handleEl.closest('[data-flow-id]')
    if (!root || root.getAttribute('data-flow-id') !== flowId) return null
    const nodeEl = handleEl.closest('.vue-flow__node')
    if (!nodeEl || !nodeEl.dataset.id) return null
    return {
        nodeId: nodeEl.dataset.id,
        handleId: handleEl.dataset.handleId || null,
        type: handleEl.dataset.handleType || null,
        position: handleEl.dataset.handlePosition || null,
        binding: handleEl.dataset.handleBinding || 'auto',
        connectable: !handleEl.classList.contains('vue-flow__handle--not-connectable'),
        element: handleEl,
    }
}

/**
 * 標記游標下把手之判定結果('valid' | 'invalid'); status 為空即清除。
 */
export function setHandleConnectStatus(handleEl, status) {
    if (!handleEl) return
    if (status) handleEl.setAttribute('data-connect-status', status)
    else handleEl.removeAttribute('data-connect-status')
}

/**
 * 標記/清除出發把手(role: 'origin')。
 */
export function setHandleConnectRole(handleEl, role) {
    if (!handleEl) return
    if (role) handleEl.setAttribute('data-connect-role', role)
    else handleEl.removeAttribute('data-connect-role')
}
