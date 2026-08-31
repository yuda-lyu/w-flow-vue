<template>
  <div class="vue-flow__settings-form" :style="formStyle">
    <SettingsGroup
      v-for="g in groups"
      :key="g.key"
      :title="g.title"
      :group-key="g.key"
      :open="isGroupOpen(g.key)"
      @update:open="setGroupOpen(g.key, $event)"
    >
      <template v-if="g.key === 'basic'">
        <label v-if="!isEx('name')" data-field-key="name">Name
          <SettingsText :value="eff('name')" @input="$emit('update', 'name', $event)" />
        </label>
        <label v-if="!isEx('description')" data-field-key="description">Description
          <SettingsText :value="eff('description')" @input="$emit('update', 'description', $event)" />
        </label>
      </template>
      <template v-else-if="g.key === 'path'">
        <label v-if="!isEx('type')" data-field-key="type">Type
          <SettingsSelect :items="typeItems" :value="eff('type')" @input="$emit('update', 'type', $event)" />
        </label>
        <label v-if="!isEx('fromPosition')" data-field-key="fromPosition">From Anchor
          <SettingsSelect :items="sideItems" :value="effSide('from')" @input="$emit('update', 'fromPosition', $event)" />
        </label>
        <label v-if="!isEx('toPosition')" data-field-key="toPosition">To Anchor
          <SettingsSelect :items="sideItems" :value="effSide('to')" @input="$emit('update', 'toPosition', $event)" />
        </label>
        <div v-if="!isEx('points')" class="vue-flow__waypoints" data-field-key="points">
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
      </template>
      <template v-else-if="g.key === 'appearance'">
        <label v-if="!isEx('edgeColor')" data-field-key="edgeColor">Edge Color
          <WColorSelect :value="eff('edgeColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'edgeColor', $event)" />
        </label>
        <label v-if="!isEx('edgeWidth')" data-field-key="edgeWidth">Edge Width
          <input type="number" :value="eff('edgeWidth')" min="1" :max="edgeWidthMax" @input="onEdgeWidthInput($event.target.value)">
        </label>
        <label v-if="!isEx('animated')" data-field-key="animated">Animated
          <input type="checkbox" :checked="!!eff('animated')" @change="$emit('update', 'animated', $event.target.checked)">
        </label>
      </template>
      <!-- 兩端箭頭(edgeMarker 契約): 樣式 無/線式/實心; Size 與兩個 Color 欄恆顯示(讓使用者知道可改)但依樣式決定可否改:
             Size       — 有箭頭即可改
             Face Color — 三角形填色, 僅實心(arrowclosed)可改; 線式箭頭 fill 恆 none, 改了不會有畫面效果
             Edge Color — 箭頭外框色, 線式與實心皆可改(兩者都有描邊); 未給即跟隨線色 -->
      <template v-else-if="g.key === 'arrows'">
        <template v-for="end in ['From', 'To']">
          <label v-if="!isEx('marker' + end)" :key="'mk' + end" :data-field-key="'marker' + end">{{ end }} Marker
            <SettingsSelect :items="markerItems" :value="eff('marker' + end)" @input="$emit('update', 'marker' + end, $event)" />
          </label>
          <label v-if="!isEx('marker' + end + 'Size')" :key="'mks' + end" :data-field-key="'marker' + end + 'Size'">{{ end }} Marker Size
            <input type="number" :value="eff('marker' + end + 'Size')" :min="markerSizeMin" :max="markerSizeMax" :disabled="!eff('marker' + end)" @input="onMarkerSizeInput('marker' + end + 'Size', $event.target.value)">
          </label>
          <label v-if="!isEx('marker' + end + 'FaceColor')" :key="'mkf' + end" :data-field-key="'marker' + end + 'FaceColor'">{{ end }} Marker Face Color
            <span class="vue-flow__field" :class="{ 'vue-flow__field--disabled': !faceColorEditable(end) }" :aria-disabled="!faceColorEditable(end)">
              <WColorSelect :value="eff('marker' + end + 'FaceColor') || eff('edgeColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'marker' + end + 'FaceColor', $event)" />
            </span>
          </label>
          <label v-if="!isEx('marker' + end + 'EdgeColor')" :key="'mke' + end" :data-field-key="'marker' + end + 'EdgeColor'">{{ end }} Marker Edge Color
            <span class="vue-flow__field" :class="{ 'vue-flow__field--disabled': !edgeColorEditable(end) }" :aria-disabled="!edgeColorEditable(end)">
              <WColorSelect :value="eff('marker' + end + 'EdgeColor') || eff('edgeColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'marker' + end + 'EdgeColor', $event)" />
            </span>
          </label>
        </template>
      </template>
      <template v-else-if="g.key === 'text'">
        <label v-if="!isEx('fontSize')" data-field-key="fontSize">Font Size
          <input type="number" :value="eff('fontSize')" :min="defConn.fontSizeMin" :max="defConn.fontSizeMax" @input="onFontSizeInput($event.target.value)">
        </label>
        <label v-if="!isEx('fontColor')" data-field-key="fontColor">Font Color
          <WColorSelect :value="eff('fontColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'fontColor', $event)" />
        </label>
      </template>
    </SettingsGroup>
    <!-- 刪除不做內建二次確認: 是否需要確認由宿主以 opt.funConfirmDeleting(async)決定, 未提供即直接刪除。
         等待宿主確認期間按鈕 disabled(pending), 與節點設定表單同契約。
         刪除為破壞性操作, 不歸入任何屬性群組, 恆顯示於表單底部 -->
    <div class="vue-flow__delete-area">
      <button class="vue-flow__delete-btn" :disabled="deleteConfirming || conn.deletable === false" @click="$emit('delete')">{{ deleteText }}</button>
    </div>
  </div>
</template>

<script>
import WColorSelect from 'w-component-vue/src/components/WColorSelect.vue'
import settingsForm from '../mixins/settingsForm.mjs'
import SettingsGroup from './SettingsGroup.vue'
import SettingsSelect from './SettingsSelect.vue'
import SettingsText from './SettingsText.vue'
import { CONN_SETTING_GROUPS } from '../../js/settingsGroups.mjs'
import { SIDES, connSourceSide, connTargetSide } from '../../js/anchorPolicy.mjs'
import { EDGE_TYPES } from '../../js/edgePath.mjs'
import { MARKER_TYPES, MARKER_SIZE_MIN, MARKER_SIZE_MAX } from '../../js/edgeMarker.mjs'
import './settingsForm.css'

const EDGE_TYPE_LABELS = { 'bezier': 'Bezier', 'straight': 'Straight', 'step': 'Step', 'smoothstep': 'Smooth Step' }
const MARKER_LABELS = { '': 'None', 'arrow': 'Arrow', 'arrowclosed': 'Arrow Closed' }

export default {
    name: 'ConnSettingsForm',
    components: { WColorSelect, SettingsGroup, SettingsSelect, SettingsText },
    //欄位有效值/排除/文字/刪除確認態/數值 clamp/分群展開態 由 mixins/settingsForm 提供(與 NodeSettingsForm 同一份)
    mixins: [settingsForm],
    props: {
        conn: { type: Object, required: true },
        defConn: { type: Object, required: true },
        defaultPoint: { type: Object, default: null }, //首個轉折點預設位置(建議傳路徑中點, 新點落於既有線上不跳動)
        targetPoint: { type: Object, default: null }, //迄點錨位置(後續新增以「末點與迄點中點」細分)
    },
    data() {
        return {
            ptsLocal: this.draftWaypoints(this.conn.points), //轉折點本地編輯態(打字中不被外部回寫干擾)
        }
    },
    computed: {
        item() {
            return this.conn
        },
        defaults() {
            return this.defConn
        },
        //分群定義(順序即呈現順序); 群標題與成員之單一來源在 js/settingsGroups.mjs
        groupDefs() {
            return CONN_SETTING_GROUPS
        },
        deleteTextKey() {
            return 'connDelete'
        },
        //下拉選項一律為 { value, text }(值與顯示文字分離, 見 SettingsSelect)
        typeItems() {
            return EDGE_TYPES.map(v => ({ value: v, text: EDGE_TYPE_LABELS[v] || v }))
        },
        //箭頭樣式選項由 edgeMarker.MARKER_TYPES 衍生(單一來源)
        markerItems() {
            return MARKER_TYPES.map(v => ({ value: v, text: MARKER_LABELS[v] || v }))
        },
        //兩端方位之選項: 值域取 anchorPolicy.SIDES(單一來源), 顯示首字大寫
        sideItems() {
            return SIDES.map(v => ({ value: v, text: v.charAt(0).toUpperCase() + v.slice(1) }))
        },
        markerSizeMin() {
            return MARKER_SIZE_MIN
        },
        markerSizeMax() {
            return MARKER_SIZE_MAX
        },
    },
    watch: {
        //外部(如存檔回寫)變更時重同步本地態; 與本地序列化相同則不動(避免打字被清)
        'conn.points': function(val) {
            const ext = JSON.stringify(this.draftWaypoints(val))
            if (ext !== JSON.stringify(this.ptsLocal)) {
                this.ptsLocal = this.draftWaypoints(val)
            }
        },
    },
    methods: {
        //兩端方位之有效值(anchorPolicy 單一解析, 與 EdgeWrapper 同一基準)
        effSide(end) {
            return end === 'from' ? connSourceSide(this.conn, this.defConn) : connTargetSide(this.conn, this.defConn)
        },
        //(箭頭欄位不需標籤轉換函式: 資料鍵之 markerFrom/markerTo 與顯示之 From/To 同名, template 直接用 v-for 之值)
        //填色僅實心箭頭有意義(線式之 fill 恆 none, 改了不會有畫面效果 —— 可改卻無效即為半吊子 affordance)
        faceColorEditable(end) {
            return this.eff('marker' + end) === 'arrowclosed'
        },
        //外框色於線式與實心皆有意義(兩者都有描邊); 無箭頭時兩色皆不可改
        edgeColorEditable(end) {
            const t = this.eff('marker' + end)
            return t === 'arrow' || t === 'arrowclosed'
        },
        onMarkerSizeInput(key, val) {
            let n = Number(val)
            if (!val || isNaN(n) || n < MARKER_SIZE_MIN) return
            if (n > MARKER_SIZE_MAX) n = MARKER_SIZE_MAX
            this.$emit('update', key, n)
        },
        //表單草稿解析(容錯: 非數值視為 0、缺欄略過), 與 runtime 之 edgePath.parseWaypoints(嚴格, 任一無效即整批無效)語義不同, 刻意不共用
        draftWaypoints(pts) {
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
    },
}
</script>

<style>
/* 本檔只保留連線專屬之轉折點樣式; 表單共用版面(含 .vue-flow__field--disabled、disabled 欄位、
   刪除區)在 ./settingsForm.css, 由兩個表單共同 import */
/* 轉折點為 Path 群「內」之子區塊: 其上緣分隔線刻意不 full-bleed(那是群層級的語彙),
   隨群內容一起內縮; 線色與刪除區同走 --vf-settings-rule 以隨主題變化 */
.vue-flow__waypoints {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--vf-settings-rule);
  font-size: inherit;
}
.vue-flow__waypoints-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
/* 轉折點為 Path 群「內」之子區塊標題: 層級為 群標題 > 本標題 > 欄位標籤。
   與群標題同字級但降一階色(muted)且不加 letter-spacing —— 群標題另有底色與 full-bleed, 兩者不致混淆 */
.vue-flow__waypoints-head > span {
  font-size: var(--vf-settings-font-sm);
  font-weight: 600;
  color: var(--vf-settings-text-muted);
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
  color: var(--vf-settings-text-muted);
  cursor: pointer;
  font-size: inherit;
  line-height: 1;
}
.vue-flow__waypoints-add:hover {
  border-color: var(--vf-settings-text-muted);
  color: #333;
}
.vue-flow__waypoints-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.vue-flow__waypoints-idx {
  width: 14px;
  color: var(--vf-settings-text-faint);
  font-size: var(--vf-settings-font-sm);
  text-align: right;
}
.vue-flow__waypoints-row input[type="number"] {
  width: 62px;
  font-size: inherit;
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
  color: var(--vf-settings-text-faint);
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
  color: var(--vf-settings-text-faint);
  font-size: var(--vf-settings-font-sm);
}
</style>
