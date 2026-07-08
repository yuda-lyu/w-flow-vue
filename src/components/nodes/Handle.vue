<template>
  <div
    v-if="!locked"
    :class="classes"
    :style="offsetStyle"
    :data-handle-id="id || type"
    :data-handle-type="type"
    :data-handle-position="position"
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
            this.$emit('connect-start', {
                event,
                handleId: this.id || this.type,
                handleType: this.type,
                handlePosition: this.position,
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
</style>
