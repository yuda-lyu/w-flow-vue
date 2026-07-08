<template>
  <div class="vue-flow__settings-form" :style="formStyle">
    <label v-if="!isEx('name')">Name
      <input type="text" :value="node.name || ''" @input="$emit('update', 'name', $event.target.value)">
    </label>
    <label v-if="!isEx('description')">Description
      <input type="text" :value="node.description || ''" @input="$emit('update', 'description', $event.target.value)">
    </label>
    <label v-if="!isEx('type')">Type
      <select :value="node.type || defNode.type" @input="$emit('update', 'type', $event.target.value)">
        <option value="input">Input</option>
        <option value="basic">Basic</option>
        <option value="output">Output</option>
      </select>
    </label>
    <label v-if="!isEx('shape')">Shape
      <select :value="node.shape || defNode.shape" @input="$emit('update', 'shape', $event.target.value)">
        <option value="rectangle">Rectangle</option>
        <option value="diamond">Diamond</option>
        <option value="ellipse">Ellipse</option>
        <option value="triangle">Triangle ▲</option>
        <option value="triangle-right">Triangle ▶</option>
        <option value="triangle-down">Triangle ▼</option>
        <option value="triangle-left">Triangle ◀</option>
      </select>
    </label>
    <label v-if="!isEx('popupDirection')">Popup Direction
      <select :value="node.popupDirection || defNode.popupDirection" @input="$emit('update', 'popupDirection', $event.target.value)">
        <option value="top">Top</option>
        <option value="right">Right</option>
        <option value="bottom">Bottom</option>
        <option value="left">Left</option>
      </select>
    </label>
    <label v-if="!isEx('fontSize')">Font Size
      <input type="number" :value="node.fontSize || defNode.fontSize" :min="defNode.fontSizeMin" :max="defNode.fontSizeMax" @input="onFontSizeInput($event.target.value)">
    </label>
    <label v-if="!isEx('fontColor')">Font Color
      <WColorSelect :value="node.fontColor || defNode.fontColor" :size="160" :colorBlockSize="16" :showColorText="false" @input="$emit('update', 'fontColor', $event)" />
    </label>
    <label v-if="!isEx('faceColor')">Face Color
      <WColorSelect :value="node.faceColor || defNode.faceColor" :size="160" :colorBlockSize="16" :showColorText="false" @input="$emit('update', 'faceColor', $event)" />
    </label>
    <label v-if="!isEx('edgeColor')">Edge Color
      <WColorSelect :value="node.edgeColor || defNode.edgeColor" :size="160" :colorBlockSize="16" :showColorText="false" @input="$emit('update', 'edgeColor', $event)" />
    </label>
    <label v-if="!isEx('edgeWidth')">Edge Width
      <input type="number" :value="node.edgeWidth !== undefined ? node.edgeWidth : defNode.edgeWidth" min="1" max="24" @input="onEdgeWidthInput($event.target.value)">
    </label>
    <label v-if="!isEx('fromPosition') && (node.type === 'output' || node.type === 'basic')">From Handle
      <select :value="node.fromPosition || defNode.fromPosition" @input="$emit('update', 'fromPosition', $event.target.value)">
        <option value="top">Top</option>
        <option value="right">Right</option>
        <option value="bottom">Bottom</option>
        <option value="left">Left</option>
      </select>
    </label>
    <label v-if="!isEx('toPosition') && (node.type === 'input' || node.type === 'basic')">To Handle
      <select :value="node.toPosition || defNode.toPosition" @input="$emit('update', 'toPosition', $event.target.value)">
        <option value="top">Top</option>
        <option value="right">Right</option>
        <option value="bottom">Bottom</option>
        <option value="left">Left</option>
      </select>
    </label>
    <div class="vue-flow__delete-area">
      <button v-if="!confirmDelete" class="vue-flow__delete-btn" @click="confirmDelete = true">刪除節點</button>
      <template v-else>
        <span class="vue-flow__delete-warn">確定刪除？相關連線也會一併刪除</span>
        <div class="vue-flow__delete-confirm-row">
          <button class="vue-flow__delete-btn" @click="$emit('delete')">確認刪除</button>
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
        node: { type: Object, required: true },
        defNode: { type: Object, required: true },
        textFontSize: { type: String, default: '' },
        excludes: { type: Array, default: () => [] },
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
        isEx(key) {
            return this.excludes.indexOf(key) >= 0
        },
        onFontSizeInput(val) {
            let n = Number(val)
            let d = this.defNode
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
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.vue-flow__delete-warn {
  display: block;
  font-size: 11px;
  color: #c00;
  margin-bottom: 4px;
  text-align: right;
}
.vue-flow__delete-confirm-row {
  display: flex;
  gap: 6px;
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
.vue-flow__delete-btn--cancel {
  color: #666;
  background: #fff;
  border-color: #ccc;
}
.vue-flow__delete-btn--cancel:hover {
  background: #f5f5f5;
  border-color: #ccc;
}
</style>
