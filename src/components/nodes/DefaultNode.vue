<template>
  <div class="vue-flow__node-basic">
    <Handle
      type="target"
      :position="nodeFromPosition"
      :connectable="connectable"
      :locked="locked"
      :offset="targetOffset"
      :custom-style="targetHandleStyle"
      @connect-start="$emit('connect-start', $event)"
    />
    <div class="vue-flow__node-label" :style="labelStyle">{{ node.name }}</div>
    <Handle
      type="source"
      :position="nodeToPosition"
      :connectable="connectable"
      :locked="locked"
      :offset="sourceOffset"
      :custom-style="sourceHandleStyle"
      @connect-start="$emit('connect-start', $event)"
    />
  </div>
</template>

<script>
import Handle from './Handle.vue'

export default {
    name: 'DefaultNode',
    components: { Handle },
    inject: { getDefNode: { default: () => () => ({}) } },
    props: {
        node: { type: Object, required: true },
        connectable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
    },
    computed: {
        dn() {
            return this.getDefNode()
        },
        nodeToPosition() {
            return this.node.toPosition || this.dn.toPosition || 'bottom'
        },
        nodeFromPosition() {
            return this.node.fromPosition || this.dn.fromPosition || 'top'
        },
        sameSide() {
            return this.nodeToPosition === this.nodeFromPosition
        },
        isDiamond() {
            return this.node.shape === 'diamond'
        },
        isEllipse() {
            return this.node.shape === 'ellipse'
        },
        isTriangle() {
            let s = this.node.shape
            return s === 'triangle' || s === 'triangle-right' || s === 'triangle-down' || s === 'triangle-left'
        },
        isSvgShape() {
            return this.isDiamond || this.isEllipse || this.isTriangle
        },
        targetOffset() {
            if (this.isSvgShape) return null
            return this.sameSide ? '33%' : null
        },
        sourceOffset() {
            if (this.isSvgShape) return null
            return this.sameSide ? '67%' : null
        },
        targetHandleStyle() {
            if (this.isTriangle) {
                let pos = this.nodeFromPosition
                return this.getTriangleHandleStyle(pos, this.sameSide ? 0.33 : 0.5)
            }
            if (this.isEllipse && this.sameSide) {
                return this.getEllipseHandleStyle(this.nodeFromPosition, 0.33)
            }
            if (!this.isDiamond || !this.sameSide) return null
            return this.getDiamondOffsetStyle(this.nodeFromPosition, 0.33)
        },
        sourceHandleStyle() {
            if (this.isTriangle) {
                let pos = this.nodeToPosition
                return this.getTriangleHandleStyle(pos, this.sameSide ? 0.67 : 0.5)
            }
            if (this.isEllipse && this.sameSide) {
                return this.getEllipseHandleStyle(this.nodeToPosition, 0.67)
            }
            if (!this.isDiamond || !this.sameSide) return null
            return this.getDiamondOffsetStyle(this.nodeToPosition, 0.67)
        },
        labelStyle() {
            if (!this.isTriangle) return null
            let w = this.node.width || this.dn.width || 150
            let h = this.node.height || this.dn.height || 40
            let s = this.node.shape
            let x = 0
            let y = 0
            if (s === 'triangle-right') x = Math.round(-w / 6)
            else if (s === 'triangle-down') y = Math.round(-h / 6)
            else if (s === 'triangle-left') x = Math.round(w / 6)
            else y = Math.round(h / 6)
            return { transform: `translate(${x}px, ${y}px)` }
        },
    },
    methods: {
        getTriangleHandleStyle(side, ratio) {
            // Get vertices based on triangle direction
            let v = this.triangleVertices()
            let pt = this.pointOnTriangleSide(v, side, ratio)
            return { left: pt.x + '%', top: pt.y + '%', transform: 'translate(-50%, -50%)' }
        },
        triangleVertices() {
            // Returns 3 vertices in % coords: { apex, baseA, baseB }
            // Also returns which sides correspond to 'top','right','bottom','left'
            let s = this.node.shape
            if (s === 'triangle-right') {
                // apex right-center, base on left
                return {
                    apex: { x: 100, y: 50 },
                    baseA: { x: 0, y: 0 },
                    baseB: { x: 0, y: 100 },
                    apexSide: 'right',
                    baseSide: 'left',
                    edgeA: 'top',
                    edgeB: 'bottom'
                }
            }
            if (s === 'triangle-down') {
                // apex bottom-center, base on top
                return {
                    apex: { x: 50, y: 100 },
                    baseA: { x: 0, y: 0 },
                    baseB: { x: 100, y: 0 },
                    apexSide: 'bottom',
                    baseSide: 'top',
                    edgeA: 'left',
                    edgeB: 'right'
                }
            }
            if (s === 'triangle-left') {
                // apex left-center, base on right
                return {
                    apex: { x: 0, y: 50 },
                    baseA: { x: 100, y: 0 },
                    baseB: { x: 100, y: 100 },
                    apexSide: 'left',
                    baseSide: 'right',
                    edgeA: 'top',
                    edgeB: 'bottom'
                }
            }
            // triangle (up): apex top-center, base on bottom
            return {
                apex: { x: 50, y: 0 },
                baseA: { x: 0, y: 100 },
                baseB: { x: 100, y: 100 },
                apexSide: 'top',
                baseSide: 'bottom',
                edgeA: 'left',
                edgeB: 'right'
            }
        },
        pointOnTriangleSide(v, side, ratio) {
            // apexSide: the side with the apex vertex (a single point, but for same-side we sweep across adjacent edges)
            // baseSide: the straight base edge
            // edgeA: the edge from baseA to apex
            // edgeB: the edge from apex to baseB
            if (side === v.apexSide) {
                // Sweep from edgeA near base → apex → edgeB near base
                if (ratio <= 0.5) {
                    let t = ratio * 2
                    return { x: v.baseA.x + (v.apex.x - v.baseA.x) * t, y: v.baseA.y + (v.apex.y - v.baseA.y) * t }
                }
                else {
                    let t2 = (ratio - 0.5) * 2
                    return { x: v.apex.x + (v.baseB.x - v.apex.x) * t2, y: v.apex.y + (v.baseB.y - v.apex.y) * t2 }
                }
            }
            if (side === v.baseSide) {
                // Straight line from baseA to baseB
                return { x: v.baseA.x + (v.baseB.x - v.baseA.x) * ratio, y: v.baseA.y + (v.baseB.y - v.baseA.y) * ratio }
            }
            if (side === v.edgeA) {
                // Edge from apex to baseA
                return { x: v.apex.x + (v.baseA.x - v.apex.x) * ratio, y: v.apex.y + (v.baseA.y - v.apex.y) * ratio }
            }
            if (side === v.edgeB) {
                // Edge from apex to baseB
                return { x: v.apex.x + (v.baseB.x - v.apex.x) * ratio, y: v.apex.y + (v.baseB.y - v.apex.y) * ratio }
            }
            return { x: 50, y: 50 }
        },
        getEllipseHandleStyle(side, ratio) {
            // Map ratio (0..1) to an angle on the ellipse quadrant for the given side
            // For 'top': angle goes from PI (left) to 0 (right), ratio 0.5 = top center
            // We position the handle on the ellipse border using parametric coords
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
            // Ellipse parametric: x = 50% + 50% * cos(angle), y = 50% - 50% * sin(angle)
            let leftPct = 50 + 50 * Math.cos(angle)
            let topPct = 50 - 50 * Math.sin(angle)
            return { left: leftPct + '%', top: topPct + '%', transform: 'translate(-50%, -50%)' }
        },
        getDiamondOffsetStyle(side, ratio) {
            switch (side) {
            case 'top':
                if (ratio <= 0.5) {
                    let t = ratio * 2
                    return { left: (t * 50) + '%', top: ((1 - t) * 50) + '%', transform: 'translate(-50%, -50%)' }
                }
                else {
                    let t2 = (ratio - 0.5) * 2
                    return { left: (50 + t2 * 50) + '%', top: (t2 * 50) + '%', transform: 'translate(-50%, -50%)' }
                }
            case 'bottom':
                if (ratio <= 0.5) {
                    let t3 = ratio * 2
                    return { left: (t3 * 50) + '%', top: (50 + t3 * 50) + '%', transform: 'translate(-50%, -50%)' }
                }
                else {
                    let t4 = (ratio - 0.5) * 2
                    return { left: (50 + t4 * 50) + '%', top: (100 - t4 * 50) + '%', transform: 'translate(-50%, -50%)' }
                }
            case 'left':
                if (ratio <= 0.5) {
                    let t5 = ratio * 2
                    return { left: ((1 - t5) * 50) + '%', top: (t5 * 50) + '%', transform: 'translate(-50%, -50%)' }
                }
                else {
                    let t6 = (ratio - 0.5) * 2
                    return { left: (t6 * 50) + '%', top: (50 + t6 * 50) + '%', transform: 'translate(-50%, -50%)' }
                }
            case 'right':
                if (ratio <= 0.5) {
                    let t7 = ratio * 2
                    return { left: (50 + t7 * 50) + '%', top: (t7 * 50) + '%', transform: 'translate(-50%, -50%)' }
                }
                else {
                    let t8 = (ratio - 0.5) * 2
                    return { left: (100 - t8 * 50) + '%', top: (50 + t8 * 50) + '%', transform: 'translate(-50%, -50%)' }
                }
            default:
                return null
            }
        },
    },
}
</script>

<style scoped>
.vue-flow__node-basic {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 10px 20px;
}
</style>
