/**
 * Edge path generators for different edge types.
 */

import { calculateStepPoints } from './stepRouting.mjs'
import { CONN_DEFAULTS } from './defaults.mjs'
import { sideNormal } from './anchorPolicy.mjs'

/**
 * 轉折點嚴格解析(runtime domain parser): [[x,y],...] 或 [{x,y},...] → [{x,y},...];
 * 任一點非有限數即整批無效回 null(呼叫端回退自動路由)。
 * 表單之草稿容錯解析另在 ConnSettingsForm.draftWaypoints(語義不同, 不共用)。
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

/**
 * Build an orthogonal point list passing through forced waypoints.
 * - Leaves the source along its anchor axis (perpendicular to the node edge).
 * - Turns AT each waypoint (leaves it along the other axis than it arrived on).
 * - Arrives at the target along its anchor axis.
 * Inserts at most one corner between consecutive points; skips zero-length segments.
 */
function orthogonalizeThroughPoints(
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    waypoints, stub = CONN_DEFAULTS.defOffset
) {
    const pts = [{ x: sourceX, y: sourceY }]
    const push = (p) => {
        const last = pts[pts.length - 1]
        if (Math.abs(p.x - last.x) > 0.5 || Math.abs(p.y - last.y) > 0.5) pts.push({ x: p.x, y: p.y })
    }
    //兩端先沿外向法線走一段 stub(方向契約: 邊於連接點沿該邊法線射出/射入, 轉折點位置不得反向), 再於 stub 端點轉向
    const sn = sideNormal(sourcePosition)
    const tn = sideNormal(targetPosition)
    push({ x: sourceX + sn.x * stub, y: sourceY + sn.y * stub })
    const targetStub = { x: targetX + tn.x * stub, y: targetY + tn.y * stub }
    // Axis of the first sub-segment when leaving the stub point: perpendicular to the stub
    let leaveHoriz = !(sourcePosition === 'left' || sourcePosition === 'right')

    for (let i = 0; i < waypoints.length; i++) {
        const w = waypoints[i]
        const prev = pts[pts.length - 1]
        const dx = Math.abs(w.x - prev.x)
        const dy = Math.abs(w.y - prev.y)
        let arriveHoriz
        if (dx > 0.5 && dy > 0.5) {
            push(leaveHoriz ? { x: w.x, y: prev.y } : { x: prev.x, y: w.y })
            arriveHoriz = !leaveHoriz
        }
        else {
            arriveHoriz = dx > 0.5
        }
        push(w)
        leaveHoriz = !arriveHoriz //bend point: turn at the waypoint
    }

    // Final hop: reach the target stub point (perpendicular to the target normal), then enter along the normal
    const prev = pts[pts.length - 1]
    const targetHoriz = targetPosition === 'left' || targetPosition === 'right'
    if (Math.abs(targetStub.x - prev.x) > 0.5 && Math.abs(targetStub.y - prev.y) > 0.5) {
        push(targetHoriz ? { x: targetStub.x, y: prev.y } : { x: prev.x, y: targetStub.y })
    }
    push(targetStub)
    push({ x: targetX, y: targetY })
    return pts
}

/**
 * Build a rounded (smoothstep-style) svg path from an orthogonal point list.
 * @returns {{ path: string, labelX: number, labelY: number }}
 */
function buildRoundedPath(points, borderRadius) {
    if (points.length <= 2) {
        const path = `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`
        const labelX = (points[0].x + points[1].x) / 2
        const labelY = (points[0].y + points[1].y) / 2
        return { path, labelX, labelY }
    }

    let path = `M ${points[0].x},${points[0].y}`

    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1]
        const curr = points[i]
        const next = points[i + 1]

        const dx1 = curr.x - prev.x
        const dy1 = curr.y - prev.y
        const dx2 = next.x - curr.x
        const dy2 = next.y - curr.y

        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

        if (len1 === 0 || len2 === 0) {
            // Zero-length segment — skip rounding, just draw straight line
            path += ` L ${curr.x},${curr.y}`
            continue
        }

        const r = Math.min(borderRadius, len1 / 2, len2 / 2)

        const beforeX = curr.x - (dx1 / len1) * r
        const beforeY = curr.y - (dy1 / len1) * r
        const afterX = curr.x + (dx2 / len2) * r
        const afterY = curr.y + (dy2 / len2) * r

        path += ` L ${beforeX},${beforeY} Q ${curr.x},${curr.y} ${afterX},${afterY}`
    }

    path += ` L ${points[points.length - 1].x},${points[points.length - 1].y}`

    const label = labelAtHalfLength(points)
    return { path, labelX: label.x, labelY: label.y }
}

/**
 * Calculate the control point offset for bezier curves based on handle position.
 */
function getControlOffset(distance, position) {
    switch (position) {
    case 'top': return { x: 0, y: -distance }
    case 'bottom': return { x: 0, y: distance }
    case 'left': return { x: -distance, y: 0 }
    case 'right': return { x: distance, y: 0 }
    default: return { x: 0, y: 0 }
    }
}

/**
 * Get bezier curve path.
 * @returns {{ path: string, labelX: number, labelY: number }}
 */
export function getBezierPath({
    sourceX, sourceY, sourcePosition = 'bottom',
    targetX, targetY, targetPosition = 'top',
    curvature = 0.25,
    points,
}) {
    // Forced waypoints: smooth curve passing exactly through each point (Catmull-Rom → cubic)
    const wps = parseWaypoints(points)
    if (wps) {
        const pts = [{ x: sourceX, y: sourceY }, ...wps, { x: targetX, y: targetY }]
        //兩端切線沿外向法線(方向契約), 中間點沿 Catmull-Rom
        const sn = sideNormal(sourcePosition)
        const tn = sideNormal(targetPosition)
        const segLen = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
        let path = `M ${pts[0].x},${pts[0].y}`
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i]
            const p1 = pts[i]
            const p2 = pts[i + 1]
            const p3 = pts[i + 2] || p2
            let c1x = p1.x + (p2.x - p0.x) / 6
            let c1y = p1.y + (p2.y - p0.y) / 6
            let c2x = p2.x - (p3.x - p1.x) / 6
            let c2y = p2.y - (p3.y - p1.y) / 6
            if (i === 0) {
                const k = Math.max(segLen(p1, p2) / 3, 25)
                c1x = p1.x + sn.x * k
                c1y = p1.y + sn.y * k
            }
            if (i === pts.length - 2) {
                const k = Math.max(segLen(p1, p2) / 3, 25)
                c2x = p2.x + tn.x * k
                c2y = p2.y + tn.y * k
            }
            path += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
        }
        const label = labelAtHalfLength(pts)
        return { path, labelX: label.x, labelY: label.y }
    }

    const dist = Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2))
    const offset = Math.max(dist * curvature, 25)

    const s = getControlOffset(offset, sourcePosition)
    const t = getControlOffset(offset, targetPosition)

    const controlX1 = sourceX + s.x
    const controlY1 = sourceY + s.y
    const controlX2 = targetX + t.x
    const controlY2 = targetY + t.y

    const path = `M ${sourceX},${sourceY} C ${controlX1},${controlY1} ${controlX2},${controlY2} ${targetX},${targetY}`

    const labelX = (sourceX + controlX1 + controlX2 + targetX) / 4
    const labelY = (sourceY + controlY1 + controlY2 + targetY) / 4

    return { path, labelX, labelY }
}

/**
 * Get straight line path.
 * @returns {{ path: string, labelX: number, labelY: number }}
 */
export function getStraightPath({ sourceX, sourceY, targetX, targetY, points }) {
    // Forced waypoints: polyline through each point
    const wps = parseWaypoints(points)
    if (wps) {
        const pts = [{ x: sourceX, y: sourceY }, ...wps, { x: targetX, y: targetY }]
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
        const label = labelAtHalfLength(pts)
        return { path, labelX: label.x, labelY: label.y }
    }

    const path = `M ${sourceX},${sourceY} L ${targetX},${targetY}`
    const labelX = (sourceX + targetX) / 2
    const labelY = (sourceY + targetY) / 2
    return { path, labelX, labelY }
}

/**
 * Get step (right-angle) path.
 * @returns {{ path: string, labelX: number, labelY: number }}
 */
export function getStepPath({
    sourceX, sourceY, sourcePosition = 'bottom',
    targetX, targetY, targetPosition = 'top',
    offset = CONN_DEFAULTS.defOffset,
    allNodes, nodeInternals,
    points,
}) {
    // Forced waypoints bypass automatic routing (anchors still honored at both ends)
    const wps = parseWaypoints(points)
    const pts = wps
        ? orthogonalizeThroughPoints(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, wps, offset)
        : calculateStepPoints(
            sourceX, sourceY, sourcePosition,
            targetX, targetY, targetPosition,
            offset, allNodes, nodeInternals
        )
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
    const label = labelAtHalfLength(pts)
    return { path, labelX: label.x, labelY: label.y }
}

/**
 * Get smooth step (rounded right-angle) path.
 * @returns {{ path: string, labelX: number, labelY: number }}
 */
export function getSmoothStepPath({
    sourceX, sourceY, sourcePosition = 'bottom',
    targetX, targetY, targetPosition = 'top',
    borderRadius = 5,
    offset = CONN_DEFAULTS.defOffset,
    allNodes, nodeInternals,
    points,
}) {
    // Forced waypoints bypass automatic routing (anchors still honored at both ends)
    const wps = parseWaypoints(points)
    const pts = wps
        ? orthogonalizeThroughPoints(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, wps, offset)
        : calculateStepPoints(
            sourceX, sourceY, sourcePosition,
            targetX, targetY, targetPosition,
            offset, allNodes, nodeInternals
        )

    return buildRoundedPath(pts, borderRadius)
}

/**
 * Find the point at exactly half the total Manhattan path length.
 */
function labelAtHalfLength(pts) {
    if (pts.length < 2) return { x: pts[0].x, y: pts[0].y }
    let totalLen = 0
    for (let i = 0; i < pts.length - 1; i++) {
        totalLen += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y)
    }
    let half = totalLen / 2
    let acc = 0
    for (let i = 0; i < pts.length - 1; i++) {
        let segLen = Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y)
        if (acc + segLen >= half) {
            let ratio = segLen > 0 ? (half - acc) / segLen : 0
            return {
                x: pts[i].x + (pts[i + 1].x - pts[i].x) * ratio,
                y: pts[i].y + (pts[i + 1].y - pts[i].y) * ratio,
            }
        }
        acc += segLen
    }
    return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }
}

const PATH_FUNCTIONS = {
    bezier: getBezierPath,
    straight: getStraightPath,
    step: getStepPath,
    smoothstep: getSmoothStepPath,
}

/** 支援之邊型值域(設定表單之 Type 下拉即由此衍生, 不另抄一份; 新增路徑函式時選項自動跟上) */
export const EDGE_TYPES = Object.keys(PATH_FUNCTIONS)

/** 邊型 → 路徑函式(未知邊型回 bezier); EdgeWrapper 與 ConnectionLine 共用同一對照表 */
export function getPathFunction(type) {
    return PATH_FUNCTIONS[type] || PATH_FUNCTIONS.bezier
}
