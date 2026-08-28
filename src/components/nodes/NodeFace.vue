<template>
  <div class="vue-flow__node-face">
    <!-- Diamond shape SVG -->
    <svg
      v-if="isDiamond"
      class="vue-flow__shape-svg"
      :viewBox="svgViewBox"
      preserveAspectRatio="none"
    >
      <polygon
        :points="diamondPoints"
        :fill="node.faceColor || dn.faceColor || '#fff'"
        :fill-opacity="1"
        :stroke="node.edgeColor || dn.edgeColor || '#bbb'"
        :stroke-opacity="1"
        :stroke-width="node.edgeWidth !== undefined ? node.edgeWidth : (dn.edgeWidth !== undefined ? dn.edgeWidth : 1)"
      />
    </svg>
    <!-- Ellipse shape SVG -->
    <svg
      v-if="isEllipse"
      class="vue-flow__shape-svg"
      :viewBox="svgViewBox"
      preserveAspectRatio="none"
    >
      <ellipse
        :cx="nodeW / 2"
        :cy="nodeH / 2"
        :rx="nodeW / 2"
        :ry="nodeH / 2"
        :fill="node.faceColor || dn.faceColor || '#fff'"
        :fill-opacity="1"
        :stroke="node.edgeColor || dn.edgeColor || '#bbb'"
        :stroke-opacity="1"
        :stroke-width="node.edgeWidth !== undefined ? node.edgeWidth : (dn.edgeWidth !== undefined ? dn.edgeWidth : 1)"
      />
    </svg>
    <!-- Triangle shape SVG -->
    <svg
      v-if="isTriangle"
      class="vue-flow__shape-svg"
      :viewBox="svgViewBox"
      preserveAspectRatio="none"
    >
      <polygon
        :points="trianglePoints"
        :fill="node.faceColor || dn.faceColor || '#fff'"
        :fill-opacity="1"
        :stroke="node.edgeColor || dn.edgeColor || '#bbb'"
        :stroke-opacity="1"
        :stroke-width="node.edgeWidth !== undefined ? node.edgeWidth : (dn.edgeWidth !== undefined ? dn.edgeWidth : 1)"
      />
    </svg>
  </div>
</template>

<script>
import { isTriangleShape } from '../../js/nodeStyle.mjs'
import { resolveNodeSize } from '../../js/geometry.mjs'

export default {
    name: 'NodeFace',
    props: {
        node: { type: Object, required: true },
        defNode: { type: Object, default: () => ({}) },
        //有效形狀(NodeWrapper 以 nodeStyle.nodeShape 單一解析後下傳)
        shape: { type: String, default: 'rectangle' },
        lastW: { type: Number, default: 0 },
        lastH: { type: Number, default: 0 },
    },
    computed: {
        dn() {
            return this.defNode
        },
        //形狀面尺寸: 與幾何/路由/fit 同一 resolveNodeSize(實測優先, 再宣告尺寸)
        faceSize() {
            return resolveNodeSize(this.node, { width: this.lastW, height: this.lastH }, this.dn)
        },
        nodeW() {
            return this.faceSize.width
        },
        nodeH() {
            return this.faceSize.height
        },
        isDiamond() {
            return this.shape === 'diamond'
        },
        isEllipse() {
            return this.shape === 'ellipse'
        },
        isTriangle() {
            return isTriangleShape(this.shape)
        },
        diamondPoints() {
            if (!this.isDiamond) return ''
            return (this.nodeW / 2) + ',0 ' + this.nodeW + ',' + (this.nodeH / 2) + ' ' + (this.nodeW / 2) + ',' + this.nodeH + ' 0,' + (this.nodeH / 2)
        },
        trianglePoints() {
            if (!this.isTriangle) return ''
            let w = this.nodeW
            let h = this.nodeH
            let s = this.shape
            if (s === 'triangle-right') return '0,0 ' + w + ',' + (h / 2) + ' 0,' + h
            if (s === 'triangle-down') return '0,0 ' + w + ',0 ' + (w / 2) + ',' + h
            if (s === 'triangle-left') return w + ',0 0,' + (h / 2) + ' ' + w + ',' + h
            return (w / 2) + ',0 0,' + h + ' ' + w + ',' + h
        },
        svgViewBox() {
            return '0 0 ' + this.nodeW + ' ' + this.nodeH
        },
    },
}
</script>

<style scoped>
.vue-flow__node-face {
  pointer-events: none;
}
.vue-flow__shape-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
.vue-flow__shape-svg polygon,
.vue-flow__shape-svg ellipse {
  transition: filter 0.3s ease;
}
</style>
