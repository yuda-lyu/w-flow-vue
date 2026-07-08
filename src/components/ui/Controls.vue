<template>
  <!-- 垂直選單: 改用w-threejs-vue同款組件WGroupIconCheck(:dir='vertical'), 最頂為設定鈕, 收合時僅顯示設定鈕, 展開才顯示其餘按鈕 -->
  <div
    :class="['vue-flow__panel', `vue-flow__panel--${position}`]"
    :style="panelStyle"
  >
    <!-- 淺色系配色(w-flow-vue圖台為白底, 沿用原Controls之#fefefe白底/深灰icon風格; 不設iconSize故用預設22, 按鈕寬=22+左右padding8=30px與w-threejs-vue選單一致) -->
    <!-- 全數為一般動作鈕(不用active態): 鎖頭點擊即切換上鎖/解鎖並換icon(比照fitView等), 不留固定灰底; value恆空故無任一鈕呈active -->
    <WGroupIconCheck
      :items="useItems"
      :dir="'vertical'"
      :iconColor="'#555'"
      :iconColorHover="'#222'"
      :iconColorFocus="'#222'"
      :iconColorActive="'#111'"
      :backgroundColor="'#fefefe'"
      :backgroundColorHover="'#f0f0f0'"
      :backgroundColorFocus="'#f0f0f0'"
      :backgroundColorActive="'#e4e4e4'"
      :seplineColor="'#e6e6e6'"
      :shadow="true"
      :tooltipTextFontSize="'0.7rem'"
      :value="[]"
      @click="onClickItem"
    ></WGroupIconCheck>
  </div>
</template>

<script>
import WGroupIconCheck from 'w-component-vue/src/components/WGroupIconCheck.vue'
import { mdiCogOutline, mdiMagnifyPlusOutline, mdiMagnifyMinusOutline, mdiFitToPageOutline, mdiLockOutline, mdiLockOpenVariantOutline } from '@mdi/js/mdi.js'

export default {
    name: 'FlowControls',
    components: { WGroupIconCheck },
    props: {
        showZoom: { type: Boolean, default: true },
        showFitView: { type: Boolean, default: true },
        showInteractive: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
        position: { type: String, default: 'top-left' },
        //垂直選單向下偏移量(px), 供宿主避開其他左上角覆蓋元素(如變更儲存鈕), 比照w-threejs-vue之menuYShift
        menuYShift: { type: Number, default: 0 },
    },
    data() {
        return {
            //設定鈕展開狀態(收合時僅顯示設定鈕, 展開才顯示其餘按鈕), 比照w-threejs-vue
            useSetting: true,
        }
    },
    computed: {
        allItems() {
            let rs = [
                { id: 'setting', icon: mdiCogOutline, tooltip: 'Settings' },
            ]
            if (this.showZoom) {
                rs.push({ id: 'zoomIn', icon: mdiMagnifyPlusOutline, tooltip: 'Zoom In' })
                rs.push({ id: 'zoomOut', icon: mdiMagnifyMinusOutline, tooltip: 'Zoom Out' })
            }
            if (this.showFitView) {
                rs.push({ id: 'fitView', icon: mdiFitToPageOutline, tooltip: 'Fit View' })
            }
            if (this.showInteractive) {
                rs.push({ id: 'interactive', icon: this.locked ? mdiLockOutline : mdiLockOpenVariantOutline, tooltip: this.locked ? 'Unlock' : 'Lock' })
            }
            return rs
        },
        useItems() {
            //設定鈕恆在最頂; 收合時僅顯示設定鈕
            if (this.useSetting) {
                return this.allItems
            }
            return [this.allItems[0]]
        },
        panelStyle() {
            //向下偏移: top-*位置加margin-top, bottom-*位置加margin-bottom(margin於絕對定位元素上等同再位移該側)
            let s = 'z-index:5;'
            if (this.position.indexOf('bottom') >= 0) {
                s += `margin-bottom:${this.menuYShift}px;`
            }
            else {
                s += `margin-top:${this.menuYShift}px;`
            }
            return s
        },
    },
    methods: {
        onClickItem(item) {
            let id = (item && item.id) || ''
            if (id === 'setting') {
                this.useSetting = !this.useSetting
            }
            else if (id === 'zoomIn') {
                this.$emit('zoom-in')
            }
            else if (id === 'zoomOut') {
                this.$emit('zoom-out')
            }
            else if (id === 'fitView') {
                this.$emit('fit-view')
            }
            else if (id === 'interactive') {
                this.$emit('toggle-interactive')
            }
        },
    },
}
</script>

<style scoped>
.vue-flow__panel {
  position: absolute;
  z-index: 5;
}
.vue-flow__panel--top-left { top: 10px; left: 10px; }
.vue-flow__panel--top-right { top: 10px; right: 10px; }
.vue-flow__panel--bottom-left { bottom: 10px; left: 10px; }
.vue-flow__panel--bottom-right { bottom: 10px; right: 10px; }
</style>
