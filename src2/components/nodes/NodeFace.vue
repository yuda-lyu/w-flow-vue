<template>
  <div class="vue-flow__node-face">
    <!-- Diamond shape SVG -->
    <svg
      v-if="isDiamond"
      class="vue-flow__shape-svg"
      :viewBox="diamondViewBox"
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
export default {
    name: 'NodeFace',
    inject: { getDefNode: { default: () => () => ({}) } },
    props: {
        node: { type: Object, required: true },
        lastW: { type: Number, default: 0 },
        lastH: { type: Number, default: 0 },
    },
    computed: {
        dn() {
            return this.getDefNode()
        },
        nodeW() {
            return this.node.width || this.lastW || 150
        },
        nodeH() {
            return this.node.height || this.lastH || 40
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
        diamondPoints() {
            if (!this.isDiamond) return ''
            return (this.nodeW / 2) + ',0 ' + this.nodeW + ',' + (this.nodeH / 2) + ' ' + (this.nodeW / 2) + ',' + this.nodeH + ' 0,' + (this.nodeH / 2)
        },
        trianglePoints() {
            if (!this.isTriangle) return ''
            let w = this.nodeW
            let h = this.nodeH
            let s = this.node.shape
            if (s === 'triangle-right') return '0,0 ' + w + ',' + (h / 2) + ' 0,' + h
            if (s === 'triangle-down') return '0,0 ' + w + ',0 ' + (w / 2) + ',' + h
            if (s === 'triangle-left') return w + ',0 0,' + (h / 2) + ' ' + w + ',' + h
            return (w / 2) + ',0 0,' + h + ' ' + w + ',' + h
        },
        svgViewBox() {
            return '0 0 ' + this.nodeW + ' ' + this.nodeH
        },
        diamondViewBox() {
            if (!this.isDiamond) return '0 0 150 40'
            return this.svgViewBox
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
