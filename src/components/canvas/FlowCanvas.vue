<template>
  <div
    class="vue-flow"
    ref="container"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel.prevent="onWheel"
    @dblclick="onDoubleClick"
    @contextmenu="onContextMenu"
  >
    <slot />
  </div>
</template>

<script>
import { crossedThreshold, isFromMouse } from '../../js/domGesture.mjs'
import pointerGesture from '../mixins/pointerGesture.mjs'

export default {
    name: 'FlowCanvas',
    mixins: [pointerGesture],
    methods: {
        //pointer 通道(觸控/觸控筆)之畫布手勢入口。
        //單指: 接觸不啟動, 跨門檻才發 canvas-mousedown(見 mixins/pointerGesture);
        //      純點按不經此路——tap 由瀏覽器補送之相容滑鼠事件走 onMouseDown/onMouseUp, canvas-click 之合成因而仍只有一處。
        //雙指: 捏合縮放, 以兩指距離比與中點發 canvas-pinch(第二指落下即讓位, 收掉單指閘門)。
        onPointerDown(event) {
            if (isFromMouse(event)) return
            const ps = this.pointers()
            //新手勢之第一指(isPrimary)落下即重置指標表: 手指若於容器外放開或其捕獲元素中途被移除,
            //pointerup 可能不會送達本元件而留下殘影, 屆時單指會被誤判為雙指而進入捏合
            if (event.isPrimary) ps.clear()
            ps.set(event.pointerId, { x: event.clientX, y: event.clientY })
            if (ps.size === 2) {
                this.disposePointerArm()
                this._pinchDist = this.pinchDist()
                this.$emit('canvas-pinch-start')
                return
            }
            //三指以上不定義手勢(不啟動亦不縮放)
            if (ps.size > 2) return
            this.armPointer(event, (down) => this.$emit('canvas-mousedown', down))
        },
        onPointerMove(event) {
            if (isFromMouse(event)) return
            const ps = this.pointers()
            if (!ps.has(event.pointerId)) return
            ps.set(event.pointerId, { x: event.clientX, y: event.clientY })
            if (ps.size !== 2 || !this._pinchDist) return
            const dist = this.pinchDist()
            if (!dist) return
            const scale = dist / this._pinchDist
            this._pinchDist = dist
            const c = this.pinchCenter()
            this.$emit('canvas-pinch', { scale, clientX: c.x, clientY: c.y })
        },
        //pointerup 與 pointercancel 共用: 任一指離開即退出捏合(剩一指不續接平移, 避免視圖跳動)
        onPointerUp(event) {
            if (isFromMouse(event)) return
            const ps = this.pointers()
            ps.delete(event.pointerId)
            if (ps.size < 2) this._pinchDist = null
        },
        //進行中之非滑鼠指標(pointerId → client 座標); 非反應式, 只供手勢換算
        pointers() {
            if (!this._ptrs) this._ptrs = new Map()
            return this._ptrs
        },
        pinchDist() {
            const [a, b] = [...this.pointers().values()]
            if (!a || !b) return 0
            return Math.hypot(a.x - b.x, a.y - b.y)
        },
        pinchCenter() {
            const [a, b] = [...this.pointers().values()]
            if (!a || !b) return { x: 0, y: 0 }
            return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        },
        onMouseDown(event) {
            this._downPos = { x: event.clientX, y: event.clientY }
            this._didMove = false
            this.$emit('canvas-mousedown', event)
        },
        onMouseMove(event) {
            //曾跨門檻即鎖住: 只比對mouseup當下與mousedown之距離無法辨識「拖出去又移回原點放開」,
            //該情形實為拖曳(平移/框選)卻會被判為click
            if (this._downPos && !this._didMove && crossedThreshold(this._downPos.x, this._downPos.y, event.clientX, event.clientY)) {
                this._didMove = true
            }
        },
        onMouseUp(event) {
            // Emit click only if mouse didn't move (distinguish from drag/pan/select)
            //且僅主鍵: 原生click事件本就只由主鍵觸發, 此處合成之canvas-click不應由右鍵/中鍵產生
            //(否則右鍵點空白處會經onCanvasClick清空選取)
            if (this._downPos && !this._didMove && event.button === 0) {
                this.$emit('canvas-click', event)
            }
            this._downPos = null
            this._didMove = false
        },
        onWheel(event) {
            this.$emit('canvas-wheel', event)
        },
        onDoubleClick(event) {
            this.$emit('canvas-dblclick', event)
        },
        onContextMenu(event) {
            this.$emit('canvas-contextmenu', event)
        },
        getContainerRect() {
            return this.$refs.container ? this.$refs.container.getBoundingClientRect() : null
        },
    },
}
</script>

<style scoped>
.vue-flow {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* 觸控手勢歸圖台, 不交給瀏覽器捲動/縮放: 未宣告時(預設 auto)瀏覽器會在手指移動數 px 後接手平移,
     並以 pointercancel 中斷事件流, 圖台只收得到 2~3 個 pointermove(實測)。
     宣告 none 即可拿到完整軌跡, 且不必在 down 事件上 preventDefault——那會連帶抑制點按之相容滑鼠事件
     (node-click / canvas-click / WPopup 之 window 層關閉協調全靠它們)。
     與滑鼠對稱, 非觸控獨有之限制: 上方 @wheel.prevent 早已無條件吃掉圖台上的滾輪, 頁面同樣捲不動
     (實測 2026-09-21: 滾輪於圖台上 scrollY 0→0 而 zoom 1→0.6; 於圖台外 scrollY 0→12)。
     故「手指/滾輪放在圖台上就由圖台處理, 移出圖台才捲頁面」兩種輸入一致, 不另開放行選項。 */
  touch-action: none;
  background-color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
