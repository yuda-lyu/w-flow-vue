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
      <template v-else-if="g.key === 'appearance'">
        <label v-if="!isEx('shape')" data-field-key="shape">Shape
          <SettingsSelect :items="shapeItems" :value="eff('shape')" @input="$emit('update', 'shape', $event)" />
        </label>
        <label v-if="!isEx('faceColor')" data-field-key="faceColor">Face Color
          <WColorSelect :value="eff('faceColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'faceColor', $event)" />
        </label>
        <label v-if="!isEx('edgeColor')" data-field-key="edgeColor">Edge Color
          <WColorSelect :value="eff('edgeColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'edgeColor', $event)" />
        </label>
        <label v-if="!isEx('edgeWidth')" data-field-key="edgeWidth">Edge Width
          <input type="number" :value="eff('edgeWidth')" min="1" :max="edgeWidthMax" @input="onEdgeWidthInput($event.target.value)">
        </label>
      </template>
      <template v-else-if="g.key === 'text'">
        <label v-if="!isEx('fontSize')" data-field-key="fontSize">Font Size
          <input type="number" :value="eff('fontSize')" :min="defNode.fontSizeMin" :max="defNode.fontSizeMax" @input="onFontSizeInput($event.target.value)">
        </label>
        <label v-if="!isEx('fontColor')" data-field-key="fontColor">Font Color
          <WColorSelect :value="eff('fontColor')" :size="160" :colorBlockSize="16" :showColorText="false" :btnText="colorConfirmText" @input="$emit('update', 'fontColor', $event)" />
        </label>
      </template>
      <template v-else-if="g.key === 'advanced'">
        <label v-if="!isEx('popupDirection')" data-field-key="popupDirection">Popup Direction
          <SettingsSelect :items="popupDirectionItems" :value="eff('popupDirection')" @input="$emit('update', 'popupDirection', $event)" />
        </label>
      </template>
    </SettingsGroup>
    <!-- 刪除不做內建二次確認: 是否需要確認由宿主以 opt.funConfirmDeleting(async)決定, 未提供即直接刪除。
         等待宿主確認期間按鈕 disabled(pending): 慢流程若毫無回饋會被當成沒反應而連點。
         刪除為破壞性操作, 不歸入任何屬性群組, 恆顯示於表單底部 -->
    <div class="vue-flow__delete-area">
      <button class="vue-flow__delete-btn" :disabled="deleteConfirming || node.deletable === false" @click="$emit('delete')">{{ deleteText }}</button>
    </div>
  </div>
</template>

<script>
import WColorSelect from 'w-component-vue/src/components/WColorSelect.vue'
import settingsForm from '../mixins/settingsForm.mjs'
import SettingsGroup from './SettingsGroup.vue'
import SettingsSelect from './SettingsSelect.vue'
import SettingsText from './SettingsText.vue'
import { NODE_SETTING_GROUPS } from '../../js/settingsGroups.mjs'
import { SHAPES } from '../../js/nodeStyle.mjs'
import { SIDES } from '../../js/anchorPolicy.mjs'
import './settingsForm.css'

/** 節點設定表單: 欄位有效值/排除/文字/刪除確認態/數值 clamp/分群展開態 皆由 mixins/settingsForm 提供, 本檔只有節點欄位 */
export default {
    name: 'NodeSettingsForm',
    components: { WColorSelect, SettingsGroup, SettingsSelect, SettingsText },
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
        //分群定義(順序即呈現順序); 群標題與成員之單一來源在 js/settingsGroups.mjs
        groupDefs() {
            return NODE_SETTING_GROUPS
        },
        //下拉選項(值與顯示文字分離): 值域一律由既有單一來源衍生, 不在表單另抄一份。
        //顯示文字由值直接轉寫(kebab → Title Case), 不另備對照表 —— 值本身已足以描述形狀
        //(triangle-up / -right / -down / -left 四向自明), 對照表只會變成第二份需要同步的清單。
        shapeItems() {
            return SHAPES.map(v => ({ value: v, text: titleCase(v) }))
        },
        //popupDirection 之值域與邊之四方位同集(top/right/bottom/left), 沿用 anchorPolicy.SIDES
        popupDirectionItems() {
            return SIDES.map(v => ({ value: v, text: titleCase(v) }))
        },
        deleteTextKey() {
            return 'nodeDelete'
        },
    },
}

/** kebab-case 值 → 顯示文字(triangle-up → Triangle Up) */
function titleCase(v) {
    return String(v).split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}
</script>
