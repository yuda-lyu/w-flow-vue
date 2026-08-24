<script>
//極小functional出口: 以「普通函式prop」渲染宿主scoped slot內容, 取代條件式slot轉發鏈
//why: v-if條件式slot轉發於編譯層為動態slot, 使接收元件$stable=false——上游每次re-render
//     都強制全部子元件重渲染(實測: 父層改動無關資料10次, 有轉發=10/10次子更新, 移除=0/10);
//     改為函式prop後, 宿主slot函式identity穩定(實測跨宿主/上游churn皆同一參照), prop不變即不重渲染,
//     slot定義真的變更(宿主v-if切換)時prop更新為正當之重渲染, invalidation語義正確
export default {
    name: 'SlotOutlet',
    functional: true,
    props: {
        render: { type: Function, required: true },
        scope: { type: Object, default: () => ({}) },
    },
    render(h, ctx) {
        //scoped slot函式可能回傳undefined/null(內容為空), 回空陣列避免渲染錯誤
        const out = ctx.props.render(ctx.props.scope)
        return (out === undefined || out === null) ? [] : out
    },
}
</script>
