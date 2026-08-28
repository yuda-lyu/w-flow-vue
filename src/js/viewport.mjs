/**
 * 視口(viewport)數學 —— 純函式, 不碰 DOM 與元件狀態。
 * viewport = { x, y, zoom }: 畫布座標 → 螢幕座標為 screen = flow * zoom + (x, y)。
 * WFlowVue 之 fitView / zoomAtCenter / 滾輪縮放 / panToNode / 框選 / 建線落點皆以此為單一公式來源。
 */
import { resolveNodeSize } from './geometry.mjs'

/**
 * 可見節點之包絡矩形(hidden 節點不計)。
 * @returns {{ minX:number, minY:number, maxX:number, maxY:number }|null} 無可見節點回 null
 */
export function nodesBounds(nodes, nodeInternals, defNode) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const ni = nodeInternals || {}
    for (const n of (nodes || [])) {
        if (!n || n.hidden || !n.position) continue
        const { width, height } = resolveNodeSize(n, ni[n.id], defNode)
        minX = Math.min(minX, n.position.x)
        minY = Math.min(minY, n.position.y)
        maxX = Math.max(maxX, n.position.x + width)
        maxY = Math.max(maxY, n.position.y + height)
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null
    return { minX, minY, maxX, maxY }
}

/**
 * 容器尺寸: rect 之寬/高逐軸須為正的有限數, 否則該軸回退 fallback(未佈局/jsdom 之 0×0 不得使 zoom 變 0)。
 */
export function resolveContainerSize(rect, fallback) {
    const ok = (v) => typeof v === 'number' && isFinite(v) && v > 0
    const fb = fallback || {}
    const r = rect || {}
    return {
        width: ok(r.width) ? r.width : fb.width,
        height: ok(r.height) ? r.height : fb.height,
    }
}

/**
 * 使包絡矩形(含 padding)恰好落入容器並置中之 viewport。
 * zoom 上限 maxZoom(不設下限: 大圖可低於 zoomMin, 滾輪縮放再以當前值為下界——既有契約)。
 * @param {{minX,minY,maxX,maxY}} bounds
 * @param {{width,height}} container
 * @param {{padding?:number, maxZoom?:number}} [opt]
 * @returns {{x:number,y:number,zoom:number}|null}
 */
export function computeFitView(bounds, container, opt) {
    if (!bounds || !container) return null
    const o = opt || {}
    const padding = (typeof o.padding === 'number' && o.padding >= 0) ? o.padding : 0
    const maxZoom = (typeof o.maxZoom === 'number' && o.maxZoom > 0) ? o.maxZoom : Infinity
    const cw = container.width
    const ch = container.height
    if (!(cw > 0) || !(ch > 0)) return null
    const gw = Math.max(bounds.maxX - bounds.minX + padding * 2, 1)
    const gh = Math.max(bounds.maxY - bounds.minY + padding * 2, 1)
    const zoom = Math.min(cw / gw, ch / gh, maxZoom)
    if (!isFinite(zoom) || zoom <= 0) return null
    return {
        x: (cw - (bounds.maxX + bounds.minX) * zoom) / 2,
        y: (ch - (bounds.maxY + bounds.minY) * zoom) / 2,
        zoom,
    }
}

/** 螢幕座標(相對容器左上)→ 畫布座標 */
export function screenToFlow(point, viewport) {
    return { x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom }
}

/** 畫布座標 → 螢幕座標(相對容器左上) */
export function flowToScreen(point, viewport) {
    return { x: point.x * viewport.zoom + viewport.x, y: point.y * viewport.zoom + viewport.y }
}

/** client 座標 → 相對容器左上之螢幕座標 */
export function clientToLocal(clientX, clientY, rect) {
    return { x: clientX - (rect ? rect.left : 0), y: clientY - (rect ? rect.top : 0) }
}

/**
 * 以焦點(容器相對座標)為錨之縮放: 焦點下之畫布點於縮放前後不動。
 */
export function zoomAroundPoint(viewport, focal, newZoom) {
    const scale = newZoom / viewport.zoom
    return {
        x: focal.x - (focal.x - viewport.x) * scale,
        y: focal.y - (focal.y - viewport.y) * scale,
        zoom: newZoom,
    }
}

/**
 * 縮放夾限: 上界 zoomMax; 下界取 zoomMin 與當前值之較小者(fitView 可低於 zoomMin, 之後滾輪縮放不得跳回)。
 */
export function clampZoom(zoom, zoomMin, zoomMax, current) {
    const lower = Math.min(zoomMin, current)
    return Math.max(lower, Math.min(zoomMax, zoom))
}

/** 使畫布點 center 落在容器中央之 viewport */
export function computeCenterView(center, container, zoom) {
    return { x: container.width / 2 - center.x * zoom, y: container.height / 2 - center.y * zoom, zoom }
}

/** 緩動(panToNode 動畫) */
export function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
