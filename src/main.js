import Vue from 'vue'
import App from './App.vue'

Vue.config.productionTip = false

// Fix Vue 2 bug #7330: components inside SVG foreignObject inherit
// SVG namespace, causing HTML elements to render as SVGElement (0x0).
Vue.mixin({
    beforeCreate() {
        if (this.$vnode && this.$vnode.ns === 'svg') this.$vnode.ns = undefined
    },
    beforeMount() {
        if (this.$vnode && this.$vnode.ns === 'svg') this.$vnode.ns = undefined
    },
    beforeUpdate() {
        if (this.$vnode && this.$vnode.ns === 'svg') this.$vnode.ns = undefined
    },
})

new Vue({
    render: h => h(App),
}).$mount('#app')
