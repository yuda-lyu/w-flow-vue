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
    props: {
        conns: { type: Array, default: () => [] },
    },
    computed: {
        markers() {
            const set = new Map()
            this.conns.forEach(conn => {
                this.collectMarker(conn.markerStart, set)
                this.collectMarker(conn.markerEnd, set)
            })
            return Array.from(set.values())
        },
    },
    methods: {
        collectMarker(marker, set) {
            if (!marker) return
            const config = typeof marker === 'string' ? { type: marker } : marker
            const color = config.color || '#b1b1b7'
            const id = this.getMarkerId(config)
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
        getMarkerId(config) {
            const type = typeof config === 'string' ? config : config.type
            const color = (typeof config === 'object' && config.color) || '#b1b1b7'
            return `vue-flow__${type}_${color.replace('#', '')}`
        },
    },
}
</script>
