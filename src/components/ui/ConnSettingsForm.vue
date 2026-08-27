<template>
  <div class="vue-flow__settings-form" :style="formStyle">
    <label v-if="!isEx('name')">Name
      <input type="text" :value="conn.name || ''" @input="$emit('update', 'name', $event.target.value)">
    </label>
    <label v-if="!isEx('description')">Description
      <input type="text" :value="conn.description || ''" @input="$emit('update', 'description', $event.target.value)">
    </label>
    <label v-if="!isEx('type')">Type
      <select :value="conn.type || defConn.type" @input="$emit('update', 'type', $event.target.value)">
        <option value="bezier">Bezier</option>
        <option value="straight">Straight</option>
        <option value="step">Step</option>
        <option value="smoothstep">Smooth Step</option>
      </select>
    </label>
    <label v-if="!isEx('fromPosition')">From Anchor
      <select :value="effSide('from')" @input="$emit('update', 'fromPosition', $event.target.value)">
        <option v-for="sd in sides" :key="sd" :value="sd">{{ sideLabel(sd) }}</option>
      </select>
    </label>
    <label v-if="!isEx('toPosition')">To Anchor
      <select :value="effSide('to')" @input="$emit('update', 'toPosition', $event.target.value)">
        <option v-for="sd in sides" :key="sd" :value="sd">{{ sideLabel(sd) }}</option>
      </select>
    </label>
    <label v-if="!isEx('fontSize')">Font Size
      <input type="number" :value="conn.fontSize || defConn.fontSize" :min="defConn.fontSizeMin" :max="defConn.fontSizeMax" @input="onFontSizeInput($event.target.value)">
    </label>
    <label v-if="!isEx('fontColor')">Font Color
      <WColorSelect :value="conn.fontColor || defConn.fontColor" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'fontColor', $event)" />
    </label>
    <label v-if="!isEx('animated')">Animated
      <input type="checkbox" :checked="!!conn.animated" @change="$emit('update', 'animated', $event.target.checked)">
    </label>
    <label v-if="!isEx('edgeColor')">Edge Color
      <WColorSelect :value="conn.edgeColor || defConn.edgeColor" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'edgeColor', $event)" />
    </label>
    <label v-if="!isEx('edgeWidth')">Edge Width
      <input type="number" :value="conn.edgeWidth !== undefined ? conn.edgeWidth : defConn.edgeWidth" min="1" max="24" @input="onEdgeWidthInput($event.target.value)">
    </label>
    <!-- 兩端箭頭(edgeMarker 契約): 樣式 無/線式/實心; Size/Color 兩欄恆顯示(讓使用者知道可改)但有條件才可改:
         Size 於有箭頭時可改, Color(三角形填色)僅於實心箭頭時可改, 其餘 disabled -->
    <template v-for="end in ['Start', 'End']">
      <label v-if="!isEx('marker' + end)" :key="'mk' + end">{{ endLabel(end) }} Marker
        <select :value="eff('marker' + end)" @input="$emit('update', 'marker' + end, $event.target.value)">
          <option value="">None</option>
          <option value="arrow">Arrow</option>
          <option value="arrowclosed">Arrow Closed</option>
        </select>
      </label>
      <label v-if="!isEx('marker' + end + 'Size')" :key="'mks' + end">{{ endLabel(end) }} Marker Size
        <input type="number" :value="eff('marker' + end + 'Size')" :min="markerSizeMin" :max="markerSizeMax" :disabled="!eff('marker' + end)" @input="onMarkerSizeInput('marker' + end + 'Size', $event.target.value)">
      </label>
      <label v-if="!isEx('marker' + end + 'Color')" :key="'mkc' + end">{{ endLabel(end) }} Marker Color
        <span class="vue-flow__field" :class="{ 'vue-flow__field--disabled': eff('marker' + end) !== 'arrowclosed' }" :aria-disabled="eff('marker' + end) !== 'arrowclosed'">
          <WColorSelect :value="eff('marker' + end + 'Color') || eff('edgeColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'marker' + end + 'Color', $event)" />
        </span>
      </label>
    </template>
    <div v-if="!isEx('points')" class="vue-flow__waypoints">
      <div class="vue-flow__waypoints-head">
        <span>Waypoints</span>
        <button class="vue-flow__waypoints-add" title="新增轉折點" @click="addWaypoint">＋</button>
      </div>
      <div v-for="(p, i) in ptsLocal" :key="'wp' + i" class="vue-flow__waypoints-row">
        <span class="vue-flow__waypoints-idx">{{ i + 1 }}</span>
        <input type="number" :value="p[0]" title="X" @input="onWaypointInput(i, 0, $event.target.value)">
        <input type="number" :value="p[1]" title="Y" @input="onWaypointInput(i, 1, $event.target.value)">
        <button class="vue-flow__waypoints-del" title="移除此轉折點" @click="removeWaypoint(i)">×</button>
      </div>
      <div v-if="!ptsLocal.length" class="vue-flow__waypoints-empty">無(自動路由)</div>
    </div>
    <!-- 刪除不做內建二次確認: 是否需要確認由宿主以 opt.funConfirmDeleting(async)決定, 未提供即直接刪除。
         等待宿主確認期間按鈕 disabled(pending), 與節點設定表單同契約 -->
    <div class="vue-flow__delete-area">
      <button class="vue-flow__delete-btn" :disabled="deleteConfirming || conn.deletable === false" @click="$emit('delete')">{{ deleteText }}</button>
    </div>
  </div>
</template>

<script>
import WColorSelect from 'w-component-vue/src/components/WColorSelect.vue'
import { SIDES, connSourceSide, connTargetSide } from '../../js/anchorPolicy.mjs'
import { MARKER_SIZE_MIN, MARKER_SIZE_MAX } from '../../js/edgeMarker.mjs'

export default {
    components: { WColorSelect },
    inject: {
        //刪除確認進行中(getter注入, 預設值使本元件可獨立掛載): 等待宿主回覆期間刪除鈕 disabled
        getDeleteConfirming: { default: () => () => false },
        //設定表單文字(刪除鈕/色票確認鈕; 由 WFlowVue 依 opt 注入, 預設英文)
        getSettingsText: { default: () => () => ({}) },
    },
    props: {
        conn: { type: Object, required: true },
        defConn: { type: Object, required: true },
        textFontSize: { type: String, default: '' },
        excludes: { type: Array, default: () => [] },
        defaultPoint: { type: Object, default: null }, //首個轉折點預設位置(建議傳路徑中點, 新點落於既有線上不跳動)
        targetPoint: { type: Object, default: null }, //迄點錨位置(後續新增以「末點與迄點中點」細分)
    },
    data() {
        return {
            ptsLocal: this.normalizePoints(this.conn.points), //轉折點本地編輯態(打字中不被外部回寫干擾)
        }
    },
    computed: {
        sides() {
            return SIDES
        },
        markerSizeMin() {
            return MARKER_SIZE_MIN
        },
        markerSizeMax() {
            return MARKER_SIZE_MAX
        },
        deleteConfirming() {
            return this.getDeleteConfirming()
        },
        deleteText() {
            return this.getSettingsText().connDelete || 'Delete'
        },
        colorConfirmText() {
            return this.getSettingsText().colorConfirm || 'Confirm'
        },
        formStyle() {
            let s = {}
            if (this.textFontSize) s.fontSize = this.textFontSize
            return s
        },
    },
    watch: {
        //外部(如存檔回寫)變更時重同步本地態; 與本地序列化相同則不動(避免打字被清)
        'conn.points': function(val) {
            const ext = JSON.stringify(this.normalizePoints(val))
            if (ext !== JSON.stringify(this.ptsLocal)) {
                this.ptsLocal = this.normalizePoints(val)
            }
        },
    },
    methods: {
        isEx(key) {
            return this.excludes.indexOf(key) >= 0
        },
        //有效值(conn → defConn): 箭頭樣式(markerStart/markerEnd)之 '' 為明確「無」不落回 defConn(與 edgeMarker 同一規則); 其餘鍵 '' 視為未給
        eff(key) {
            const v = this.conn[key]
            const explicitEmpty = key === 'markerStart' || key === 'markerEnd'
            if (v !== undefined && v !== null && (explicitEmpty || v !== '')) return v
            const d = this.defConn[key]
            return (d !== undefined && d !== null) ? d : ''
        },
        //兩端方位之有效值(anchorPolicy 單一解析, 與 EdgeWrapper 同一基準)
        effSide(end) {
            return end === 'from' ? connSourceSide(this.conn, this.defConn) : connTargetSide(this.conn, this.defConn)
        },
        //兩端箭頭欄位標籤: 資料鍵 markerStart/markerEnd 對應顯示 From / To(與 From/To Anchor 同一語彙)
        endLabel(end) {
            return end === 'Start' ? 'From' : 'To'
        },
        sideLabel(sd) {
            return sd.charAt(0).toUpperCase() + sd.slice(1)
        },
        onMarkerSizeInput(key, val) {
            let n = Number(val)
            if (!val || isNaN(n) || n < MARKER_SIZE_MIN) return
            if (n > MARKER_SIZE_MAX) n = MARKER_SIZE_MAX
            this.$emit('update', key, n)
        },
        normalizePoints(pts) {
            if (!Array.isArray(pts)) return []
            const r = []
            for (const p of pts) {
                if (Array.isArray(p) && p.length >= 2) r.push([Number(p[0]) || 0, Number(p[1]) || 0])
                else if (p && typeof p === 'object') r.push([Number(p.x) || 0, Number(p.y) || 0])
            }
            return r
        },
        emitWaypoints() {
            //空陣列送null表示移除轉折點(回歸自動路由)
            this.$emit('update', 'points', this.ptsLocal.length ? this.ptsLocal.map(p => [p[0], p[1]]) : null)
        },
        addWaypoint() {
            const last = this.ptsLocal[this.ptsLocal.length - 1]
            let p
            if (!last) {
                //首點=路徑中點(落於既有線上, 路徑不跳動); 無提示時退而取迄點附近, 再無則(0,0)
                if (this.defaultPoint) p = [Math.round(this.defaultPoint.x), Math.round(this.defaultPoint.y)]
                else if (this.targetPoint) p = [Math.round(this.targetPoint.x) - 40, Math.round(this.targetPoint.y) - 40]
                else p = [0, 0]
            }
            else if (this.targetPoint) {
                //後續新增=末點與迄點錨之中點(向迄點細分)
                p = [Math.round((last[0] + this.targetPoint.x) / 2), Math.round((last[1] + this.targetPoint.y) / 2)]
            }
            else {
                p = [last[0] + 40, last[1] + 40]
            }
            this.ptsLocal.push(p)
            this.emitWaypoints()
        },
        removeWaypoint(i) {
            this.ptsLocal.splice(i, 1)
            this.emitWaypoints()
        },
        onWaypointInput(i, axis, val) {
            const n = Number(val)
            if (val === '' || isNaN(n)) return
            this.$set(this.ptsLocal[i], axis, n)
            this.emitWaypoints()
        },
        onFontSizeInput(val) {
            let n = Number(val)
            let d = this.defConn
            if (!val || isNaN(n) || n < d.fontSizeMin) return
            if (n > d.fontSizeMax) n = d.fontSizeMax
            this.$emit('update', 'fontSize', n)
        },
        onEdgeWidthInput(val) {
            let n = Number(val)
            if (!val || isNaN(n) || n < 1) return
            if (n > 24) n = 24
            this.$emit('update', 'edgeWidth', n)
        },
    },
}
</script>

<style>
/* 有條件才可改之欄位(WColorSelect 無 disabled prop, 以容器 pointer-events 阻擋並淡化) */
.vue-flow__field--disabled {
  pointer-events: none;
  opacity: 0.4;
}
.vue-flow__settings-form input:disabled,
.vue-flow__settings-form select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.vue-flow__settings-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 180px;
}
.vue-flow__settings-form label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.vue-flow__settings-form select,
.vue-flow__settings-form input[type="number"],
.vue-flow__settings-form input[type="text"] {
  width: 100px;
  font-size: 12px;
  padding: 1px 4px;
  border: 1px solid #ccc;
  border-radius: 3px;
}
.vue-flow__settings-form input[type="color"] {
  width: 32px;
  height: 24px;
  padding: 0;
  border: 1px solid #ccc;
  cursor: pointer;
  flex-shrink: 0;
}
.vue-flow__waypoints {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 6px;
  border-top: 1px solid #eee;
  font-size: 12px;
}
.vue-flow__waypoints-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.vue-flow__waypoints-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  color: #666;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.vue-flow__waypoints-add:hover {
  border-color: #666;
  color: #333;
}
.vue-flow__waypoints-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.vue-flow__waypoints-idx {
  width: 14px;
  color: #999;
  font-size: 11px;
  text-align: right;
}
.vue-flow__waypoints-row input[type="number"] {
  width: 62px;
  font-size: 12px;
  padding: 1px 4px;
  border: 1px solid #ccc;
  border-radius: 3px;
}
.vue-flow__waypoints-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  color: #999;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
}
.vue-flow__waypoints-del:hover {
  border-color: #dc2626;
  color: #dc2626;
}
.vue-flow__waypoints-empty {
  color: #aaa;
  font-size: 11px;
}
.vue-flow__delete-area {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.vue-flow__delete-btn {
  padding: 3px 10px;
  font-size: 11px;
  border: 1px solid #dc2626;
  border-radius: 3px;
  color: #fff;
  background: #dc2626;
  cursor: pointer;
}
.vue-flow__delete-btn:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}
/* 等待宿主確認期間: 淡化且不可再點(尺寸與文字不變, 不造成版面跳動) */
.vue-flow__delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.vue-flow__delete-btn:disabled:hover {
  background: #dc2626;
  border-color: #dc2626;
}
</style>
