<template>
  <WText
    class="vue-flow__settings-text"
    :value="value"
    :textFontSize="fontSize"
    textColor="inherit"
    :height="14"
    :borderRadius="3"
    :shadow="false"
    :paddingStyle="{ v: 1, h: 4 }"
    backgroundColor="#fff"
    backgroundColorHover="#fff"
    backgroundColorFocus="#fff"
    borderColor="#ccc"
    borderColorHover="#666"
    borderColorFocus="#666"
    :bottomLineBorderWidth="0"
    :bottomLineBorderWidthHover="0"
    :bottomLineBorderWidthFocus="0"
    @input="onInput"
  />
</template>

<script>
import WText from 'w-component-vue/src/components/WText.vue'

/**
 * 設定表單專用之文字輸入框(薄封裝 w-component-vue 之 WText)。
 *
 * 存在理由同 SettingsSelect: 外觀 props 集中一處(表單有 4 個文字欄), 且把 WText 之
 * `@input(value, err, event)` 三參數簽章收斂成只送值。
 *
 * WText 預設為「底線」外觀(bottomLine* 系列), 此處關掉底線改用四邊框線, 以對齊表單既有之
 * 原生控制項樣式(1px #ccc / 圓角 3 / 白底)。
 *
 * height 給 14 而非 18: 該 prop 指的是**內容區**高度, 外框尚須加上 padding(1+1)與 border(1+1),
 * 故 14 + 2 + 2 = 18px, 恰與同表單之原生 number input 等高(給 20 會得到 24px 而比鄰列高出一截)。
 */
export default {
    name: 'SettingsText',
    components: { WText },
    props: {
        value: { type: [String, Number], default: '' },
        fontSize: { type: String, default: '12px' },
    },
    methods: {
        onInput(v) {
            //WText 送出 (value, err, event); 對外只送值
            this.$emit('input', v)
        },
    },
}
</script>
