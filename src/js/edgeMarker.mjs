/**
 * 邊箭頭(marker)之單一解析來源: EdgeMarkerDefs(產 <defs>)與 EdgeWrapper(引用 url(#id))皆經此模組,
 * id 由同一函式產生, 兩端不可能分家。
 *
 * 契約(spec/流程_互動契約.md §4.3):
 *   type:  conn.marker{End|Start}      → defConn.marker{End|Start}      → ''(無); conn 明確給 '' 即為無(不落回 defConn)
 *   size:  conn.marker{End|Start}Size  → defConn.marker{End|Start}Size  → 10   (圖面 px, 隨 zoom 同比縮放; 不隨線寬)
 *   fill:  conn.marker{End|Start}FaceColor → defConn.同鍵 → 線色加深 20%(僅 arrowclosed 使用, 三角形填色; arrow 無填充)
 *          why 加深: 預設填色與線同色時箭頭與線融成一片, 方向不易辨識; 加深由線色推導, 宿主改線色即跟隨
 *   stroke: conn.marker{End|Start}EdgeColor → defConn.同鍵 → 線色(箭頭外框色; arrow 與 arrowclosed 皆適用)
 *          未給時跟隨線色即為既有行為, 故本欄為向後相容之 opt-in 擴充
 *   strokeWidth = 線寬(箭頭外框與線同粗)
 * type ∈ '' | 'arrow'(線式, 無填充) | 'arrowclosed'(實心)
 */

export const MARKER_TYPES = ['', 'arrow', 'arrowclosed']
export const MARKER_SIZE_DEFAULT = 10
export const MARKER_SIZE_MIN = 4
export const MARKER_SIZE_MAX = 40

/** 線色/線寬解析(與 EdgeWrapper.connStyle 同一順序) */
export function resolveLineStyle(conn, defConn) {
    const c = conn || {}
    const d = defConn || {}
    const color = c.edgeColor || d.edgeColor || '#b1b1b1'
    //線寬: 0 為合法(與 EdgeWrapper.connStyle 同一解析, 不正規化成 1); 非數值才回 1
    let width = 1
    const num = (v) => {
        const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null
    }
    if (c.edgeWidth !== undefined && c.edgeWidth !== null && num(c.edgeWidth) !== null) width = num(c.edgeWidth)
    else if (d.edgeWidth !== undefined && d.edgeWidth !== null && num(d.edgeWidth) !== null) width = num(d.edgeWidth)
    return { color, width }
}

/** 顏色加深(僅處理 #rgb/#rrggbb; 其他格式原樣回傳): 各通道乘以 (1 - ratio) */
export function darkenColor(color, ratio = 0.2) {
    const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(color || '').trim())
    if (!m) return color
    let hex = m[1]
    if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('')
    const out = []
    for (let i = 0; i < 3; i++) {
        const v = Math.round(parseInt(hex.slice(i * 2, i * 2 + 2), 16) * (1 - ratio))
        out.push(Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
    }
    return '#' + out.join('')
}

function clampSize(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) return MARKER_SIZE_DEFAULT
    return Math.min(MARKER_SIZE_MAX, Math.max(MARKER_SIZE_MIN, n))
}

function pick(c, d, key) {
    if (c[key] !== undefined && c[key] !== null && c[key] !== '') return c[key]
    if (d[key] !== undefined && d[key] !== null && d[key] !== '') return d[key]
    return undefined
}

/**
 * 解析某端之 marker 規格; 無箭頭回 null。
 * @param {Object} conn
 * @param {Object} defConn
 * @param {'from'|'to'} end
 * @returns {{ type, size, fill, stroke, strokeWidth, id }|null}
 */
export function resolveMarker(conn, defConn, end) {
    const c = conn || {}
    const d = defConn || {}
    const k = end === 'from' ? 'markerFrom' : 'markerTo'
    //type: conn 明確給 ''(None)即為無箭頭, 不落回 defConn; 未給(undefined/null)才取 defConn
    const type = (c[k] !== undefined && c[k] !== null) ? c[k] : d[k]
    if (type !== 'arrow' && type !== 'arrowclosed') return null
    const line = resolveLineStyle(c, d)
    const size = clampSize(pick(c, d, k + 'Size'))
    const fill = type === 'arrowclosed' ? (pick(c, d, k + 'FaceColor') || darkenColor(line.color)) : 'none'
    //外框色: 未給即跟隨線色(既有行為), 給了才獨立於線色
    const stroke = pick(c, d, k + 'EdgeColor') || line.color
    const spec = { type, size, fill, stroke, strokeWidth: line.width }
    spec.id = markerId(spec)
    return spec
}

/**
 * marker 元素 id(同規格同 id 供 defs 去重; 不同規格必不同 id)。
 * 各欄以單射編碼(非英數字元 → '_' + 十六進位碼), 欄間以 '-'(不會出現於編碼結果)分隔,
 * 故 'rgb(1, 23, 4)'+1.2 與 'rgb(12, 3, 4)'+12 之類的組合不會撞 id。
 */
export function markerId(spec) {
    const enc = (v) => String(v).replace(/[^a-zA-Z0-9]/g, (ch) => '_' + ch.charCodeAt(0).toString(16))
    return `vue-flow__mk-${enc(spec.type)}-${enc(spec.size)}-${enc(spec.fill)}-${enc(spec.stroke)}-${enc(spec.strokeWidth)}`
}

/**
 * <marker> 繪製屬性: viewBox 0 0 12 12, 三角形佔 1..11(四周留 1 單位供外框描邊, 不被 marker 之 overflow 裁切);
 * 尖端 (11,6) 對齊路徑端點; markerUnits=userSpaceOnUse 使 size 為圖面 px(隨 viewport zoom 同比縮放, 與節點/線同;
 * 不隨線寬)。外框線寬以 viewBox 單位換算: 線寬 × 12 / size, 上限 2(留白之兩倍, 超出即會被裁切)。
 */
export function markerDef(spec) {
    const closed = spec.type === 'arrowclosed'
    return {
        id: spec.id,
        viewBox: '0 0 12 12',
        markerWidth: spec.size,
        markerHeight: spec.size,
        refX: 11,
        refY: 6,
        orient: 'auto-start-reverse',
        markerUnits: 'userSpaceOnUse',
        path: closed ? 'M 1 1 L 11 6 L 1 11 z' : 'M 1 1 L 11 6 L 1 11',
        fill: closed ? spec.fill : 'none',
        stroke: spec.stroke,
        strokeWidth: Math.min(2, (spec.strokeWidth * 12) / spec.size),
    }
}

/** url(#id) 供 path 之 marker-start/marker-end; 無箭頭回 null */
export function markerUrl(spec) {
    return spec ? `url(#${spec.id})` : null
}
