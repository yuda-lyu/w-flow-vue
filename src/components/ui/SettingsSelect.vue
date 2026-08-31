<template>
  <WTextSelect
    class="vue-flow__settings-select"
    :items="items"
    :value="selectedItem"
    keyText="text"
    :textFontSize="fontSize"
    :itemTextFontSize="fontSize"
    :borderRadius="3"
    :shadow="false"
    :paddingStyle="{ v: 1, h: 4 }"
    :itemPaddingStyle="{ v: 5, h: 8 }"
    backgroundColor="#fff"
    backgroundColorHover="#fff"
    backgroundColorFocus="#fff"
    borderColor="#ccc"
    borderColorHover="#666"
    borderColorFocus="#666"
    :expansionIconSize="14"
    expansionIconColor="#888"
    :autoFitMinWidth="false"
    :autoFitMaxWidth="false"
    :maxHeight="200"
    @input="onInput"
  />
</template>

<script>
import WTextSelect from 'w-component-vue/src/components/WTextSelect.vue'

/**
 * 設定表單專用之下拉選單(薄封裝 w-component-vue 之 WTextSelect)。
 *
 * 存在理由有二:
 *   1. 樣式單一來源 —— 表單有 7 個下拉, 若每處各寫一遍 12 行外觀 props, 那是同一規則手寫 7 次;
 *      外觀(邊框 #ccc / 圓角 3 / 白底 / 12px)在此固定一次, 與原生控制項之 CSS 對齊。
 *   2. 介面收斂 —— WTextSelect 的 value 與 @input 走的是「項目物件」, 但表單各欄位持有的是「值」;
 *      物件 ↔ 值 的轉換集中於此, 呼叫端只看得到值。
 *
 * 相對於原生 <select> 之差異(即改用本元件的目的): 下拉清單是 DOM 元素而非 OS 層視窗, 故樣式可控
 * (深色主題時不會冒出系統色的清單)、且能被 e2e 真實點擊 —— 原生 select 的下拉 CDP 點不開。
 *
 * items: [{ value, text }];  value: 目前值;  @input: 送出新值
 */
export default {
    name: 'SettingsSelect',
    components: { WTextSelect },
    props: {
        items: { type: Array, required: true },
        value: { type: [String, Number], default: '' },
        //字級跟隨表單 root(12px 或 opt.settingsPopupTextFontSize); WTextSelect 只吃字串故由呼叫端傳入
        fontSize: { type: String, default: '12px' },
    },
    computed: {
        //由值反查項目物件(找不到即 null, 顯示為空)
        selectedItem() {
            return this.items.find(v => v.value === this.value) || null
        },
    },
    methods: {
        onInput(item) {
            //WTextSelect 送出項目物件, 對外一律只送值
            this.$emit('input', item ? item.value : '')
        },
    },
}
</script>
