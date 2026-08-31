<template>
  <defs>
    <marker
      v-for="m in markers"
      :key="m.id"
      :id="m.id"
      :markerWidth="m.markerWidth"
      :markerHeight="m.markerHeight"
      :viewBox="m.viewBox"
      :refX="m.refX"
      :refY="m.refY"
      :orient="m.orient"
      :markerUnits="m.markerUnits"
    >
      <path :d="m.path" :fill="m.fill" :stroke="m.stroke" :stroke-width="m.strokeWidth" />
    </marker>
  </defs>
</template>

<script>
import { resolveMarker, markerDef } from '../../js/edgeMarker.mjs'

/**
 * 收集全部連線兩端之箭頭規格(edgeMarker.resolveMarker 單一來源, 與 EdgeWrapper 之 url 同一 id), 以 id 去重產 <defs>。
 */
export default {
    name: 'EdgeMarkerDefs',
    props: {
        conns: { type: Array, default: () => [] },
        defConn: { type: Object, default: () => ({}) },
    },
    computed: {
        markers() {
            const set = new Map()
            const defConn = this.defConn
            this.conns.forEach(conn => {
                for (const end of ['from', 'to']) {
                    const spec = resolveMarker(conn, defConn, end)
                    if (spec && !set.has(spec.id)) set.set(spec.id, markerDef(spec))
                }
            })
            return Array.from(set.values())
        },
    },
}
</script>
