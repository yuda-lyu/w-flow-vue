/**
 * Calculate the absolute position of a handle on the canvas.
 */
export function getHandlePosition(node, handlePosition, nodeInternals, handleType) {
    const internals = nodeInternals || {}
    const w = (internals.width) || node.width || 150
    const h = (internals.height) || node.height || 40
    const x = node.position.x
    const y = node.position.y
    const isDiamond = node.shape === 'diamond'
    const isEllipse = node.shape === 'ellipse'
    const ns = node.shape
    const isTriangle = ns === 'triangle' || ns === 'triangle-right' || ns === 'triangle-down' || ns === 'triangle-left'

    // Check if this is a default node with source and target on the same side
    const sameSide = node.type === 'basic' &&
    (node.toPosition || 'bottom') === (node.fromPosition || 'top')
    let ratio = 0.5
    if (sameSide && handleType === 'target') ratio = 0.33
    if (sameSide && handleType === 'source') ratio = 0.67

    // Diamond same-side: position along diamond edges
    if (isDiamond && sameSide) {
        return getDiamondEdgePoint(x, y, w, h, handlePosition, ratio)
    }

    // Ellipse: position on the ellipse border
    if (isEllipse) {
        return getEllipseEdgePoint(x, y, w, h, handlePosition, ratio)
    }

    // Triangle: position on the triangle edges
    if (isTriangle) {
        return getTriangleEdgePoint(x, y, w, h, handlePosition, ratio, ns)
    }

    switch (handlePosition) {
    case 'top': return { x: x + w * ratio, y }
    case 'bottom': return { x: x + w * ratio, y: y + h }
    case 'left': return { x, y: y + h * ratio }
    case 'right': return { x: x + w, y: y + h * ratio }
    default: return { x: x + w / 2, y: y + h }
    }
}

/**
 * Get a point on the diamond edge for same-side handles.
 * Each "side" of the diamond is split into two edges meeting at the vertex.
 * ratio < 0.5: on the first edge, ratio >= 0.5: on the second edge.
 */
function getDiamondEdgePoint(x, y, w, h, side, ratio) {
    let halfW = w / 2
    let halfH = h / 2

    switch (side) {
    case 'top':
        if (ratio <= 0.5) {
            let t = ratio * 2
            return { x: x + t * halfW, y: y + halfH - t * halfH }
        }
        else {
            let t = (ratio - 0.5) * 2
            return { x: x + halfW + t * halfW, y: y + t * halfH }
        }
    case 'bottom':
        if (ratio <= 0.5) {
            let t = ratio * 2
            return { x: x + t * halfW, y: y + halfH + t * halfH }
        }
        else {
            let t = (ratio - 0.5) * 2
            return { x: x + halfW + t * halfW, y: y + h - t * halfH }
        }
    case 'left':
        if (ratio <= 0.5) {
            let t = ratio * 2
            return { x: x + halfW - t * halfW, y: y + t * halfH }
        }
        else {
            let t = (ratio - 0.5) * 2
            return { x: x + t * halfW, y: y + halfH + t * halfH }
        }
    case 'right':
        if (ratio <= 0.5) {
            let t = ratio * 2
            return { x: x + halfW + t * halfW, y: y + t * halfH }
        }
        else {
            let t = (ratio - 0.5) * 2
            return { x: x + w - t * halfW, y: y + halfH + t * halfH }
        }
    default:
        return { x: x + halfW, y: y + h }
    }
}

/**
 * Get a point on the ellipse edge for handle positioning.
 * Maps ratio (0..1) to a parametric angle based on the side.
 */
function getEllipseEdgePoint(x, y, w, h, side, ratio) {
    let cx = x + w / 2
    let cy = y + h / 2
    let rx = w / 2
    let ry = h / 2
    let angle

    switch (side) {
    case 'top':
        angle = Math.PI * (1 - ratio); break
    case 'bottom':
        angle = Math.PI * (ratio - 1); break
    case 'left':
        angle = Math.PI * (0.5 + ratio); break
    case 'right':
        angle = Math.PI * (0.5 - ratio); break
    default:
        angle = 0
    }

    return {
        x: cx + rx * Math.cos(angle),
        y: cy - ry * Math.sin(angle)
    }
}

/**
 * Get a point on the triangle edge for handle positioning.
 * Supports 4 directions: triangle (up), triangle-right, triangle-down, triangle-left.
 */
function getTriangleEdgePoint(x, y, w, h, side, ratio, shape) {
    // Get absolute vertices based on direction
    let apex, baseA, baseB, apexSide, baseSide, edgeA, edgeB
    if (shape === 'triangle-right') {
        apex = { x: x + w, y: y + h / 2 }; baseA = { x, y }; baseB = { x, y: y + h }
        apexSide = 'right'; baseSide = 'left'; edgeA = 'top'; edgeB = 'bottom'
    }
    else if (shape === 'triangle-down') {
        apex = { x: x + w / 2, y: y + h }; baseA = { x, y }; baseB = { x: x + w, y }
        apexSide = 'bottom'; baseSide = 'top'; edgeA = 'left'; edgeB = 'right'
    }
    else if (shape === 'triangle-left') {
        apex = { x, y: y + h / 2 }; baseA = { x: x + w, y }; baseB = { x: x + w, y: y + h }
        apexSide = 'left'; baseSide = 'right'; edgeA = 'top'; edgeB = 'bottom'
    }
    else {
    // triangle (up)
        apex = { x: x + w / 2, y }; baseA = { x, y: y + h }; baseB = { x: x + w, y: y + h }
        apexSide = 'top'; baseSide = 'bottom'; edgeA = 'left'; edgeB = 'right'
    }

    if (side === apexSide) {
        if (ratio <= 0.5) {
            let t = ratio * 2
            return { x: baseA.x + (apex.x - baseA.x) * t, y: baseA.y + (apex.y - baseA.y) * t }
        }
        else {
            let t2 = (ratio - 0.5) * 2
            return { x: apex.x + (baseB.x - apex.x) * t2, y: apex.y + (baseB.y - apex.y) * t2 }
        }
    }
    if (side === baseSide) {
        return { x: baseA.x + (baseB.x - baseA.x) * ratio, y: baseA.y + (baseB.y - baseA.y) * ratio }
    }
    if (side === edgeA) {
        return { x: apex.x + (baseA.x - apex.x) * ratio, y: apex.y + (baseA.y - apex.y) * ratio }
    }
    if (side === edgeB) {
        return { x: apex.x + (baseB.x - apex.x) * ratio, y: apex.y + (baseB.y - apex.y) * ratio }
    }
    return { x: x + w / 2, y: y + h / 2 }
}

/**
 * Get all nodes that overlap with a given rectangle.
 */
export function getOverlappingNodes(rect, nodes, nodeInternals) {
    return nodes.filter(node => {
        const internals = (nodeInternals && nodeInternals[node.id]) || {}
        const w = internals.width || node.width || 150
        const h = internals.height || node.height || 40
        const nodeRect = {
            x: node.position.x,
            y: node.position.y,
            width: w,
            height: h,
        }
        return rectsOverlap(rect, nodeRect)
    })
}

/**
 * Check if two rectangles overlap.
 */
function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
    )
}

/**
 * Clamp a position within a coordinate extent.
 */
export function clampPosition(position, extent) {
    if (!extent) return position
    return {
        x: Math.max(extent[0][0], Math.min(extent[1][0], position.x)),
        y: Math.max(extent[0][1], Math.min(extent[1][1], position.y)),
    }
}

/**
 * Snap a position to the nearest grid point.
 * @param {{ x: number, y: number }} position
 * @param {number|null} gridSize - Grid cell size (single number for both axes)
 */
export function snapPosition(position, gridSize) {
    if (!gridSize) return position
    return {
        x: Math.round(position.x / gridSize) * gridSize,
        y: Math.round(position.y / gridSize) * gridSize,
    }
}
