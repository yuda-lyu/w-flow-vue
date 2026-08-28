/**
 * 邊之兩端方位 —— 單一事實來源是「連線」(spec/流程_互動契約.md §4)。
 *
 * 節點四邊中點皆為連接點, 無連出/連入之分; 一條邊記錄自己兩端之方位:
 *   fromPosition: from 節點之連接邊; 邊於該點沿該邊之外向法線射出
 *   toPosition:   to 節點之連接邊; 邊於該點沿該邊之外向法線射出(自節點看皆為向外, 兩端語義相同)
 * 方向恆為節點外接矩形該邊之外向法向量(四種), 與形狀無關。
 *
 * 解析順序(正式契約):
 *   from 端: conn.fromPosition → defConn.fromPosition → 'bottom'
 *   to 端:   conn.toPosition   → defConn.toPosition   → 'top'
 */

export const SIDES = ['top', 'right', 'bottom', 'left']
export const SOURCE_FALLBACK = 'bottom'
export const TARGET_FALLBACK = 'top'

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

/** 是否為合法方位值 */
export function isSide(v) {
    return SIDES.indexOf(v) >= 0
}

/** 邊之外向單位法向量(方位 → 方向; 非法方位視為 bottom) */
export function sideNormal(side) {
    switch (side) {
    case 'top': return { x: 0, y: -1 }
    case 'left': return { x: -1, y: 0 }
    case 'right': return { x: 1, y: 0 }
    default: return { x: 0, y: 1 }
    }
}

/** 對邊(建線中無 hover 落點時預覽線遠端之預設方位) */
export function oppositeSide(side) {
    return OPPOSITE[side] || TARGET_FALLBACK
}

/** 邊之 from 端方位 */
export function connSourceSide(conn, defConn) {
    const c = conn || {}
    const d = defConn || {}
    if (isSide(c.fromPosition)) return c.fromPosition
    if (isSide(d.fromPosition)) return d.fromPosition
    return SOURCE_FALLBACK
}

/** 邊之 to 端方位 */
export function connTargetSide(conn, defConn) {
    const c = conn || {}
    const d = defConn || {}
    if (isSide(c.toPosition)) return c.toPosition
    if (isSide(d.toPosition)) return d.toPosition
    return TARGET_FALLBACK
}
