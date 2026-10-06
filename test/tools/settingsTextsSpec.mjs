/**
 * spec/流程_互動契約.md §12「文字鍵與預設」表之可執行抄本(測試共用; 逐字抄自 spec, 不由被測模組推導)。
 * spec 改了此表就要同步改; unit-settings-texts 以此表驗 opt 層與文字模組, unit-settings-text 以此表驗表單之每個文字站點。
 */

/** 節點設定彈窗: opt 鍵 → 英文預設(26) */
export const NODE_TEXT = {
    nodesSettingsBasicGroupTitle: 'Basic',
    nodesSettingsAppearanceGroupTitle: 'Appearance',
    nodesSettingsTextGroupTitle: 'Text',
    nodesSettingsAdvancedGroupTitle: 'Advanced',
    nodesSettingsTextLabelName: 'Name',
    nodesSettingsTextLabelDescription: 'Description',
    nodesSettingsTextLabelShape: 'Shape',
    nodesSettingsTextLabelFaceColor: 'Face Color',
    nodesSettingsTextLabelEdgeColor: 'Edge Color',
    nodesSettingsTextLabelEdgeWidth: 'Edge Width',
    nodesSettingsTextLabelFontSize: 'Font Size',
    nodesSettingsTextLabelFontColor: 'Font Color',
    nodesSettingsTextLabelPopupDirection: 'Popup Direction',
    nodesSettingsShapeTextForRectangle: 'Rectangle',
    nodesSettingsShapeTextForDiamond: 'Diamond',
    nodesSettingsShapeTextForEllipse: 'Ellipse',
    nodesSettingsShapeTextForTriangleUp: 'Triangle Up',
    nodesSettingsShapeTextForTriangleRight: 'Triangle Right',
    nodesSettingsShapeTextForTriangleDown: 'Triangle Down',
    nodesSettingsShapeTextForTriangleLeft: 'Triangle Left',
    nodesSettingsPopupDirectionTextForTop: 'Top',
    nodesSettingsPopupDirectionTextForRight: 'Right',
    nodesSettingsPopupDirectionTextForBottom: 'Bottom',
    nodesSettingsPopupDirectionTextForLeft: 'Left',
    nodesSettingsDeleteText: 'Delete',
    nodesSettingsColorConfirmText: 'Confirm',
}

/** 連線設定彈窗: opt 鍵 → 英文預設(42) */
export const CONN_TEXT = {
    connsSettingsBasicGroupTitle: 'Basic',
    connsSettingsPathGroupTitle: 'Path',
    connsSettingsAppearanceGroupTitle: 'Appearance',
    connsSettingsArrowsGroupTitle: 'Arrows',
    connsSettingsTextGroupTitle: 'Text',
    connsSettingsTextLabelName: 'Name',
    connsSettingsTextLabelDescription: 'Description',
    connsSettingsTextLabelType: 'Type',
    connsSettingsTextLabelFromPosition: 'From Anchor',
    connsSettingsTextLabelToPosition: 'To Anchor',
    connsSettingsTextLabelPoints: 'Waypoints',
    connsSettingsTextLabelEdgeColor: 'Edge Color',
    connsSettingsTextLabelEdgeWidth: 'Edge Width',
    connsSettingsTextLabelAnimated: 'Animated',
    connsSettingsTextLabelMarkerFrom: 'From Marker',
    connsSettingsTextLabelMarkerFromSize: 'From Marker Size',
    connsSettingsTextLabelMarkerFromFaceColor: 'From Marker Face Color',
    connsSettingsTextLabelMarkerFromEdgeColor: 'From Marker Edge Color',
    connsSettingsTextLabelMarkerTo: 'To Marker',
    connsSettingsTextLabelMarkerToSize: 'To Marker Size',
    connsSettingsTextLabelMarkerToFaceColor: 'To Marker Face Color',
    connsSettingsTextLabelMarkerToEdgeColor: 'To Marker Edge Color',
    connsSettingsTextLabelFontSize: 'Font Size',
    connsSettingsTextLabelFontColor: 'Font Color',
    connsSettingsTypeTextForBezier: 'Bezier',
    connsSettingsTypeTextForStraight: 'Straight',
    connsSettingsTypeTextForStep: 'Step',
    connsSettingsTypeTextForSmoothstep: 'Smooth Step',
    connsSettingsPositionTextForTop: 'Top',
    connsSettingsPositionTextForRight: 'Right',
    connsSettingsPositionTextForBottom: 'Bottom',
    connsSettingsPositionTextForLeft: 'Left',
    connsSettingsMarkerTextForNone: 'None',
    connsSettingsMarkerTextForArrow: 'Arrow',
    connsSettingsMarkerTextForArrowclosed: 'Arrow Closed',
    connsSettingsPointsAddBtnTooltip: 'Add Waypoint',
    connsSettingsPointsRemoveBtnTooltip: 'Remove Waypoint',
    connsSettingsPointsTextEmpty: 'None (auto-routed)',
    connsSettingsPointsXTooltip: 'X',
    connsSettingsPointsYTooltip: 'Y',
    connsSettingsDeleteText: 'Delete',
    connsSettingsColorConfirmText: 'Confirm',
}

/** opt 鍵 → 表單 prop 名(§12: 去掉 nodesSettings / connsSettings 前綴後首字小寫) */
export function propOf(optKey) {
    const s = optKey.replace(/^(nodes|conns)Settings/, '')
    return s.charAt(0).toLowerCase() + s.slice(1)
}

/** §12: 選項類別 = 所服務之欄位鍵; 兩欄共用一張下拉者取共同字根(fromPosition → position、markerTo → marker) */
export function categoryOfField(fieldKey) {
    return fieldKey.replace(/^(from|to)([A-Z])/, (m, a, b) => b.toLowerCase()).replace(/(From|To)$/, '')
}

/** 每個文字 prop 皆給「§prop 名」之覆寫, 供驗證表單之每個文字站點皆取自其 prop */
export function sentinelProps(table) {
    const r = {}
    for (const k of Object.keys(table)) r[propOf(k)] = '§' + propOf(k)
    return r
}
