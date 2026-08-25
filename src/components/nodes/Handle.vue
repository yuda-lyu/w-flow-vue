<template>
  <div
    v-if="!locked"
    :class="classes"
    :style="offsetStyle"
    :data-handle-id="id || type"
    :data-handle-type="type"
    :data-handle-position="position"
    :data-handle-binding="binding"
    @mousedown.stop="onMouseDown"
  />
</template>

<script>
export default {
    name: 'FlowHandle',
    props: {
        type: { type: String, default: 'source' }, // 'source' | 'target'
        position: { type: String, default: 'bottom' }, // 'top' | 'right' | 'bottom' | 'left'
        id: { type: String, default: null },
        //錨點綁定語義(anchorPolicy): 'auto'=預設把手(建線不烙印方位, 跟隨節點設定);
        //'fixed'=逐邊固定錨點之附加把手(建線烙印方位)。由把手身分宣告, 不以方位比較推測意圖
        binding: { type: String, default: 'auto' },
        connectable: { type: Boolean, default: true },
        locked: { type: Boolean, default: false },
        offset: { type: String, default: null },
        customStyle: { type: Object, default: null },
    },
    computed: {
        offsetStyle() {
            if (this.customStyle) return this.customStyle
            if (!this.offset) return null
            const isHorizontal = this.position === 'top' || this.position === 'bottom'
            if (isHorizontal) return { left: this.offset, transform: 'translateX(-50%)' }
            return { top: this.offset, transform: 'translateY(-50%)' }
        },
        classes() {
            return [
                'vue-flow__handle',
                `vue-flow__handle--${this.position}`,
                `vue-flow__handle--${this.type}`,
                { 'vue-flow__handle--not-connectable': !this.connectable },
            ]
        },
    },
    methods: {
        onMouseDown(event) {
            if (!this.connectable) return
            //僅主鍵可啟動建線: 右鍵/中鍵不 emit(WFlowVue 之重入守衛為第二層縱深)
            if (event.button !== 0) return
            //阻止文字選取隨拖線啟動(把手上按下拖曳屬建線手勢, 非選字)
            event.preventDefault()
            this.$emit('connect-start', {
                event,
                handleId: this.id || this.type,
                handleType: this.type,
                handlePosition: this.position,
                handleBinding: this.binding,
            })
        },
    },
}
</script>

<style scoped>
.vue-flow__handle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #555;
  border: 1px solid #fff;
  pointer-events: all;
  cursor: crosshair;
  z-index: 3;
}
/* 連出點(source)白面黑線, 與連入點(深灰底白框)區隔: 使用者一眼可辨可拖曳建線之出發點 */
.vue-flow__handle--source {
  background: #fff;
  border: 1px solid #1a1918;
}
/* 連入點(target)不可作為拖曳建線之出發點, 不顯示十字準星 */
.vue-flow__handle--target {
  cursor: default;
}
.vue-flow__handle--top {
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
}
.vue-flow__handle--bottom {
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
}
.vue-flow__handle--left {
  top: 50%;
  left: -4px;
  transform: translateY(-50%);
}
.vue-flow__handle--right {
  top: 50%;
  right: -4px;
  transform: translateY(-50%);
}
.vue-flow__handle--not-connectable {
  cursor: default;
  pointer-events: none;
}
.vue-flow__handle:hover {
  background: #0041d0;
  width: 10px;
  height: 10px;
}
.vue-flow__handle--top:hover { top: -5px; }
.vue-flow__handle--bottom:hover { bottom: -5px; }
.vue-flow__handle--left:hover { left: -5px; }
.vue-flow__handle--right:hover { right: -5px; }

/* ─── 建線期間(祖先 .vue-flow--connecting)之三態視覺 ───
   通用 hover 效果一律抑制(回復基準幾何與色彩): 可連性只由精確判定之 data-connect-* 標記指示,
   否則「不能連的落點 hover 起來與能連的一樣」會誤導使用者(對齊 React Flow/Vue Flow:
   僅游標下把手依 isValidConnection 即時標 valid/invalid) */
.vue-flow--connecting .vue-flow__handle:hover {
  background: #555;
  width: 8px;
  height: 8px;
}
.vue-flow--connecting .vue-flow__handle--source:hover { background: #fff; }
.vue-flow--connecting .vue-flow__handle--top:hover { top: -4px; }
.vue-flow--connecting .vue-flow__handle--bottom:hover { bottom: -4px; }
.vue-flow--connecting .vue-flow__handle--left:hover { left: -4px; }
.vue-flow--connecting .vue-flow__handle--right:hover { right: -4px; }
/* 方向語義(strict): source 把手永不可作為落點, 建線期間一律淡化(出發把手除外) */
.vue-flow--connecting .vue-flow__handle--source:not([data-connect-role="origin"]) {
  opacity: 0.4;
}
/* 出發把手(connectingfrom): 保持強調, 標示線之來源 */
.vue-flow__handle[data-connect-role="origin"] {
  box-shadow: 0 0 0 3px rgba(0, 65, 208, 0.35);
}
/* 游標下之精確判定(僅建線期間由 adapter 標記): 合法=主題藍 ring, 不合法=danger ring
   採 ring(box-shadow)不改 width/height, 避免尺寸變更造成 hit box 幾何抖動
   (帶祖先選擇器使權重與淡化/hover 抑制規則平手, 依源碼順序後者勝出) */
.vue-flow--connecting .vue-flow__handle[data-connect-status="valid"] {
  background: #0041d0;
  box-shadow: 0 0 0 4px rgba(0, 65, 208, 0.45);
}
.vue-flow--connecting .vue-flow__handle[data-connect-status="invalid"] {
  background: #d14343;
  box-shadow: 0 0 0 4px rgba(209, 67, 67, 0.45);
  opacity: 1;
}
</style>
