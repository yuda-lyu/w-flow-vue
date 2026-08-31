/**
 * 邊箭頭(edgeMarker)單一來源驗收(spec/流程_互動契約.md §4.3)。
 *
 * 規格:
 * K1 type: conn → defConn → ''; conn 明確 '' 為無(不落回 defConn); 非 arrow/arrowclosed 回 null。
 * K2 size: conn → defConn → 10, 夾在 [4, 40]; fill: arrowclosed 取 conn/defConn Color → 線色加深 20%, arrow 為 none(Color 不生效); stroke=線色; strokeWidth=線寬。
 * K3 id 由規格決定: 同規格同 id, 任一欄不同即不同 id; Defs 與 Wrapper 同一 id。
 * K4 markerDef: viewBox 0 0 12 12(三角形 1..11, 留白供描邊)、markerWidth/Height=size(圖面 px)、refX 11/refY 6、orient auto-start-reverse、userSpaceOnUse、外框線寬換算上限 2; id 單射; edgeWidth 0 合法。
 * K5 兩端獨立: start/end 各自解析; EdgeMarkerDefs 去重; EdgeWrapper 之 marker-start/marker-end 引用同 id。
 */
import { mount } from '@vue/test-utils'
import { resolveMarker, markerDef, markerUrl, markerId, resolveLineStyle, darkenColor, MARKER_SIZE_MIN, MARKER_SIZE_MAX } from '../src/js/edgeMarker.mjs'
import EdgeMarkerDefs from '../src/components/edges/EdgeMarkerDefs.vue'
import WFlowVue from '../src/components/WFlowVue.vue'

const dc = { edgeColor: '#b1b1b1', edgeWidth: 1 }

describe('K1 type 解析', () => {
    test('conn → defConn → 無; 明確 \'\' 不落回', () => {
        expect(resolveMarker({ markerTo: 'arrow' }, { markerTo: 'arrowclosed' }, 'to').type).toBe('arrow')
        expect(resolveMarker({}, { markerTo: 'arrowclosed' }, 'to').type).toBe('arrowclosed')
        expect(resolveMarker({}, {}, 'to')).toBeNull()
        expect(resolveMarker({ markerTo: '' }, { markerTo: 'arrow' }, 'to')).toBeNull()
        expect(resolveMarker({ markerTo: 'bogus' }, dc, 'to')).toBeNull()
        expect(resolveMarker({ markerFrom: 'arrow' }, dc, 'from').type).toBe('arrow')
        expect(resolveMarker({ markerFrom: 'arrow' }, dc, 'to')).toBeNull()
    })
})

describe('K2 size / fill / stroke', () => {
    test('size 解析與夾限', () => {
        expect(resolveMarker({ markerTo: 'arrow' }, dc, 'to').size).toBe(10)
        expect(resolveMarker({ markerTo: 'arrow', markerToSize: 16 }, dc, 'to').size).toBe(16)
        expect(resolveMarker({ markerTo: 'arrow' }, { ...dc, markerToSize: 20 }, 'to').size).toBe(20)
        expect(resolveMarker({ markerTo: 'arrow', markerToSize: 1 }, dc, 'to').size).toBe(MARKER_SIZE_MIN)
        expect(resolveMarker({ markerTo: 'arrow', markerToSize: 99 }, dc, 'to').size).toBe(MARKER_SIZE_MAX)
        expect(resolveMarker({ markerTo: 'arrow', markerToSize: 'x' }, dc, 'to').size).toBe(10)
    })
    test('arrowclosed 填充: conn Color → defConn Color → 線色; arrow 為 none; stroke 恆線色, strokeWidth 恆線寬', () => {
        //預設填色 = 線色加深 20%(#b1b1b1 → #8e8e8e), 外框仍為線色
        expect(darkenColor('#b1b1b1')).toBe('#8e8e8e')
        expect(darkenColor('#fff', 0.5)).toBe('#808080')
        expect(darkenColor('rgb(1,2,3)')).toBe('rgb(1,2,3)')
        expect(resolveMarker({ markerTo: 'arrowclosed' }, dc, 'to')).toMatchObject({ fill: '#8e8e8e', stroke: '#b1b1b1', strokeWidth: 1 })
        expect(resolveMarker({ markerTo: 'arrowclosed', markerToFaceColor: '#ff0000' }, dc, 'to').fill).toBe('#ff0000')
        expect(resolveMarker({ markerTo: 'arrowclosed' }, { ...dc, markerToFaceColor: '#00ff00' }, 'to').fill).toBe('#00ff00')
        expect(resolveMarker({ markerTo: 'arrowclosed', edgeColor: '#123456', edgeWidth: 3 }, dc, 'to')).toMatchObject({ fill: darkenColor('#123456'), stroke: '#123456', strokeWidth: 3 })
        //線式箭頭: 無填充, Color 不生效(表單亦 disabled)
        expect(resolveMarker({ markerTo: 'arrow', markerToFaceColor: '#ff0000' }, dc, 'to')).toMatchObject({ fill: 'none', stroke: '#b1b1b1' })
        expect(resolveMarker({ markerTo: 'arrow' }, dc, 'to')).toMatchObject({ fill: 'none', stroke: '#b1b1b1' })
        expect(resolveLineStyle({}, {})).toEqual({ color: '#b1b1b1', width: 1 })
    })
})

describe('K3 id', () => {
    test('同規格同 id; 任一欄不同即不同', () => {
        const a = resolveMarker({ markerTo: 'arrowclosed' }, dc, 'to')
        const b = resolveMarker({ markerTo: 'arrowclosed', markerToSize: 10, markerToFaceColor: '#8e8e8e' }, dc, 'to')
        expect(a.id).toBe(b.id)
        expect(a.id).toBe(markerId(a))
        const seen = new Set([a.id])
        for (const c of [
            { markerTo: 'arrow' },
            { markerTo: 'arrowclosed', markerToSize: 12 },
            { markerTo: 'arrowclosed', markerToFaceColor: '#ff0000' },
            { markerTo: 'arrowclosed', edgeColor: '#ff0000' },
            { markerTo: 'arrowclosed', edgeWidth: 2 },
        ]) {
            const id = resolveMarker(c, dc, 'to').id
            expect(seen.has(id)).toBe(false)
            seen.add(id)
        }
        expect(a.id).toMatch(/^[a-zA-Z0-9_-]+$/)
        expect(markerUrl(a)).toBe(`url(#${a.id})`)
        expect(markerUrl(null)).toBeNull()
    })
})

describe('K4 markerDef 幾何', () => {
    test('圖面 px 尺寸、尖端對齊端點、兩端可反向、外框留白與線寬換算', () => {
        const s = resolveMarker({ markerTo: 'arrowclosed', markerToSize: 24, edgeWidth: 2 }, dc, 'to')
        const m = markerDef(s)
        //viewBox 12 單位, 三角形佔 1..11(四周留 1 單位供描邊不被裁切), 尖端 (11,6) 對齊路徑端點
        expect(m).toMatchObject({ viewBox: '0 0 12 12', markerWidth: 24, markerHeight: 24, refX: 11, refY: 6, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' })
        expect(m.path).toBe('M 1 1 L 11 6 L 1 11 z')
        expect(m.fill).toBe('#8e8e8e')
        expect(m.strokeWidth).toBe(1) //2px × 12 / 24
        //外框線寬上限 2 單位(留白之兩倍), 粗線細箭頭不被裁切
        expect(markerDef(resolveMarker({ markerTo: 'arrow', markerToSize: 4, edgeWidth: 10 }, dc, 'to')).strokeWidth).toBe(2)
        const o = markerDef(resolveMarker({ markerTo: 'arrow' }, dc, 'to'))
        expect(o.path).toBe('M 1 1 L 11 6 L 1 11')
        expect(o.fill).toBe('none')
    })
    test('id 單射: 欄位內容不同即不同 id(去符號串接會撞者亦不撞); edgeWidth 0 合法', () => {
        const a = markerId({ type: 'arrowclosed', size: 10, fill: '#fff', stroke: 'rgb(1, 23, 4)', strokeWidth: 1.2 })
        const b = markerId({ type: 'arrowclosed', size: 10, fill: '#fff', stroke: 'rgb(12, 3, 4)', strokeWidth: 12 })
        expect(a).not.toBe(b)
        expect(a).toMatch(/^[a-zA-Z0-9_-]+$/)
        expect(resolveLineStyle({ edgeWidth: 0 }, dc)).toEqual({ color: '#b1b1b1', width: 0 })
        expect(resolveMarker({ markerTo: 'arrowclosed', edgeWidth: 0 }, dc, 'to').strokeWidth).toBe(0)
    })
})

describe('K5 兩端獨立與 Defs/Wrapper 一致', () => {
    test('EdgeMarkerDefs 去重並含兩端; EdgeWrapper 引用同 id', async () => {
        const conns = [
            { id: 'e1', from: '1', to: '2', markerFrom: 'arrow', markerTo: 'arrowclosed', markerToSize: 14, markerToFaceColor: '#ff0000' },
            { id: 'e2', from: '2', to: '1', markerTo: 'arrowclosed', markerToSize: 14, markerToFaceColor: '#ff0000' },
        ]
        const defs = mount(EdgeMarkerDefs, { propsData: { conns, defConn: dc } })
        const ids = defs.findAll('marker').wrappers.map(m => m.attributes('id'))
        expect(ids).toHaveLength(2)
        expect(ids).toContain(resolveMarker(conns[0], dc, 'from').id)
        expect(ids).toContain(resolveMarker(conns[0], dc, 'to').id)
        defs.destroy()

        const w = mount(WFlowVue, {
            propsData: {
                opt: {
                    nodes: [
                        { id: '1', name: 'N1', position: { x: 0, y: 0 }, width: 100, height: 40 },
                        { id: '2', name: 'N2', position: { x: 300, y: 200 }, width: 100, height: 40 },
                    ],
                    conns,
                },
            },
            attachTo: document.body,
        })
        await w.vm.$nextTick()
        const path = w.find('.vue-flow__edge[data-id="e1"] path[marker-end]')
        const startSpec = resolveMarker(conns[0], w.vm.defConn, 'from')
        const endSpec = resolveMarker(conns[0], w.vm.defConn, 'to')
        expect(path.attributes('marker-start')).toBe(`url(#${startSpec.id})`)
        expect(path.attributes('marker-end')).toBe(`url(#${endSpec.id})`)
        expect(w.find(`marker[id="${endSpec.id}"]`).exists()).toBe(true)
        expect(w.find(`marker[id="${startSpec.id}"]`).exists()).toBe(true)
        //無箭頭之邊不帶 marker 屬性
        const e2 = w.find('.vue-flow__edge[data-id="e2"] path[marker-end]')
        expect(e2.attributes('marker-start')).toBeUndefined()
        w.destroy()
    })
})

describe('M7 箭頭外框色(markerXxxEdgeColor)獨立於線色', () => {
    const dc = { edgeColor: '#b1b1b1', edgeWidth: 1 }

    test('未給 EdgeColor: stroke 跟隨線色(既有行為, 向後相容)', () => {
        expect(resolveMarker({ markerTo: 'arrow' }, dc, 'to').stroke).toBe('#b1b1b1')
        expect(resolveMarker({ markerTo: 'arrowclosed', edgeColor: '#123456' }, dc, 'to').stroke).toBe('#123456')
    })

    test('給了 EdgeColor: stroke 用該色而非線色', () => {
        expect(resolveMarker({ markerTo: 'arrow', markerToEdgeColor: '#00ff00' }, dc, 'to').stroke).toBe('#00ff00')
        expect(resolveMarker({ markerTo: 'arrowclosed', edgeColor: '#123456', markerToEdgeColor: '#00ff00' }, dc, 'to').stroke).toBe('#00ff00')
    })

    test('線式箭頭亦適用(其只有描邊, 故 EdgeColor 對它才是唯一有效的顏色)', () => {
        const m = resolveMarker({ markerTo: 'arrow', markerToEdgeColor: '#ff00ff' }, dc, 'to')
        expect(m).toMatchObject({ fill: 'none', stroke: '#ff00ff' })
    })

    test('Face 與 Edge 各自獨立: 兩者可為不同色', () => {
        const m = resolveMarker({ markerTo: 'arrowclosed', markerToFaceColor: '#ff0000', markerToEdgeColor: '#0000ff' }, dc, 'to')
        expect(m).toMatchObject({ fill: '#ff0000', stroke: '#0000ff' })
    })

    test('兩端各自獨立', () => {
        const c = { markerFrom: 'arrowclosed', markerFromEdgeColor: '#111111', markerTo: 'arrowclosed', markerToEdgeColor: '#222222' }
        expect(resolveMarker(c, dc, 'from').stroke).toBe('#111111')
        expect(resolveMarker(c, dc, 'to').stroke).toBe('#222222')
    })

    test('defConn 可提供預設, conn 明確給值時覆蓋之', () => {
        const d2 = { ...dc, markerToEdgeColor: '#aaaaaa' }
        expect(resolveMarker({ markerTo: 'arrow' }, d2, 'to').stroke).toBe('#aaaaaa')
        expect(resolveMarker({ markerTo: 'arrow', markerToEdgeColor: '#bbbbbb' }, d2, 'to').stroke).toBe('#bbbbbb')
    })

    test('EdgeColor 不同即為不同 marker id(defs 不會共用到錯的框色)', () => {
        const a = resolveMarker({ markerTo: 'arrow', markerToEdgeColor: '#00ff00' }, dc, 'to')
        const b = resolveMarker({ markerTo: 'arrow', markerToEdgeColor: '#0000ff' }, dc, 'to')
        expect(a.id).not.toBe(b.id)
    })

    test('markerDef 之 stroke 取自 spec.stroke(實際繪製屬性)', () => {
        const m = resolveMarker({ markerTo: 'arrowclosed', markerToEdgeColor: '#00ff00' }, dc, 'to')
        expect(markerDef(m).stroke).toBe('#00ff00')
    })
})
