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
 * padding 正規化為四邊(單位一律為**螢幕像素**, 同 Leaflet fitBounds padding 與 OpenLayers View.fit padding)。
 * 輸入可為數值(四邊同值)或 { top, right, bottom, left }(缺漏/非法之邊逐一回退 fallback 之同一邊)。
 * @param {number|{top?:number,right?:number,bottom?:number,left?:number}} padding
 * @param {number|object} [fallback=0] 同型輸入; 其自身非法者再回退 0
 */
export function resolvePadding(padding, fallback) {
    const toSides = (v, fb) => {
        const num = (x, d) => (typeof x === 'number' && isFinite(x) && x >= 0) ? x : d
        if (v && typeof v === 'object') {
            return { top: num(v.top, fb.top), right: num(v.right, fb.right), bottom: num(v.bottom, fb.bottom), left: num(v.left, fb.left) }
        }
        return { top: num(v, fb.top), right: num(v, fb.right), bottom: num(v, fb.bottom), left: num(v, fb.left) }
    }
    const zero = { top: 0, right: 0, bottom: 0, left: 0 }
    return toSides(padding, toSides(fallback, zero))
}

/**
 * 使包絡矩形置中於「容器扣除 padding 後之可視區」之 viewport。
 * padding 為**CSS 像素**(不隨 zoom 縮放; 零人為留白 = 貼邊——受限軸邊距恰為該邊 padding,
 * 但小圖被 maxZoom 夾住時仍居中而留有更大邊距, 屬 zoomMax 行為非 padding 行為)。
 * zoom 上限 maxZoom(不設下限: 大圖可低於 zoomMin, 滾輪縮放再以當前值為下界——既有契約)。
 * 不可行 padding(單軸兩側和 > 軸長-1)依 clampInsets 等比縮限, 保底 1px 可視區於容器內。
 * @param {{minX,minY,maxX,maxY}} bounds
 * @param {{width,height}} container
 * @param {{padding?:number|object, maxZoom?:number}} [opt]
 * @returns {{x:number,y:number,zoom:number}|null}
 */
export function computeFitView(bounds, container, opt) {
    if (!bounds || !container) return null
    const o = opt || {}
    const maxZoom = (typeof o.maxZoom === 'number' && o.maxZoom > 0) ? o.maxZoom : Infinity
    const cw = container.width
    const ch = container.height
    if (!(cw > 0) || !(ch > 0)) return null
    const pad = clampInsets(resolvePadding(o.padding, 0), cw, ch)
    //可視區(容器扣四邊 padding); 保底 1 使極端 padding 不產生 0/負 zoom
    const aw = Math.max(cw - pad.left - pad.right, 1)
    const ah = Math.max(ch - pad.top - pad.bottom, 1)
    const gw = Math.max(bounds.maxX - bounds.minX, 1)
    const gh = Math.max(bounds.maxY - bounds.minY, 1)
    const zoom = Math.min(aw / gw, ah / gh, maxZoom)
    if (!isFinite(zoom) || zoom <= 0) return null
    //包絡中心對齊可視區中心
    return {
        x: pad.left + aw / 2 - (bounds.minX + bounds.maxX) / 2 * zoom,
        y: pad.top + ah / 2 - (bounds.minY + bounds.maxY) / 2 * zoom,
        zoom,
    }
}

/**
 * 不可行 padding 之縮限: 單軸兩側和超過「軸長-1」時等比縮至「軸長-1」(保底 1px 可視區,
 * 且可視區必落於容器內 → 內容不會被推出畫面), 其餘原樣不動——只在真不可行時介入, 無魔法比例。
 */
function clampInsets(pad, cw, ch) {
    const axis = (a, b, total) => {
        const sum = a + b
        const cap = Math.max(total - 1, 0)
        if (sum <= cap) return [a, b]
        const k = cap / sum
        return [a * k, b * k]
    }
    const [left, right] = axis(pad.left, pad.right, cw)
    const [top, bottom] = axis(pad.top, pad.bottom, ch)
    return { top, right, bottom, left }
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

/**
 * 容器尺寸改變之視口補正: 舊容器中心之畫布點於新容器仍居中(zoom 不變)——地圖庫慣例(Leaflet invalidateSize pan:true)。
 * 推導: 舊中心畫布點 c = (oldW/2 - x)/z; 令 newW/2 = c*z + x' → x' = x + (newW - oldW)/2(y 同理)。
 */
export function recenterForResize(viewport, oldSize, newSize) {
    return {
        x: viewport.x + (newSize.width - oldSize.width) / 2,
        y: viewport.y + (newSize.height - oldSize.height) / 2,
        zoom: viewport.zoom,
    }
}
