<template>
  <defs>
    <marker
      v-for="marker in markers"
      :key="marker.id"
      :id="marker.id"
      markerWidth="12.5"
      markerHeight="12.5"
      :viewBox="marker.viewBox"
      refX="10"
      refY="5"
      orient="auto-start-reverse"
      markerUnits="strokeWidth"
    >
      <path
        :d="marker.path"
        :fill="marker.fill"
        :stroke="marker.stroke"
        stroke-width="1"
      />
    </marker>
  </defs>
</template>

<script>
export default {
    name: 'EdgeMarkerDefs',
    inject: { getDefConn: { default: () => () => ({}) } },
    props: {
        conns: { type: Array, default: () => [] },
    },
    computed: {
        markers() {
            const set = new Map()
            const defConn = this.getDefConn()
            this.conns.forEach(conn => {
                const lineColor = conn.edgeColor || defConn.edgeColor
                this.collectMarker(conn.markerStart, set, lineColor)
                this.collectMarker(conn.markerEnd || defConn.markerEnd, set, lineColor)
            })
            return Array.from(set.values())
        },
    },
    methods: {
        collectMarker(marker, set, lineColor) {
            if (!marker) return
            const config = typeof marker === 'string' ? { type: marker } : marker
            // Fallback chain must match EdgeWrapper.getMarkerUrl so the ids agree.
            const color = config.color || lineColor || '#b1b1b7'
            const id = this.getMarkerId(config, color)
            if (set.has(id)) return

            if (config.type === 'arrowclosed') {
                set.set(id, {
                    id,
                    viewBox: '0 0 12.5 12.5',
                    path: 'M 0 0 L 10 5 L 0 10 z',
                    fill: color,
                    stroke: color,
                })
            }
            else {
                // 'arrow' - open
                set.set(id, {
                    id,
                    viewBox: '0 0 12.5 12.5',
                    path: 'M 0 0 L 10 5 L 0 10',
                    fill: 'none',
                    stroke: color,
                })
            }
        },
        getMarkerId(config, colorUse) {
            const type = typeof config === 'string' ? config : config.type
            return `vue-flow__${type}_${colorUse.replace('#', '')}`
        },
    },
}
</script>
