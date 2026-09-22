import { isFromMouse, armPointerGesture } from '../../js/domGesture.mjs'

/**
 * pointer 通道(觸控/觸控筆)之手勢入口接線 —— 畫布/節點/四角/把手/轉折點/label 共用同一份規則。
 *
 * 分流與延後之理由見 js/domGesture.mjs 之 isFromMouse 與 armPointerGesture:
 * 滑鼠同時送 pointer 與 mouse 兩套事件(故跳過滑鼠), 觸控之點按會補送相容滑鼠事件而拖曳不會(故延後到跨門檻)。
 *
 * 用法: 元件 template 掛 `@pointerdown="onXxxPointerDown"`, method 內呼叫
 * `this.armPointer(event, (down) => this.onXxxMouseDown(down))` —— 既有滑鼠 handler 原樣重用, 不複製手勢邏輯。
 */
export default {
    beforeDestroy() {
        //尚未跨門檻即被銷毀者, 其 document 監聽不會自行移除
        this.disposePointerArm()
    },
    methods: {
        armPointer(event, start) {
            if (isFromMouse(event)) return
            //同一元件上一次之未啟動閘門先收掉(如手指放開未送達 pointerup), 避免監聽器疊加
            this.disposePointerArm()
            this._ptrArm = armPointerGesture(event, (down) => {
                this._ptrArm = null
                start(down)
            })
        },
        disposePointerArm() {
            if (!this._ptrArm) return false
            this._ptrArm.dispose()
            this._ptrArm = null
            return true
        },
    },
}
