<template>
  <div :class="['vue-flow__controls', 'vue-flow__panel', `vue-flow__panel--${position}`]">
    <template v-if="showZoom">
      <button
        title="Zoom In"
        @click="$emit('zoom-in')"
      >
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" fill="none"/></svg>
      </button>
      <button
        title="Zoom Out"
        @click="$emit('zoom-out')"
      >
        <svg viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" stroke-width="2" fill="none"/></svg>
      </button>
    </template>
    <button
      v-if="showFitView"
      title="Fit View"
      @click="$emit('fit-view')"
    >
      <svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
    </button>
    <button
      v-if="showInteractive"
      :title="locked ? 'Unlock' : 'Lock'"
      @click="$emit('toggle-interactive')"
    >
      <svg v-if="locked" viewBox="0 0 24 24"><path d="M17 11H7a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2zM12 17a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM8 11V7a4 4 0 118 0v4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
      <svg v-else viewBox="0 0 24 24"><path d="M17 11H7a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2zM12 17a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM16 11V7a4 4 0 10-8 0" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
    </button>
    <!-- 變更儲存鈕: 僅於flow數據有未儲存變更(showSave)時顯示, 按下emit save由宿主持久化 -->
    <button
      v-if="showSave"
      class="vue-flow__controls-save"
      title="Save Changes"
      @click="$emit('save')"
    >
      <svg viewBox="0 0 24 24"><path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
    </button>
    <slot />
  </div>
</template>

<script>
export default {
    name: 'FlowControls',
    props: {
        showZoom: { type: Boolean, default: true },
        showFitView: { type: Boolean, default: true },
        showInteractive: { type: Boolean, default: true },
        showSave: { type: Boolean, default: false },
        locked: { type: Boolean, default: false },
        position: { type: String, default: 'top-left' },
    },
}
</script>

<style scoped>
.vue-flow__controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 0 2px 1px rgba(0, 0, 0, 0.08);
  background: #fefefe;
  border-radius: 4px;
  overflow: hidden;
}
.vue-flow__controls button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: #fefefe;
  cursor: pointer;
  padding: 4px;
  font-size: 14px;
  color: #333;
}
.vue-flow__controls button:hover {
  background: #f0f0f0;
}
/* 變更儲存鈕: 紅底白icon(重要儲存/刪除統一配色, 同設定表單刪除鈕 #dc2626 色系) */
.vue-flow__controls .vue-flow__controls-save {
  background: #dc2626;
  color: #fff;
}
.vue-flow__controls .vue-flow__controls-save:hover {
  background: #b91c1c;
}
.vue-flow__panel {
  position: absolute;
  z-index: 5;
}
.vue-flow__panel--top-left { top: 10px; left: 10px; }
.vue-flow__panel--top-right { top: 10px; right: 10px; }
.vue-flow__panel--bottom-left { bottom: 10px; left: 10px; }
.vue-flow__panel--bottom-right { bottom: 10px; right: 10px; }
</style>
