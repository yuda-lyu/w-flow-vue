/**
 * 連接點幾何 —— 單一事實來源(把手渲染 nodeStyle.handlePlacementStyle 與邊端點 getHandlePosition 同用 sideAnchorFraction)。
 *
 * 契約(spec/流程_互動契約.md §4.1): 節點四邊各一連接點, 位於形狀「該邊」之中點——
 *   矩形/菱形/橢圓: 外接矩形四邊中點(菱形為四頂點, 橢圓為四極點)
 *   三角形: 頂點所在邊=頂點; 底邊=底邊中點; 兩斜邊=斜邊中點(仍落在外接矩形之 1/4 或 3/4 處)
 * 射出方向恆為外接矩形該邊之法向量(由 side 決定, 與點位無關), 三角形斜邊上之連接點亦水平/垂直射出。
 */

const RECT_FRACTION = {
    top: { fx: 0.5, fy: 0 },
    right: { fx: 1, fy: 0.5 },
    bottom: { fx: 0.5, fy: 1 },
    left: { fx: 0, fy: 0.5 },
}
//三角形: 斜邊中點落在外接矩形之 1/4、3/4(上下向三角形斜邊在左右; 左右向三角形斜邊在上下)
const TRI_VERTICAL_FRACTION = { ...RECT_FRACTION, left: { fx: 0.25, fy: 0.5 }, right: { fx: 0.75, fy: 0.5 } }
const TRI_HORIZONTAL_FRACTION = { ...RECT_FRACTION, top: { fx: 0.5, fy: 0.25 }, bottom: { fx: 0.5, fy: 0.75 } }

/**
 * 形狀 × 邊 → 連接點於外接矩形之比例座標 { fx, fy } ∈ [0,1]
 */
export function sideAnchorFraction(shape, side) {
    let table = RECT_FRACTION
    if (shape === 'triangle-up' || shape === 'triangle-down') table = TRI_VERTICAL_FRACTION
    else if (shape === 'triangle-right' || shape === 'triangle-left') table = TRI_HORIZONTAL_FRACTION
    return table[side] || table.bottom
}
