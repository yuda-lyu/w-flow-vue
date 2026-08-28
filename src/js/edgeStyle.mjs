/**
 * 邊之樣式/類別/轉折點解析 —— 純函式(EdgeWrapper 之 computed 只做委派)。
 * 線色/線寬與 marker 同一 resolveLineStyle(edgeMarker.mjs), 兩處不再各自維護 fallback 鏈。
 */
import { resolveLineStyle } from './edgeMarker.mjs'
import { CONN_DEFAULTS } from './defaults.mjs'

/** 有效邊型: conn.type → defConn.type → CONN_DEFAULTS.type */
export function effectiveEdgeType(conn, defConn) {
    const c = conn || {}
    const d = defConn || {}
    return c.type || d.type || CONN_DEFAULTS.type
}

/**
 * path 之 inline style。選取態線寬 +1px(與節點選取態外框加粗同一設計語言)。
 */
export function computeConnStyle(conn, defConn, selected) {
    const c = conn || {}
    const d = defConn || {}
    const line = resolveLineStyle(c, d)
    const base = c.style ? { ...c.style } : {}
    base.stroke = line.color
    base.strokeWidth = selected ? line.width + 1 : line.width
    const dash = c.edgeDasharray !== undefined ? c.edgeDasharray : d.edgeDasharray
    if (dash) base.strokeDasharray = dash
    return base
}

/** label 之字級/字色 */
export function computeLabelStyle(conn, defConn) {
    const c = conn || {}
    const d = defConn || {}
    const s = {}
    const fontSize = c.fontSize || d.fontSize
    const fontColor = c.fontColor || d.fontColor
    if (fontSize) s.fontSize = fontSize + 'px'
    if (fontColor) s.color = fontColor
    return s
}

/** animated: 邊未設定才繼承 defConn(明確 false 覆寫) */
export function effectiveAnimated(conn, defConn) {
    const c = conn || {}
    const d = defConn || {}
    return c.animated !== undefined ? !!c.animated : !!d.animated
}

/** 根 <g> 之 class 陣列 */
export function computeEdgeClasses(conn, defConn, state) {
    const c = conn || {}
    const st = state || {}
    const connClasses = c.class ? (Array.isArray(c.class) ? c.class : [c.class]) : []
    return [
        'vue-flow__edge',
        `vue-flow__edge-${effectiveEdgeType(c, defConn)}`,
        ...connClasses,
        {
            'vue-flow__edge--selected': !!st.selected,
            'vue-flow__edge--animated': effectiveAnimated(c, defConn),
            'vue-flow__edge--hovered': !!st.hovered,
        },
    ]
}

/**
 * 轉折點嚴格解析(runtime domain parser): [[x,y],...] 或 [{x,y},...] → [{x,y},...];
 * 任一點非有限數即整批無效回 null(呼叫端回退自動路由)。表單之草稿容錯解析另在 ConnSettingsForm(draft parser), 語義不同不共用。
 */
export function parseWaypoints(points) {
    if (!Array.isArray(points) || points.length === 0) return null
    const pts = []
    for (const p of points) {
        let x = null
        let y = null
        if (Array.isArray(p) && p.length >= 2) {
            x = Number(p[0]); y = Number(p[1])
        }
        else if (p && typeof p === 'object') {
            x = Number(p.x); y = Number(p.y)
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        pts.push({ x, y })
    }
    return pts
}
