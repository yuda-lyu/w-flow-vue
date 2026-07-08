# w-flow-vue
A vue component for flowchart and workflow diagram editing.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![language](https://img.shields.io/badge/vue-2.x-brightgreen.svg)](https://github.com/vuejs/vue) 
[![npm version](http://img.shields.io/npm/v/w-flow-vue.svg?style=flat)](https://npmjs.org/package/w-flow-vue) 
[![license](https://img.shields.io/npm/l/w-flow-vue.svg?style=flat)](https://npmjs.org/package/w-flow-vue) 
[![npm download](https://img.shields.io/npm/dt/w-flow-vue.svg)](https://npmjs.org/package/w-flow-vue) 
[![npm download](https://img.shields.io/npm/dm/w-flow-vue.svg)](https://npmjs.org/package/w-flow-vue) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-flow-vue.svg)](https://www.jsdelivr.com/package/npm/w-flow-vue)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-flow-vue/module-WFlowVue.html).

## Example
To view some examples for more understanding, visit examples:

> **all examples:** [web](https://yuda-lyu.github.io/w-flow-vue/examples/app.html) [[source code](https://github.com/yuda-lyu/w-flow-vue/blob/master/docs/examples/app.html)]

## Installation

### Using npm(ES6 module):
```alias
npm i w-flow-vue
```

### In a browser(UMD module):

Add script for vue.
```alias
<script src="https://cdn.jsdelivr.net/npm/vue@2.x/dist/vue.min.js"></script>
```

Add script for w-flow-vue.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-flow-vue@1.0.4/dist/w-flow-vue.umd.js"></script>
```

## Required setup for Vue 2 apps

Node and connection popups are rendered inside SVG `foreignObject`. Vue 2 has a known bug ([vuejs/vue#7330](https://github.com/vuejs/vue/issues/7330)) where components inside `foreignObject` inherit the SVG namespace, so their HTML content renders as `SVGElement` with zero size. Add this global mixin once in your app entry (e.g. `main.js`) before mounting:

```js
import Vue from 'vue'

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
```

The mixin only clears the inherited namespace on component boundaries; SVG tags still resolve to the SVG namespace via `getTagNamespace`, so normal SVG rendering is unaffected.
