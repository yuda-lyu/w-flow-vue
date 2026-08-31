/**
 * 設定表單之屬性分群定義(節點 / 連線)。
 *
 * 分群依據(同類成熟產品之通用作法):
 *   draw.io Format panel — 頂層先分 Style / Text / Arrange, 文字自成一群;
 *                          連線再細分 Waypoints、Line style、Line start / Line end(兩端箭頭獨立成段)
 *   Figma  Design panel  — 由上而下 識別 → 幾何/版位 → 外觀(Fill/Stroke) → Typography, 每段各自摺疊
 *   分群判準           — 依欄位語義關聯與使用頻率(progressive disclosure), 罕用者置末。
 *                         刻意不以固定欄位數為門檻: Miller 7±2 講的是即時記憶容量, 不是可見表單的欄位上限
 *
 * 每群: { key, title, fields }
 *   key    — 展開態之識別鍵(表單內部用)
 *   title  — 群標題(英文, 與表單內既有欄位標籤同語彙)
 *   fields — 該群所含之欄位鍵, 與 opt.nodesSettingsExcludes / connsSettingsExcludes 同一組鍵。
 *            排除後該群若無任何可見欄位, 表單不渲染該群(不留空群)。
 *
 * 陣列順序即呈現順序。外部進階開發可 import 本表以自組表單, 或據以決定要排除哪些欄位。
 */

/**
 * 節點設定分群(對應 NodeSettingsForm 之欄位)。
 * shape 與填色/框線同屬「長什麼樣」故併於 appearance —— 單獨成群時群標題(Shape)與其唯一欄位標籤(Shape)重複。
 */
export const NODE_SETTING_GROUPS = [
    { key: 'basic', title: 'Basic', fields: ['name', 'description'] },
    { key: 'appearance', title: 'Appearance', fields: ['shape', 'faceColor', 'edgeColor', 'edgeWidth'] },
    { key: 'text', title: 'Text', fields: ['fontSize', 'fontColor'] },
    { key: 'advanced', title: 'Advanced', fields: ['popupDirection'] },
]

/**
 * 連線設定分群(對應 ConnSettingsForm 之欄位; points 為轉折點區塊, 與路徑同群)。
 * appearance 之群鍵/標題與節點一致(成員依元素型別而異), 使兩個 popup 之語彙對稱。
 */
export const CONN_SETTING_GROUPS = [
    { key: 'basic', title: 'Basic', fields: ['name', 'description'] },
    { key: 'path', title: 'Path', fields: ['type', 'fromPosition', 'toPosition', 'points'] },
    { key: 'appearance', title: 'Appearance', fields: ['edgeColor', 'edgeWidth', 'animated'] },
    { key: 'arrows', title: 'Arrows', fields: ['markerFrom', 'markerFromSize', 'markerFromFaceColor', 'markerFromEdgeColor', 'markerTo', 'markerToSize', 'markerToFaceColor', 'markerToEdgeColor'] },
    { key: 'text', title: 'Text', fields: ['fontSize', 'fontColor'] },
]

/** 預設展開之群(其餘收合): 取首群, 使 popup 一開即可改最常用欄位, 又不致全部攤開 */
export const DEFAULT_OPEN_GROUPS = ['basic']

/** 依排除清單過濾: 回傳仍有可見欄位之群(順序不變) */
export function visibleGroups(groups, excludes) {
    const ex = Array.isArray(excludes) ? excludes : []
    return groups.filter(g => g.fields.some(f => ex.indexOf(f) < 0))
}
