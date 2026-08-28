<template>
  <div class="vue-flow__settings-form" :style="formStyle">
    <label v-if="!isEx('name')">Name
      <input type="text" :value="eff('name')" @input="$emit('update', 'name', $event.target.value)">
    </label>
    <label v-if="!isEx('description')">Description
      <input type="text" :value="eff('description')" @input="$emit('update', 'description', $event.target.value)">
    </label>
    <label v-if="!isEx('shape')">Shape
      <select :value="eff('shape')" @input="$emit('update', 'shape', $event.target.value)">
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
      <select :value="eff('popupDirection')" @input="$emit('update', 'popupDirection', $event.target.value)">
        <option value="top">Top</option>
        <option value="right">Right</option>
        <option value="bottom">Bottom</option>
        <option value="left">Left</option>
      </select>
    </label>
    <label v-if="!isEx('fontSize')">Font Size
      <input type="number" :value="eff('fontSize')" :min="defNode.fontSizeMin" :max="defNode.fontSizeMax" @input="onFontSizeInput($event.target.value)">
    </label>
    <label v-if="!isEx('fontColor')">Font Color
      <WColorSelect :value="eff('fontColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'fontColor', $event)" />
    </label>
    <label v-if="!isEx('faceColor')">Face Color
      <WColorSelect :value="eff('faceColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'faceColor', $event)" />
    </label>
    <label v-if="!isEx('edgeColor')">Edge Color
      <WColorSelect :value="eff('edgeColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'edgeColor', $event)" />
    </label>
    <label v-if="!isEx('edgeWidth')">Edge Width
      <input type="number" :value="eff('edgeWidth')" min="1" :max="edgeWidthMax" @input="onEdgeWidthInput($event.target.value)">
    </label>
    <!-- 刪除不做內建二次確認: 是否需要確認由宿主以 opt.funConfirmDeleting(async)決定, 未提供即直接刪除。
         等待宿主確認期間按鈕 disabled(pending): 慢流程若毫無回饋會被當成沒反應而連點 -->
    <div class="vue-flow__delete-area">
      <button class="vue-flow__delete-btn" :disabled="deleteConfirming || node.deletable === false" @click="$emit('delete')">{{ deleteText }}</button>
    </div>
  </div>
</template>

<script>
import WColorSelect from 'w-component-vue/src/components/WColorSelect.vue'
import settingsForm from '../mixins/settingsForm.mjs'

/** 節點設定表單: 欄位有效值/排除/文字/刪除確認態/數值 clamp 皆由 mixins/settingsForm 提供, 本檔只有節點欄位 */
export default {
    name: 'NodeSettingsForm',
    components: { WColorSelect },
    mixins: [settingsForm],
    props: {
        node: { type: Object, required: true },
        defNode: { type: Object, required: true },
    },
    computed: {
        item() {
            return this.node
        },
        defaults() {
            return this.defNode
        },
        deleteTextKey() {
            return 'nodeDelete'
        },
    },
}
</script>

