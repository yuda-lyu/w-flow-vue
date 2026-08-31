/**
 * jest 之 CSS import stub。
 *
 * 元件以 `import './settingsForm.css'` 自帶樣式(使表單被外部單獨引用時亦有完整版面), webpack 能處理,
 * 但 jest 無 CSS transform, 直接 require 會拋 SyntaxError。單元測試驗的是 DOM 結構與行為, 不驗實際樣式
 * (樣式歸 e2e 之 pixel baseline), 故映射為空物件即可。
 *
 * 命名不帶 `.test.` 中綴, 亦不符 testMatch 之 unit- 與 api- 白名單, 不會被當成測試檔。
 */
module.exports = {}
