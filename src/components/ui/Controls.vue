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
.vue-flow__panel {
  position: absolute;
  z-index: 5;
}
.vue-flow__panel--top-left { top: 10px; left: 10px; }
.vue-flow__panel--top-right { top: 10px; right: 10px; }
.vue-flow__panel--bottom-left { bottom: 10px; left: 10px; }
.vue-flow__panel--bottom-right { bottom: 10px; right: 10px; }
</style>
