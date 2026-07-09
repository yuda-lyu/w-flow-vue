/**
 * Vue 2 bug #7330: 位於<svg>內之元件, 其$vnode.ns恆為'svg',
 * 致該元件render出的所有元素(含傳入子元件之slot內容)皆被建為SVGElement,
 * HTML元素因而無排版盒(0x0不可見)。
 *
 * 官方applyNS雖於遇到foreignObject時重置後代ns, 但僅走vnode.children;
 * 傳入子元件之slot內容存於componentOptions.children, 不在其巡訪範圍, 故無法被救回。
 *
 * 修正: 於render前清除自身$vnode.ns, 使其createElement改依getTagNamespace決定
 * (g/path→svg, div/span→HTML), root之<g>再經applyNS正確處理foreignObject。
 *
 * 用法: 於「內含foreignObject且在<svg>內」之元件掛上 mixins: [fixSvgNs]。
 */
const fixSvgNs = {
    beforeCreate() {
        if (this.$vnode && this.$vnode.ns === 'svg') this.$vnode.ns = undefined
    },
    beforeMount() {
        if (this.$vnode && this.$vnode.ns === 'svg') this.$vnode.ns = undefined
    },
    beforeUpdate() {
        if (this.$vnode && this.$vnode.ns === 'svg') this.$vnode.ns = undefined
    },
}

export default fixSvgNs
