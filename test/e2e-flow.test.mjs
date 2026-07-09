/**
 * E2E 圖台互動測試(Playwright)—— 單檔雙模式,對應 spec/流程_圖台互動.md 之 E2E-001 ~ E2E-028。
 *
 * 前置: npm run serve(dev server 須在 127.0.0.1:8080)
 *
 * 比對模式(預設):   node test/e2e-flow.test.mjs
 * 產製標準圖:        node test/e2e-flow.test.mjs --baseline
 * 手術式重產:        node test/e2e-flow.test.mjs --baseline --names E2E-014,E2E-018
 *
 * 設計要點:
 * - 每個 case 各自 new 一次 browser(per-case fresh),彼此不帶狀態。
 * - 產製端與比對端共用同一個 case 函式與 captureStable, 兩邊不會漂移。
 * - 語意斷言為主(對應 spec 之可觀察陳述), pixel baseline 為補強層。
 * - setup 階段得直接設定 opt 資料(如塞入轉折點); act 階段一律走真實滑鼠/鍵盤。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import { baseUrl, captureStable, assertBaselineMatch } from './e2e-setup.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baselineDir = path.join(__dirname, 'pics')

const VW = 1280
const VH = 900
const PAD = 60

const isBaseline = process.argv.includes('--baseline')
const onlyNames = (() => {
    const i = process.argv.indexOf('--names')
    if (i < 0) return null
    return String(process.argv[i + 1] || '').split(',').map(s => s.trim()).filter(Boolean)
})()

let passed = 0
let failed = 0
let errors = []

function record(ok, name, msg) {
    if (ok) {
        passed++
        console.log(`    ✓ ${name}`)
    }
    else {
        failed++
        errors.push(`${name}: ${msg}`)
        console.log(`    ✗ ${name} — ${msg}`)
    }
}

/** 語意斷言(主驗證) */
function expectOk(name, ok, msg) {
    record(!!ok, name, msg)
}

/** pixel baseline(補強層): --baseline 寫檔, 否則比對 */
async function shot(page, name, opts = {}) {
    const buf = await captureStable(page, opts)
    const bp = path.join(baselineDir, name + '.png')
    if (isBaseline) {
        fs.writeFileSync(bp, buf)
        console.log(`    + ${name}`)
        return
    }
    try {
        assertBaselineMatch(buf, bp, name)
        record(true, `pixel:${name}`)
    }
    catch (err) {
        record(false, `pixel:${name}`, err.message)
    }
}

// ─────────────────────────── page helpers ───────────────────────────

/** 於頁面內以 WFlowVue 實例執行一段程式碼(body 為字串, 回傳可序列化值) */
function evalVm(page, body, arg = null) {
    return page.evaluate(({ body, arg }) => {
        let vm = null
        for (const el of document.querySelectorAll('*')) {
            if (el.__vue__ && el.__vue__.setViewport) {
                vm = el.__vue__
                break
            }
        }
        // eslint-disable-next-line no-new-func
        return new Function('vm', 'arg', body)(vm, arg)
    }, { body, arg })
}

async function openPage(browser) {
    const page = await browser.newPage({ viewport: { width: VW, height: VH } })
    await page.goto(baseUrl)
    await page.waitForSelector('.vue-flow__edge', { timeout: 20000 })
    await page.waitForTimeout(800)
    //掛事件記錄器(assert 用, 非 act)
    await evalVm(page, `
        window.__ev = []
        for (const e of ['update:nodes','update:conns','node-resize-end','conn-settings-update']) {
            vm.$on(e, () => window.__ev.push(e))
        }
        return true
    `)
    return page
}

const emitted = (page) => page.evaluate(() => window.__ev.slice())
const getViewport = (page) => evalVm(page, 'return { ...vm.viewport }')
const getLocked = (page) => evalVm(page, 'return vm.locked')
const getSelectedNodes = (page) => evalVm(page, 'return vm.selectedNodes.slice()')
const getNode = (page, id) => evalVm(page, 'return JSON.parse(JSON.stringify(vm.nodes.find(n => n.id === arg)))', id)
const getConnsLen = (page) => evalVm(page, 'return vm.conns.length')

const getAffordances = (page) => page.evaluate(() => ({
    nodeGear: !!document.querySelector('.vue-flow__node-settings'),
    resizeHandles: document.querySelectorAll('.vue-flow__resize').length,
    connHandles: document.querySelectorAll('.vue-flow__handle').length,
    edgeGear: !!document.querySelector('.vue-flow__edge-settings'),
}))

const getForms = (page) => page.evaluate(() => {
    const fs2 = [...document.querySelectorAll('.vue-flow__settings-form')]
    return { count: fs2.length, hasNodeForm: fs2.some(f => /刪除節點/.test(f.textContent || '')) }
})

/** EdgeWrapper 之資訊 popup 狀態(語意斷言用) */
const getConnPopupState = (page, connId) => evalVm(page, `
    const ws = (vm.$refs.edgeRenderer && vm.$refs.edgeRenderer.$refs.wrappers) || []
    const w = ws.find(c => c.conn && c.conn.id === arg)
    if (!w) return null
    return { hasInfoPopup: w.hasInfoPopup, infoPopupShow: w.infoPopupShow }
`, connId)

/** 連線之路徑 d(用以驗證拖曳中與放開後一致) */
const getConnPathD = (page, connId) => page.evaluate((id) => {
    const p = document.querySelector(`[data-id="${id}"] path`)
    return p ? p.getAttribute('d') : null
}, connId)

const getCanvasClip = (page) => page.evaluate(() => {
    const el = document.querySelector('.vue-flow__viewport')
    const c = el.closest('[style*="height"]')
    const r = c.getBoundingClientRect()
    return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) }
})

const getContainerRect = (page) => page.evaluate(() => {
    const el = document.querySelector('.vue-flow')
    const r = el.getBoundingClientRect()
    return { left: r.left, top: r.top, width: r.width, height: r.height }
})

function clipAround(box, pad) {
    const x = Math.max(0, Math.floor(box.x - pad))
    const y = Math.max(0, Math.floor(box.y - pad))
    const w = Math.min(Math.ceil(box.width + pad * 2), VW - x)
    const h = Math.min(Math.ceil(box.height + pad * 2), VH - y)
    if (w < 1 || h < 1) return null
    return { x, y, width: w, height: h }
}

/** 以 vm.setViewport 取景(僅供外觀 case 的框取, 非受測互動) */
const centerOnNode = (page, id) => evalVm(page, `
    const n = vm.nodes.find(x => x.id === arg)
    if (!n) return false
    const w = n.width || 100
    const h = n.height || 40
    vm.setViewport({ x: vm.widthInp / 2 - (n.position.x + w / 2), y: vm.heightInp / 2 - (n.position.y + h / 2), zoom: 1 })
    return true
`, id)

const MENU = { setting: 0, zoomIn: 1, zoomOut: 2, fitView: 3, interactive: 4 }

const menuButtons = (page) => page.$$('.vue-flow__panel [role="button"]')

async function clickMenu(page, which) {
    const btns = await menuButtons(page)
    const idx = MENU[which]
    if (btns.length <= idx) throw new Error(`選單按鈕不足: 需要 index ${idx}, 實有 ${btns.length}`)
    await btns[idx].click()
    await page.waitForTimeout(500)
}

/** 點鎖頭鈕並確認真的上鎖(抓不到或未上鎖一律拋錯, 不靜默跳過) */
async function lockCanvas(page) {
    await clickMenu(page, 'interactive')
    const locked = await getLocked(page)
    if (locked !== true) throw new Error(`點鎖頭鈕後 locked 仍為 ${locked}`)
}

const nodeEl = (page, id) => page.$(`.vue-flow__node[data-id="${id}"]`)
const nodeBox = async (page, id) => (await nodeEl(page, id)).boundingBox()

async function hoverNode(page, id) {
    const b = await nodeBox(page, id)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(500)
    return b
}

async function hoverEdge(page) {
    const e = (await page.$$('.vue-flow__edge-interaction'))[0]
    const b = await e.boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(500)
    return b
}

/** 找一塊沒有節點/連線/選單的空白畫布座標 */
async function blankPoint(page) {
    const rect = await getContainerRect(page)
    const pt = { x: Math.round(rect.left + rect.width - 30), y: Math.round(rect.top + 30) }
    const tag = await page.evaluate((p) => {
        const el = document.elementFromPoint(p.x, p.y)
        return el ? el.className.toString() : ''
    }, pt)
    if (/node|edge|panel/.test(tag)) throw new Error(`空白點取樣落在 ${tag}`)
    return pt
}

/** setup: 直接設定 opt 資料(非 act) */
const setConnField = (page, connId, key, value) => evalVm(page, `
    const c = vm.conns.find(x => x.id === arg.id)
    vm.$set(c, arg.key, arg.value)
    return true
`, { id: connId, key, value })

// ─────────────────────────── cases ───────────────────────────

/** 建構 case(避免物件字面量在單行展開, 亦統一結構) */
function mkCase(id, kebab, run) {
    return { id, kebab, run }
}

const CASES = [

    mkCase('E2E-001', 'overview', async (page) => {
        await clickMenu(page, 'fitView')
        await shot(page, 'flow-E2E-001-overview', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-002', 'node-shape', async (page) => {
        const ids = await page.$$eval('.vue-flow__node', els => els.map(e => e.getAttribute('data-id')).filter(Boolean))
        for (const id of ids) {
            await centerOnNode(page, id)
            await page.waitForTimeout(300)
            const b = await nodeBox(page, id)
            if (!b) continue
            await shot(page, `flow-E2E-002-node-shape-${id}`, { clip: clipAround(b, PAD) })
        }
    }),

    mkCase('E2E-003', 'node-hovered', async (page) => {
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        await hoverNode(page, '1')
        const af = await getAffordances(page)
        expectOk('E2E-003 齒輪出現', af.nodeGear === true, `nodeGear=${af.nodeGear}`)
        expectOk('E2E-003 resize把手 > 0', af.resizeHandles > 0, `resizeHandles=${af.resizeHandles}`)
        expectOk('E2E-003 連接點 > 0', af.connHandles > 0, `connHandles=${af.connHandles}`)
        const b = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-003-node-hovered', { clip: clipAround(b, PAD), parkMouse: false })
    }),

    mkCase('E2E-004', 'node-selected', async (page) => {
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        const el = await nodeEl(page, '1')
        await el.click()
        await page.waitForTimeout(300)
        const sel = await getSelectedNodes(page)
        expectOk('E2E-004 該節點被選取', sel.includes('1'), `selectedNodes=${JSON.stringify(sel)}`)
        expectOk('E2E-004 其餘節點未被選取', sel.length === 1, `selectedNodes=${JSON.stringify(sel)}`)
        const b = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-004-node-selected', { clip: clipAround(b, PAD) })
    }),

    mkCase('E2E-005', 'node-dragged', async (page) => {
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        const before = await getNode(page, '1')
        const b = await nodeBox(page, '1')
        const dx = 60
        const dy = 40
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
        await page.mouse.down()
        await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(400)
        const after = await getNode(page, '1')
        expectOk('E2E-005 節點座標依位移量改變',
            Math.abs((after.position.x - before.position.x) - dx) <= 1 && Math.abs((after.position.y - before.position.y) - dy) <= 1,
            `delta=(${after.position.x - before.position.x},${after.position.y - before.position.y}) 預期 (${dx},${dy})`)
        const ev = await emitted(page)
        expectOk('E2E-005 發出 update:nodes', ev.includes('update:nodes'), `events=${JSON.stringify(ev)}`)
        const b2 = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-005-node-dragged', { clip: clipAround(b2, PAD) })
    }),

    mkCase('E2E-006', 'node-resized', async (page) => {
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        const before = await getNode(page, '1')
        await hoverNode(page, '1')
        const h = await page.$('.vue-flow__resize--bottom-right')
        const hb = await h.boundingBox()
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
        await page.mouse.down()
        await page.mouse.move(hb.x + hb.width / 2 + 40, hb.y + hb.height / 2 + 30, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(400)
        const after = await getNode(page, '1')
        expectOk('E2E-006 節點尺寸變大', after.width > before.width && after.height > before.height,
            `before=${before.width}x${before.height} after=${after.width}x${after.height}`)
        //對宿主發出的是 update:nodes(node-resize-end 僅為 NodeRenderer→WFlowVue 之內部事件, 見 WFlowVue.onNodeResizeEnd)
        const ev = await emitted(page)
        expectOk('E2E-006 發出 update:nodes', ev.includes('update:nodes'), `events=${JSON.stringify(ev)}`)
        const b2 = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-006-node-resized', { clip: clipAround(b2, PAD) })
    }),

    mkCase('E2E-007', 'edge-hovered', async (page) => {
        const b = await hoverEdge(page)
        const af = await getAffordances(page)
        expectOk('E2E-007 連線齒輪出現', af.edgeGear === true, `edgeGear=${af.edgeGear}`)
        await shot(page, 'flow-E2E-007-edge-hovered', { clip: clipAround(b, 40), parkMouse: false })
    }),

    mkCase('E2E-008', 'idle-after-interaction', async (page) => {
        //先做一輪 hover 與點擊互動
        await hoverNode(page, '1')
        const el = await nodeEl(page, '1')
        await el.click()
        await page.waitForTimeout(300)
        await hoverEdge(page)
        //再解除:點空白處取消選取, 滑鼠移離, fitView 回靜止態
        const blank = await blankPoint(page)
        await page.mouse.click(blank.x, blank.y)
        await page.mouse.move(0, 0)
        await page.waitForTimeout(500)
        await clickMenu(page, 'fitView')
        await page.mouse.move(0, 0)
        await page.waitForTimeout(500)
        const af = await getAffordances(page)
        const sel = await getSelectedNodes(page)
        expectOk('E2E-008 無 hover 殘留(齒輪)', af.nodeGear === false && af.edgeGear === false, `nodeGear=${af.nodeGear} edgeGear=${af.edgeGear}`)
        expectOk('E2E-008 無 resize 把手殘留', af.resizeHandles === 0, `resizeHandles=${af.resizeHandles}`)
        expectOk('E2E-008 選取已清空', sel.length === 0, `selectedNodes=${JSON.stringify(sel)}`)
        await shot(page, 'flow-E2E-008-idle-after-interaction', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-009', 'conn-info-popup', async (page) => {
        await page.locator('[data-id="e1-2"] path').first().click({ force: true })
        await page.waitForTimeout(600)
        const st = await getConnPopupState(page, 'e1-2')
        expectOk('E2E-009 資訊 popup 開啟', st && st.infoPopupShow === true, `state=${JSON.stringify(st)}`)
        const txt = await page.evaluate(() => document.body.innerText)
        expectOk('E2E-009 popup 顯示 name', txt.includes('原始資料'), 'popup 內未見 name')
        expectOk('E2E-009 popup 顯示 description', txt.includes('未經處理的 API 回應'), 'popup 內未見 description')
        await shot(page, 'flow-E2E-009-conn-info-popup', { parkMouse: false })
    }),

    mkCase('E2E-010', 'conn-no-info-popup', async (page) => {
        //setup: 令 e1-3 不帶 name / description(宿主亦未提供 conn-popup slot)
        await setConnField(page, 'e1-3', 'name', '')
        await setConnField(page, 'e1-3', 'description', '')
        await page.waitForTimeout(400)
        const st0 = await getConnPopupState(page, 'e1-3')
        expectOk('E2E-010 hasInfoPopup 為 false', st0 && st0.hasInfoPopup === false, `state=${JSON.stringify(st0)}`)
        await page.locator('[data-id="e1-3"] path').first().click({ force: true })
        await page.waitForTimeout(600)
        const st = await getConnPopupState(page, 'e1-3')
        expectOk('E2E-010 資訊 popup 未開啟', st && st.infoPopupShow === false, `state=${JSON.stringify(st)}`)
        await shot(page, 'flow-E2E-010-conn-no-info-popup', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-011', 'node-settings-form', async (page) => {
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        const before = await getNode(page, '1')
        await hoverNode(page, '1')
        await page.locator('.vue-flow__node-settings').first().click()
        await page.waitForTimeout(600)
        const f = await getForms(page)
        expectOk('E2E-011 節點設定表單開啟', f.count === 1 && f.hasNodeForm === true, `forms=${JSON.stringify(f)}`)
        const after = await getNode(page, '1')
        expectOk('E2E-011 節點座標不變',
            after.position.x === before.position.x && after.position.y === before.position.y,
            `before=${JSON.stringify(before.position)} after=${JSON.stringify(after.position)}`)
        await shot(page, 'flow-E2E-011-node-settings-form', { parkMouse: false })
    }),

    mkCase('E2E-012', 'popup-exclusive', async (page) => {
        await hoverNode(page, '1')
        await page.locator('.vue-flow__node-settings').first().click()
        await page.waitForTimeout(600)
        const f0 = await getForms(page)
        expectOk('E2E-012 前置: 節點表單已開', f0.count === 1 && f0.hasNodeForm, `forms=${JSON.stringify(f0)}`)
        await hoverEdge(page)
        await page.locator('.vue-flow__edge-settings').first().click()
        await page.waitForTimeout(700)
        const f1 = await getForms(page)
        expectOk('E2E-012 畫面僅存一個設定表單', f1.count === 1, `forms=${JSON.stringify(f1)}`)
        expectOk('E2E-012 節點表單已關閉', f1.hasNodeForm === false, `forms=${JSON.stringify(f1)}`)
        await shot(page, 'flow-E2E-012-popup-exclusive', { parkMouse: false })
    }),

    mkCase('E2E-013', 'waypoint-mousedown-closes-popup', async (page) => {
        //setup: 給 e1-2 兩個轉折點(拖第一個, 避開恆貼在路徑中點之 label)
        await setConnField(page, 'e1-2', 'points', [[200, 60], [280, 100]])
        await page.waitForTimeout(400)
        await page.locator('[data-id="e1-2"] path').first().click({ force: true })
        await page.waitForTimeout(600)
        const st0 = await getConnPopupState(page, 'e1-2')
        expectOk('E2E-013 前置: 資訊 popup 已開', st0 && st0.infoPopupShow === true, `state=${JSON.stringify(st0)}`)
        const vp0 = await getViewport(page)
        const wp = await page.$('.vue-flow__edge-waypoint')
        const wb = await wp.boundingBox()
        await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2)
        await page.mouse.down()
        await page.waitForTimeout(500)
        await page.mouse.up()
        await page.waitForTimeout(500)
        const st1 = await getConnPopupState(page, 'e1-2')
        expectOk('E2E-013 資訊 popup 已關閉', st1 && st1.infoPopupShow === false, `state=${JSON.stringify(st1)}`)
        const vp1 = await getViewport(page)
        expectOk('E2E-013 圖台未平移', vp1.x === vp0.x && vp1.y === vp0.y, `vp0=${JSON.stringify(vp0)} vp1=${JSON.stringify(vp1)}`)
        await shot(page, 'flow-E2E-013-waypoint-mousedown-closes-popup', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-014', 'waypoint-dragged', async (page) => {
        await setConnField(page, 'e1-2', 'points', [[200, 60], [280, 100]])
        await page.waitForTimeout(400)
        const wp = await page.$('.vue-flow__edge-waypoint')
        const wb = await wp.boundingBox()
        await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2)
        await page.mouse.down()
        await page.mouse.move(wb.x + wb.width / 2 + 60, wb.y + wb.height / 2 + 30, { steps: 10 })
        await page.waitForTimeout(300)
        const dDuring = await getConnPathD(page, 'e1-2')
        await page.mouse.up()
        await page.waitForTimeout(400)
        const dAfter = await getConnPathD(page, 'e1-2')
        expectOk('E2E-014 放開瞬間路徑不跳動', dDuring === dAfter, `during=${dDuring}\n      after =${dAfter}`)
        const pts = await evalVm(page, 'return JSON.parse(JSON.stringify(vm.conns.find(c => c.id === "e1-2").points))')
        expectOk('E2E-014 轉折點座標已更新', pts[0][0] === 260 && pts[0][1] === 90, `points=${JSON.stringify(pts)}`)
        const ev = await emitted(page)
        expectOk('E2E-014 發出 conn-settings-update', ev.includes('conn-settings-update'), `events=${JSON.stringify(ev)}`)
        await page.mouse.move(0, 0)
        await shot(page, 'flow-E2E-014-waypoint-dragged', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-015', 'node-dragged-routing', async (page) => {
        //e2-8 為 smoothstep 且未帶 points; 拖曳其來源節點 '2'
        const b = await nodeBox(page, '2')
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
        await page.mouse.down()
        await page.mouse.move(b.x + b.width / 2 + 50, b.y + b.height / 2 + 30, { steps: 10 })
        await page.waitForTimeout(300)
        const dDuring = await getConnPathD(page, 'e2-8')
        await page.mouse.up()
        await page.waitForTimeout(400)
        const dAfter = await getConnPathD(page, 'e2-8')
        expectOk('E2E-015 自動路由放開瞬間不跳動', dDuring === dAfter, `during=${dDuring}\n      after =${dAfter}`)
        await page.mouse.move(0, 0)
        await shot(page, 'flow-E2E-015-node-dragged-routing', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-016', 'panned', async (page) => {
        const vp0 = await getViewport(page)
        const p = await blankPoint(page)
        const dx = -80
        const dy = 50
        await page.mouse.move(p.x, p.y)
        await page.mouse.down()
        await page.mouse.move(p.x + dx, p.y + dy, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(400)
        const vp1 = await getViewport(page)
        expectOk('E2E-016 viewport 位移量等於滑鼠位移量',
            Math.abs((vp1.x - vp0.x) - dx) <= 1 && Math.abs((vp1.y - vp0.y) - dy) <= 1,
            `delta=(${vp1.x - vp0.x},${vp1.y - vp0.y}) 預期 (${dx},${dy})`)
        await shot(page, 'flow-E2E-016-panned', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-017', 'menu-drag-no-pan', async (page) => {
        const vp0 = await getViewport(page)
        const btns = await menuButtons(page)
        const bb = await btns[MENU.setting].boundingBox()
        const p = await blankPoint(page)
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
        await page.mouse.down()
        await page.mouse.move(p.x, p.y, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(400)
        const vp1 = await getViewport(page)
        expectOk('E2E-017 圖台未平移', vp1.x === vp0.x && vp1.y === vp0.y,
            `vp0=${JSON.stringify(vp0)} vp1=${JSON.stringify(vp1)}`)
        await page.mouse.move(0, 0)
        await shot(page, 'flow-E2E-017-menu-drag-no-pan', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-018', 'zoom-in-center', async (page) => {
        const rect = await getContainerRect(page)
        const vp0 = await getViewport(page)
        const cx = rect.width / 2
        const cy = rect.height / 2
        const before = { x: (cx - vp0.x) / vp0.zoom, y: (cy - vp0.y) / vp0.zoom }
        await clickMenu(page, 'zoomIn')
        const vp1 = await getViewport(page)
        const after = { x: (cx - vp1.x) / vp1.zoom, y: (cy - vp1.y) / vp1.zoom }
        expectOk('E2E-018 zoom 變為 ×1.2', Math.abs(vp1.zoom - vp0.zoom * 1.2) < 1e-6, `zoom ${vp0.zoom} → ${vp1.zoom}`)
        expectOk('E2E-018 展示窗中心之內容座標不變',
            Math.abs(after.x - before.x) < 0.5 && Math.abs(after.y - before.y) < 0.5,
            `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`)
        await shot(page, 'flow-E2E-018-zoom-in-center', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-019', 'zoom-out-center', async (page) => {
        const rect = await getContainerRect(page)
        const vp0 = await getViewport(page)
        const cx = rect.width / 2
        const cy = rect.height / 2
        const before = { x: (cx - vp0.x) / vp0.zoom, y: (cy - vp0.y) / vp0.zoom }
        await clickMenu(page, 'zoomOut')
        const vp1 = await getViewport(page)
        const after = { x: (cx - vp1.x) / vp1.zoom, y: (cy - vp1.y) / vp1.zoom }
        expectOk('E2E-019 zoom 變為 ÷1.2', Math.abs(vp1.zoom - vp0.zoom / 1.2) < 1e-6, `zoom ${vp0.zoom} → ${vp1.zoom}`)
        expectOk('E2E-019 展示窗中心之內容座標不變',
            Math.abs(after.x - before.x) < 0.5 && Math.abs(after.y - before.y) < 0.5,
            `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`)
        await shot(page, 'flow-E2E-019-zoom-out-center', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-020', 'wheel-zoom-cursor', async (page) => {
        const rect = await getContainerRect(page)
        const vp0 = await getViewport(page)
        const px = rect.left + rect.width * 0.3
        const py = rect.top + rect.height * 0.7
        const mx = px - rect.left
        const my = py - rect.top
        const before = { x: (mx - vp0.x) / vp0.zoom, y: (my - vp0.y) / vp0.zoom }
        await page.mouse.move(px, py)
        await page.mouse.wheel(0, -120)
        await page.waitForTimeout(500)
        const vp1 = await getViewport(page)
        const after = { x: (mx - vp1.x) / vp1.zoom, y: (my - vp1.y) / vp1.zoom }
        expectOk('E2E-020 zoom 已改變', vp1.zoom !== vp0.zoom, `zoom ${vp0.zoom} → ${vp1.zoom}`)
        expectOk('E2E-020 游標處之內容座標不變',
            Math.abs(after.x - before.x) < 0.5 && Math.abs(after.y - before.y) < 0.5,
            `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`)
        await shot(page, 'flow-E2E-020-wheel-zoom-cursor', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-021', 'menu-collapsed', async (page) => {
        const n0 = (await menuButtons(page)).length
        expectOk('E2E-021 前置: 展開為 5 鈕', n0 === 5, `count=${n0}`)
        await clickMenu(page, 'setting')
        const n1 = (await menuButtons(page)).length
        expectOk('E2E-021 收合後僅 1 鈕', n1 === 1, `count=${n1}`)
        await shot(page, 'flow-E2E-021-menu-collapsed', { clip: await getCanvasClip(page) })
        await clickMenu(page, 'setting')
        const n2 = (await menuButtons(page)).length
        expectOk('E2E-021 再點展開回 5 鈕', n2 === 5, `count=${n2}`)
    }),

    mkCase('E2E-022', 'locked-overview', async (page) => {
        await clickMenu(page, 'fitView')
        await lockCanvas(page)
        expectOk('E2E-022 locked === true', (await getLocked(page)) === true, 'locked 未成立')
        await shot(page, 'flow-E2E-022-locked-overview', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-023', 'locked-node-hovered', async (page) => {
        await lockCanvas(page)
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        await hoverNode(page, '1')
        const af = await getAffordances(page)
        expectOk('E2E-023 無齒輪', af.nodeGear === false, `nodeGear=${af.nodeGear}`)
        expectOk('E2E-023 無 resize 把手', af.resizeHandles === 0, `resizeHandles=${af.resizeHandles}`)
        expectOk('E2E-023 無連接點', af.connHandles === 0, `connHandles=${af.connHandles}`)
        const b = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-023-locked-node-hovered', { clip: clipAround(b, PAD), parkMouse: false })
    }),

    mkCase('E2E-024', 'locked-edge-hovered', async (page) => {
        await lockCanvas(page)
        const b = await hoverEdge(page)
        const af = await getAffordances(page)
        expectOk('E2E-024 無連線齒輪', af.edgeGear === false, `edgeGear=${af.edgeGear}`)
        await shot(page, 'flow-E2E-024-locked-edge-hovered', { clip: clipAround(b, 40), parkMouse: false })
    }),

    mkCase('E2E-025', 'locked-node-drag-no-move', async (page) => {
        await lockCanvas(page)
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        const before = await getNode(page, '1')
        const b = await nodeBox(page, '1')
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
        await page.mouse.down()
        await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 40, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(400)
        const after = await getNode(page, '1')
        expectOk('E2E-025 節點座標不變',
            after.position.x === before.position.x && after.position.y === before.position.y,
            `before=${JSON.stringify(before.position)} after=${JSON.stringify(after.position)}`)
        await page.mouse.move(0, 0)
        const b2 = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-025-locked-node-drag-no-move', { clip: clipAround(b2, PAD) })
    }),

    mkCase('E2E-026', 'locked-node-selected', async (page) => {
        await lockCanvas(page)
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        const el = await nodeEl(page, '1')
        await el.click()
        await page.waitForTimeout(300)
        const sel = await getSelectedNodes(page)
        expectOk('E2E-026 上鎖仍可選取', sel.includes('1'), `selectedNodes=${JSON.stringify(sel)}`)
        const b = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-026-locked-node-selected', { clip: clipAround(b, PAD) })
    }),

    mkCase('E2E-027', 'conn-created', async (page) => {
        const n0 = await getConnsLen(page)
        const src = await page.$('.vue-flow__node[data-id="2"] .vue-flow__handle[data-handle-type="source"]')
        const tgt = await page.$('.vue-flow__node[data-id="9"] .vue-flow__handle[data-handle-type="target"]')
        expectOk('E2E-027 前置: 找到來源與目標連接點', !!src && !!tgt, `src=${!!src} tgt=${!!tgt}`)
        const sb = await src.boundingBox()
        const tb = await tgt.boundingBox()
        await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
        await page.mouse.down()
        await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 12 })
        await page.mouse.up()
        await page.waitForTimeout(500)
        const n1 = await getConnsLen(page)
        expectOk('E2E-027 新增一筆連線', n1 === n0 + 1, `conns ${n0} → ${n1}`)
        const added = await evalVm(page, 'const c = vm.conns[vm.conns.length - 1];return { from: c.from, to: c.to }')
        expectOk('E2E-027 新連線之 from/to 正確', added.from === '2' && added.to === '9', `added=${JSON.stringify(added)}`)
        const ev = await emitted(page)
        expectOk('E2E-027 發出 update:conns', ev.includes('update:conns'), `events=${JSON.stringify(ev)}`)
        await page.mouse.move(0, 0)
        await shot(page, 'flow-E2E-027-conn-created', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-028', 'box-selection', async (page) => {
        await clickMenu(page, 'fitView')
        //框住節點 5 / 6 / 7 → 其間之連線 e5-6 / e5-7 兩端皆入選, 依 spec 應一併呈選取態
        const bs = []
        for (const id of ['5', '6', '7']) bs.push(await nodeBox(page, id))
        const x0 = Math.min(...bs.map(b => b.x)) - 25
        const y0 = Math.min(...bs.map(b => b.y)) - 25
        const x1 = Math.max(...bs.map(b => b.x + b.width)) + 25
        const y1 = Math.max(...bs.map(b => b.y + b.height)) + 25
        await page.keyboard.down('Shift')
        await page.mouse.move(x0, y0)
        await page.mouse.down()
        await page.mouse.move(x1, y1, { steps: 12 })
        await page.waitForTimeout(400)
        //選取框仍顯示中(滑鼠未放開), 保留此態拍標準圖
        await shot(page, 'flow-E2E-028-box-selection', { clip: await getCanvasClip(page), parkMouse: false })
        await page.mouse.up()
        await page.keyboard.up('Shift')
        await page.waitForTimeout(400)
        const sel = await getSelectedNodes(page)
        expectOk('E2E-028 框內節點被選取', sel.includes('5') && sel.includes('6') && sel.includes('7'), `selectedNodes=${JSON.stringify(sel)}`)
        expectOk('E2E-028 框外節點未被選取', !sel.includes('1'), `selectedNodes=${JSON.stringify(sel)}`)
        //spec: 框內「連線」亦呈選取態(兩端節點皆入選之連線)
        const selConns = await evalVm(page, 'return vm.selectedConns.slice()')
        expectOk('E2E-028 框內連線被選取', selConns.includes('e5-6') && selConns.includes('e5-7'), `selectedConns=${JSON.stringify(selConns)}`)
        expectOk('E2E-028 框外連線未被選取', !selConns.includes('e1-2'), `selectedConns=${JSON.stringify(selConns)}`)
    }),

]

// ─────────────────────────── runner ───────────────────────────

async function run() {
    if (isBaseline && !fs.existsSync(baselineDir)) {
        fs.mkdirSync(baselineDir, { recursive: true })
    }
    console.log(isBaseline ? '產製標準圖 (spec/流程_圖台互動.md)\n' : 'E2E 圖台互動測試 (spec/流程_圖台互動.md)\n')

    for (const c of CASES) {
        if (onlyNames && !onlyNames.includes(c.id)) continue
        console.log(`  ${c.id} ${c.kebab}`)
        //per-case fresh browser: 每個 case 全新 browser/context/page, 不帶前一 case 狀態
        const browser = await chromium.launch()
        try {
            const page = await openPage(browser)
            await c.run(page)
        }
        catch (err) {
            record(false, `${c.id} 執行例外`, err.message)
        }
        finally {
            await browser.close()
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`)
    if (errors.length > 0) {
        console.log('\nFailed:')
        errors.forEach(e => console.log('  ' + e))
    }
    process.exit(failed > 0 ? 1 : 0)
}

run().catch((e) => {
    console.error(e)
    process.exit(1)
})
