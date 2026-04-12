<template>
  <div class="vue-flow__settings-form" :style="formStyle">
    <label>Name
      <input type="text" :value="conn.name || ''" @input="$emit('update', 'name', $event.target.value)">
    </label>
    <label>Description
      <input type="text" :value="conn.description || ''" @input="$emit('update', 'description', $event.target.value)">
    </label>
    <label>Type
      <select :value="conn.type || defConn.type" @input="$emit('update', 'type', $event.target.value)">
        <option value="bezier">Bezier</option>
        <option value="straight">Straight</option>
        <option value="step">Step</option>
        <option value="smoothstep">Smooth Step</option>
      </select>
    </label>
    <label>Font Size
      <input type="number" :value="conn.fontSize || defConn.fontSize" :min="defConn.fontSizeMin" :max="defConn.fontSizeMax" @input="onFontSizeInput($event.target.value)">
    </label>
    <label>Font Color
      <WColorSelect :value="conn.fontColor || defConn.fontColor" :size="160" :colorBlockSize="16" :showColorText="false" @input="$emit('update', 'fontColor', $event)" />
    </label>
    <label>Animated
      <input type="checkbox" :checked="!!conn.animated" @change="$emit('update', 'animated', $event.target.checked)">
    </label>
    <label>Edge Color
      <WColorSelect :value="conn.edgeColor || defConn.edgeColor" :size="160" :colorBlockSize="16" :showColorText="false" @input="$emit('update', 'edgeColor', $event)" />
    </label>
    <label>Edge Width
      <input type="number" :value="conn.edgeWidth !== undefined ? conn.edgeWidth : defConn.edgeWidth" min="1" max="24" @input="onEdgeWidthInput($event.target.value)">
    </label>
    <label>Marker End
      <select :value="conn.markerEnd || defConn.markerEnd" @input="$emit('update', 'markerEnd', $event.target.value || undefined)">
        <option value="">None</option>
        <option value="arrow">Arrow</option>
        <option value="arrowclosed">Arrow Closed</option>
      </select>
    </label>
    <div class="vue-flow__delete-area">
      <button v-if="!confirmDelete" class="vue-flow__delete-btn" @click="confirmDelete = true">刪除連接線</button>
      <template v-else>
        <span class="vue-flow__delete-warn">確定要刪除此連接線？</span>
        <div class="vue-flow__delete-confirm-row">
          <button class="vue-flow__delete-btn vue-flow__delete-btn--confirm" @click="$emit('delete')">確認刪除</button>
          <button class="vue-flow__delete-btn vue-flow__delete-btn--cancel" @click="confirmDelete = false">取消</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import WColorSelect from 'w-component-vue/src/components/WColorSelect.vue'

export default {
    components: { WColorSelect },
    props: {
        conn: { type: Object, required: true },
        defConn: { type: Object, required: true },
        textFontSize: { type: String, default: '' },
    },
    data() {
        return { confirmDelete: false }
    },
    computed: {
        formStyle() {
            let s = {}
            if (this.textFontSize) s.fontSize = this.textFontSize
            return s
        },
    },
    methods: {
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
.vue-flow__delete-area {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid #eee;
}
.vue-flow__delete-warn {
  display: block;
  font-size: 11px;
  color: #c00;
  margin-bottom: 4px;
}
.vue-flow__delete-confirm-row {
  display: flex;
  gap: 6px;
}
.vue-flow__delete-btn {
  padding: 3px 10px;
  font-size: 11px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
}
.vue-flow__delete-btn:hover {
  background: #f5f5f5;
}
.vue-flow__delete-btn--confirm {
  color: #fff;
  background: #dc2626;
  border-color: #dc2626;
}
.vue-flow__delete-btn--confirm:hover {
  background: #b91c1c;
}
.vue-flow__delete-btn--cancel {
  color: #666;
}
</style>
