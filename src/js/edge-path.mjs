/**
 * Edge path generators for different edge types.
 */

import { calculateStepPoints, clearStepCache } from './step-routing.mjs'

export { clearStepCache }

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
}) {
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
export function getStraightPath({ sourceX, sourceY, targetX, targetY }) {
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
    offset = 20,
    allNodes, nodeInternals, connFromId, connToId,
}) {
    const points = calculateStepPoints(
        sourceX, sourceY, sourcePosition,
        targetX, targetY, targetPosition,
        offset, allNodes, nodeInternals, connFromId, connToId
    )
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
    const label = labelAtHalfLength(points)
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
    offset = 20,
    allNodes, nodeInternals, connFromId, connToId,
}) {
    const points = calculateStepPoints(
        sourceX, sourceY, sourcePosition,
        targetX, targetY, targetPosition,
        offset, allNodes, nodeInternals, connFromId, connToId
    )

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
