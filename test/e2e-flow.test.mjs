/**
 * E2E 圖台互動測試(Playwright)—— 單檔雙模式,對應 spec/流程_圖台互動.md 之 E2E-001 ~ E2E-043。
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
 * - 初始視口: 元件預設 fitViewOnInit(首幀量測後 fit), E2E-038 專測此行為(rawInit, 不重設);
 *   其餘 case 之前置於 openPage 將視口重設為原點 {0,0,1}(setup, 非 act), 語意斷言與 baseline 皆以原點視口為基準。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import { baseUrl, captureStable, assertBaselineMatch } from './e2e-setup.mjs'
import { nodesBounds, computeFitView } from '../src/js/viewport.mjs'

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

async function openPage(browser, opts = {}) {
    const page = await browser.newPage({ viewport: { width: VW, height: VH } })
    if (opts.rawInit) {
        //初始化觀察器(E2E-038): 於任何頁面腳本前掛 rAF 記錄, 逐幀記錄 pending class / viewport transform / 可見性
        await page.addInitScript(() => {
            window.__initFrames = []
            const tick = () => {
                const root = document.querySelector('[data-flow-id]')
                const vp = document.querySelector('.vue-flow__viewport')
                if (root && vp) {
                    window.__initFrames.push({
                        pending: root.classList.contains('vue-flow--pending'),
                        transform: vp.style.transform,
                        visibility: getComputedStyle(vp).visibility,
                    })
                }
                if (window.__initFrames.length < 300) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
        })
    }
    await page.goto(baseUrl)
    await page.waitForSelector('.vue-flow__edge', { timeout: 20000 })
    await page.waitForTimeout(800)
    if (!opts.rawInit) {
        //前置(非 act): 既有 case 以原點視口為基準(元件預設初始化 fit 由 E2E-038 專測)
        await evalVm(page, 'vm.setViewport({ x: 0, y: 0, zoom: 1 }); return true')
        await page.waitForTimeout(100)
    }
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
    return { count: fs2.length, hasNodeForm: fs2.some(f => /Shape/.test(f.textContent || '')) }
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

/** 預設 nodesSettingsTrigger/connsSettingsTrigger 為 dblclick: 雙擊本體直接開設定 popup(不顯示齒輪) */
async function openNodeSettings(page, id) {
    const b = await hoverNode(page, id)
    await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(400)
    return b
}
async function openEdgeSettings(page, connId) {
    const label = page.locator(`.vue-flow__edge[data-id="${connId}"] .vue-flow__edge-label`).first()
    await label.hover()
    await page.waitForTimeout(300)
    await label.dblclick()
    await page.waitForTimeout(400)
}
/**
 * 設定表單之屬性群標題列(契約 §11): 群預設收合, 欄位在收合群內不可見, 故操作欄位前須先展開該群
 * ——這正是真實使用者之操作路徑(不是繞道), 展開一律以真實點擊標題列完成。
 */
const settingsGroupHead = (page, title) =>
    page.locator(`.vue-flow__settings-group-head:has(.vue-flow__settings-group-title:text-is("${title}"))`).first()

/**
 * 以真實滑鼠改下拉之值: 點控制項開下拉 → 點選項。
 *
 * 下拉已改用 SettingsSelect(w-component-vue 之 WTextSelect), 其清單是 **DOM 元素**而非 OS 層視窗,
 * 故選項可被真實點擊 —— 原生 <select> 時期這條路徑 CDP 點不開(headless 與 headed 皆實測不到),
 * 只能退而用鍵盤;換掉之後才得以覆蓋使用者真正走的路徑。
 */
async function selectByClick(page, labelText, optionText) {
    const ctrl = page.locator(`.vue-flow__settings-form label:has-text("${labelText}") .vue-flow__settings-select`).first()
    await ctrl.waitFor({ state: 'visible', timeout: 5000 })
    const box = await ctrl.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(500)
    //下拉清單 Teleport 至 body; 取文字完全相符且為葉節點者
    const opt = page.locator('body *').filter({ hasText: new RegExp(`^${optionText}$`) }).last()
    await opt.waitFor({ state: 'visible', timeout: 5000 })
    const ob = await opt.boundingBox()
    await page.mouse.click(ob.x + ob.width / 2, ob.y + ob.height / 2)
    await page.waitForTimeout(400)
}

/**
 * 色票面板(WColorSelect)之定位。
 *
 * 該元件之面板 Teleport 至 body, 且**無 class、無 aria-label**(第三方元件, 不便侵入加 data-*),
 * 故以「面板內的文字」語意定位: 唯一同時含 RGBA 與 Confirm 的 body 直屬節點。
 * 面板內 R/G/B/A 為前四個可見 text input(其後尚有寬度 0 的 HSVA 隱藏欄), 此處為結構定位 —— 已於
 * tmp 探查確認順序, 並由「填值後 conn 未變、按 Confirm 後才變」之斷言反向保護: 若面板結構改版,
 * 這些斷言會直接紅燈而非靜默失效。
 */
const colorPanel = (page) => page.locator('body > div').filter({ hasText: 'RGBA' }).filter({ hasText: 'Confirm' }).last()

/** 點某欄位之色塊開啟色票面板(色塊位於該 label 之右端) */
async function openColorPanel(page, labelText) {
    const lbl = page.locator(`.vue-flow__settings-form label:has-text("${labelText}")`).first()
    await lbl.waitFor({ state: 'visible', timeout: 5000 })
    const box = await lbl.boundingBox()
    await page.mouse.click(box.x + box.width - 10, box.y + box.height / 2)
    await page.waitForTimeout(700)
    if (await colorPanel(page).count() !== 1) throw new Error(`openColorPanel: 「${labelText}」之色票面板未開啟`)
}

/** 於已開啟之面板填入 R/G/B(Vue v-model → 以 insertText 一次注入, 避免逐字 re-render 漏字) */
async function fillPanelRgb(page, [r, g, b]) {
    const panel = colorPanel(page)
    const vals = [String(r), String(g), String(b)]
    for (let i = 0; i < 3; i++) {
        const inp = panel.locator('input[type="text"]').nth(i)
        await inp.click()
        await page.waitForTimeout(120)
        const cur = await inp.inputValue()
        await page.keyboard.press('End')
        for (let k = 0; k < cur.length + 2; k++) await page.keyboard.press('Backspace')
        await page.keyboard.insertText(vals[i])
        await page.waitForTimeout(150)
    }
}

/** 按面板之確認鈕(WColorSelect 僅於此時才 emit input, 開面板與填值皆不寫回) */
async function confirmColorPanel(page) {
    await colorPanel(page).getByText('Confirm', { exact: true }).last().click()
    await page.waitForTimeout(600)
}

/** 完整的真實改色路徑: 點色塊 → 填 R/G/B → 按確認 */
async function pickColor(page, labelText, rgb) {
    await openColorPanel(page, labelText)
    await fillPanelRgb(page, rgb)
    await confirmColorPanel(page)
}

/** 展開指定屬性群(已展開則不重複點) */
async function openSettingsGroup(page, title) {
    const head = settingsGroupHead(page, title)
    await head.waitFor({ state: 'visible', timeout: 5000 })
    if ((await head.getAttribute('aria-expanded')) === 'false') {
        await head.click()
        await page.waitForTimeout(300)
    }
}

/** 讀目前設定表單之群狀態: 標題順序、展開者、以及各群首個欄位是否可見 */
function settingsGroupState(page) {
    return page.evaluate(() => {
        const form = document.querySelector('.vue-flow__settings-form')
        if (!form) return null
        //收合以 visibility:hidden + height:0 實作(非 display:none, 見契約 §11), 故 offsetParent 仍非 null;
        //「使用者看得到嗎」須以 computed visibility 與實際佔位高度判定
        const seen = (el) => !!el && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().height > 0
        const gs = [...form.querySelectorAll('.vue-flow__settings-group')].map((g) => {
            const head = g.querySelector('.vue-flow__settings-group-head')
            const panel = g.querySelector('.vue-flow__settings-group-panel')
            const firstField = panel.querySelector('label')
            const caret = g.querySelector('.vue-flow__settings-group-caret')
            const heading = head.closest('[role="heading"]')
            return {
                title: g.querySelector('.vue-flow__settings-group-title').textContent.trim(),
                expanded: head.getAttribute('aria-expanded') === 'true',
                caretOpen: caret.classList.contains('vue-flow__settings-group-caret--open'),
                //真正的朝向: 取 computed transform(class 只是實作細節, 旋轉沒生效時 class 仍在)
                caretTransform: getComputedStyle(caret).transform,
                caretColor: getComputedStyle(caret).color,
                panelClosed: panel.classList.contains('vue-flow__settings-group-panel--closed'),
                fieldVisible: seen(firstField),
                //APG accordion 結構: 標題按鈕須包在 role="heading" 且帶 aria-level
                headingLevel: heading ? heading.getAttribute('aria-level') : null,
            }
        })
        const del = form.querySelector('.vue-flow__delete-area')
        const fcs = getComputedStyle(form)
        const head0 = form.querySelector('.vue-flow__settings-group-head')
        const label0 = form.querySelector('.vue-flow__settings-group-panel:not(.vue-flow__settings-group-panel--closed) label')
        //popup 外框(form 往上第一個有背景色者): 用來驗群標題列是否 full-bleed 貼齊 popup 左右邊緣
        let pop = form.parentElement
        while (pop && pop !== document.body && getComputedStyle(pop).backgroundColor === 'rgba(0, 0, 0, 0)') pop = pop.parentElement
        const P = pop ? pop.getBoundingClientRect() : null
        const H = head0 ? head0.getBoundingClientRect() : null
        const titleEl = form.querySelector('.vue-flow__settings-group-title')
        return {
            groups: gs,
            formWidth: form.getBoundingClientRect().width,
            formHeight: form.getBoundingClientRect().height,
            maxHeight: fcs.maxHeight,
            overflowY: fcs.overflowY,
            scrollable: form.scrollHeight > form.clientHeight + 1,
            //群標題列須明顯高於欄位列, 且有底色 —— 只靠字重/字級分不出分區
            headHeight: H ? H.height : null,
            headBg: head0 ? getComputedStyle(head0).backgroundColor : null,
            labelHeight: label0 ? label0.getBoundingClientRect().height : null,
            //full-bleed: 每一個標題底色都須貼齊 popup 左右邊緣(只量第一個會漏掉其餘群)
            headInsets: P ? [...form.querySelectorAll('.vue-flow__settings-group-head')].map((h) => {
                const r = h.getBoundingClientRect()
                return [+(r.left - P.left).toFixed(1), +(P.right - r.right).toFixed(1)]
            }) : [],
            headRadius: head0 ? getComputedStyle(head0).borderTopLeftRadius : null,
            headMinHeight: head0 ? getComputedStyle(head0).minHeight : null,
            //標題文字與欄位標籤須落在同一條垂直線
            titleLeft: titleEl ? +titleEl.getBoundingClientRect().left.toFixed(1) : null,
            labelLeft: label0 ? +label0.getBoundingClientRect().left.toFixed(1) : null,
            //字級單一來源: label 與控制項須繼承表單 root, 不得各自硬寫
            rootFontSize: fcs.fontSize,
            labelFontSize: label0 ? getComputedStyle(label0).fontSize : null,
            controlFontSize: (() => {
                const c = form.querySelector('.vue-flow__settings-group-panel:not(.vue-flow__settings-group-panel--closed) input, .vue-flow__settings-group-panel:not(.vue-flow__settings-group-panel--closed) select')
                return c ? getComputedStyle(c).fontSize : null
            })(),
            //捲動容器不得產生水平捲動; 內容區寬與右對齊控制項之右緣亦不得因捲動條而位移
            overflowX: fcs.overflowX,
            hScroll: form.scrollWidth > form.clientWidth,
            clientWidth: form.clientWidth,
            controlRightInset: (() => {
                const cs = form.querySelectorAll('.vue-flow__settings-group-panel:not(.vue-flow__settings-group-panel--closed) .vue-flow__settings-text, .vue-flow__settings-group-panel:not(.vue-flow__settings-group-panel--closed) .vue-flow__settings-select, .vue-flow__settings-group-panel:not(.vue-flow__settings-group-panel--closed) input[type="number"]')
                if (!cs.length || !P) return null
                return +(P.right - cs[cs.length - 1].getBoundingClientRect().right).toFixed(1)
            })(),
            deleteInGroup: !!(del && del.closest('.vue-flow__settings-group')),
            deleteIsLast: !!del && form.lastElementChild === del,
            //同一表單內的分隔語彙須一致: 刪除區之分隔線亦須 full-bleed(與群標題底色同一條邊界)
            deleteInset: (P && del) ? (() => {
                const r = del.getBoundingClientRect()
                return [+(r.left - P.left).toFixed(1), +(P.right - r.right).toFixed(1)]
            })() : null,
            //刪除鈕右緣須與輸入控制項右緣落在同一條線(full-bleed 後以同值 padding 推回基準線之目的)
            deleteBtnRightInset: (() => {
                const btn = form.querySelector('.vue-flow__delete-btn')
                return (P && btn) ? +(P.right - btn.getBoundingClientRect().right).toFixed(1) : null
            })(),
            //縱向邊界間距: 群↔群、末群↔刪除線 一律 0(間距只屬於展開內容自身之下緣, 收合即歸零)。
            //任一邊界不為 0 即表示「群之間貼齊、某處卻浮開一段」的兩套規則。
            boundaryGaps: (() => {
                const gs2 = [...form.querySelectorAll('.vue-flow__settings-group')]
                const out = []
                for (let i = 0; i < gs2.length; i++) {
                    const next = gs2[i + 1] || del
                    if (!next) break
                    out.push(+(next.getBoundingClientRect().top - gs2[i].getBoundingClientRect().bottom).toFixed(1))
                }
                return out
            })(),
        }
    })
}

/** 以宿主 opt 切換齒輪顯示方式(setup 階段允許程式化設定 opt; hover 專屬之 case 用) */
async function setSettingsTrigger(page, mode) {
    await evalVm(page, `vm.$set(vm.opt, 'nodesSettingsTrigger', arg); vm.$set(vm.opt, 'connsSettingsTrigger', arg)`, mode)
    await page.waitForTimeout(200)
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
function mkCase(id, kebab, run, opts) {
    return { id, kebab, run, opts: opts || {} }
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
        //spec: 預設 dblclick 模式, hover 不出齒輪(E2E-037 驗各模式)
        expectOk('E2E-003 齒輪不因 hover 出現', af.nodeGear === false, `nodeGear=${af.nodeGear}`)
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
        //spec: 縮放為元素專屬操作, 該節點成為唯一選取(active)
        const sel6 = await getSelectedNodes(page)
        expectOk('E2E-006 縮放後該節點為唯一選取', sel6.length === 1 && sel6[0] === '1', `selectedNodes=${JSON.stringify(sel6)}`)
        const b2 = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-006-node-resized', { clip: clipAround(b2, PAD) })
    }),

    mkCase('E2E-007', 'edge-hovered', async (page) => {
        const b = await hoverEdge(page)
        const af = await getAffordances(page)
        expectOk('E2E-007 連線齒輪不因 hover 出現', af.edgeGear === false, `edgeGear=${af.edgeGear}`)
        const hoveredCls = await page.evaluate(() => !!document.querySelector('.vue-flow__edge--hovered'))
        expectOk('E2E-007 連線呈 hover 態', hoveredCls === true, `hovered=${hoveredCls}`)
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
        await openNodeSettings(page, '1')
        await page.waitForTimeout(400)
        const f = await getForms(page)
        expectOk('E2E-011 節點設定表單開啟', f.count === 1 && f.hasNodeForm === true, `forms=${JSON.stringify(f)}`)
        const after = await getNode(page, '1')
        expectOk('E2E-011 節點座標不變',
            after.position.x === before.position.x && after.position.y === before.position.y,
            `before=${JSON.stringify(before.position)} after=${JSON.stringify(after.position)}`)
        //spec: 點齒輪=元素專屬操作, 該節點成為唯一選取(active)
        const sel11 = await getSelectedNodes(page)
        expectOk('E2E-011 點齒輪後該節點為唯一選取', sel11.length === 1 && sel11[0] === '1', `selectedNodes=${JSON.stringify(sel11)}`)
        await shot(page, 'flow-E2E-011-node-settings-form', { parkMouse: false })
    }),

    mkCase('E2E-012', 'popup-exclusive', async (page) => {
        await openNodeSettings(page, '1')
        await page.waitForTimeout(400)
        const f0 = await getForms(page)
        expectOk('E2E-012 前置: 節點表單已開', f0.count === 1 && f0.hasNodeForm, `forms=${JSON.stringify(f0)}`)
        await openEdgeSettings(page, 'e1-2')
        await page.waitForTimeout(500)
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
        const src = await page.$('.vue-flow__node[data-id="2"] .vue-flow__handle[data-handle-position="bottom"]')
        const tgt = await page.$('.vue-flow__node[data-id="9"] .vue-flow__handle[data-handle-position="top"]')
        expectOk('E2E-027 前置: 找到出發與落點連接點', !!src && !!tgt, `src=${!!src} tgt=${!!tgt}`)
        const sb = await src.boundingBox()
        const tb = await tgt.boundingBox()
        await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
        await page.mouse.down()
        await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 12 })
        await page.mouse.up()
        await page.waitForTimeout(500)
        const n1 = await getConnsLen(page)
        expectOk('E2E-027 新增一筆連線', n1 === n0 + 1, `conns ${n0} → ${n1}`)
        //spec: 新 conn = { id, from: 出發節點, to: 落點節點, fromPosition: 出發邊, toPosition: 落點邊 }(邊持有自己兩端之方位)
        const added = await evalVm(page, 'return JSON.parse(JSON.stringify(vm.conns[vm.conns.length - 1]))')
        expectOk('E2E-027 新連線之 from/to 正確', added.from === '2' && added.to === '9', `added=${JSON.stringify(added)}`)
        expectOk('E2E-027 新連線持有兩端方位(出發 bottom / 落點 top)', added.fromPosition === 'bottom' && added.toPosition === 'top', `added=${JSON.stringify(added)}`)
        expectOk('E2E-027 新連線 to 端自動實心箭頭', added.markerTo === 'arrowclosed', `added=${JSON.stringify(added)}`)
        const mk = await page.evaluate((id) => {
            const p = document.querySelector(`.vue-flow__edge[data-id="${id}"] path[marker-end]`)
            return p ? p.getAttribute('marker-end') : null
        }, added.id)
        expectOk('E2E-027 路徑帶 marker-end', !!mk && mk.startsWith('url(#'), `marker-end=${mk}`)
        const ev = await emitted(page)
        expectOk('E2E-027 發出 update:conns', ev.includes('update:conns'), `events=${JSON.stringify(ev)}`)
        await page.mouse.move(0, 0)
        await shot(page, 'flow-E2E-027-conn-created', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-028', 'box-selection', async (page) => {
        await clickMenu(page, 'fitView')
        //框住節點 5 / 6 / 7; 連線不參與框選複選(WFlowVue.vue:1259-1261), 故其間之 e5-6 / e5-7 不應被選取
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
        //spec: 連線為節點錨點/轉折點推得之衍生物, 不視為可被複選之項目, 故框選一律不選取連線
        const selConns = await evalVm(page, 'return vm.selectedConns.slice()')
        expectOk('E2E-028 框選不選取任何連線', selConns.length === 0, `selectedConns=${JSON.stringify(selConns)}`)
    }),

    //E2E-029/030 共用前置(setup 階段, 未走 UI): 注入宿主環境 CSS(user-select:text)與 dragstart/選取偵測器。
    //why: 症狀來自宿主端把節點文字設為可選; 本 demo 無此 CSS, 以 addStyleTag 重現宿主環境屬環境準備非 act。
    mkCase('E2E-029', 'textdrag-preselected', async (page) => {
        await page.addStyleTag({ content: '.vue-flow__node, .vue-flow__node * { user-select: text !important; -webkit-user-select: text !important; }' })
        await page.evaluate(() => {
            window.__dragstart = 0
            document.addEventListener('dragstart', () => {
                window.__dragstart++
            }, true)
        })
        //setup(未走 UI): 以 Range 預先選取節點 1 之 label 文字, 模擬「先前互動殘留之選取」——
        //修正後拖曳不再形成選取(E2E-030), 故此前置無法以真 UI 產生, 只能程式化建立最壞情境
        await page.evaluate(() => {
            const el = document.querySelector('.vue-flow__node[data-id="1"] .vue-flow__node-label')
            const r = document.createRange()
            r.selectNodeContents(el)
            const sel = window.getSelection()
            sel.removeAllRanges()
            sel.addRange(r)
        })
        const before = await getNode(page, '1')
        const lb = await (await page.$('.vue-flow__node[data-id="1"] .vue-flow__node-label')).boundingBox()
        //act(真滑鼠): 自選取文字中心按下並拖曳
        await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2)
        await page.mouse.down()
        await page.mouse.move(lb.x + lb.width / 2 + 80, lb.y + lb.height / 2 + 60, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(400)
        const after = await getNode(page, '1')
        //spec: 節點照常移動至目標位置(修正前僅移 8px 即凍結)
        expectOk('E2E-029 節點照常移動(位移=拖曳量)',
            after.position.x === before.position.x + 80 && after.position.y === before.position.y + 60,
            `before=${JSON.stringify(before.position)} after=${JSON.stringify(after.position)}`)
        //spec: 原生文字層 drag 不得接管
        const ds = await page.evaluate(() => window.__dragstart)
        expectOk('E2E-029 原生 dragstart 未觸發', ds === 0, `dragstart=${ds}`)
        await page.mouse.move(0, 0)
        const b2 = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-029-textdrag-preselected', { clip: clipAround(b2, PAD) })
    }),

    mkCase('E2E-030', 'textdrag-no-selection-forms', async (page) => {
        await page.addStyleTag({ content: '.vue-flow__node, .vue-flow__node * { user-select: text !important; -webkit-user-select: text !important; }' })
        const before = await getNode(page, '1')
        const lb = await (await page.$('.vue-flow__node[data-id="1"] .vue-flow__node-label')).boundingBox()
        //act(真滑鼠): 無既有選取, 自文字中心按下並拖曳
        await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2)
        await page.mouse.down()
        await page.mouse.move(lb.x + lb.width / 2 + 80, lb.y + lb.height / 2 + 60, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(400)
        const after = await getNode(page, '1')
        //spec: 節點照常移動
        expectOk('E2E-030 節點照常移動(位移=拖曳量)',
            after.position.x === before.position.x + 80 && after.position.y === before.position.y + 60,
            `before=${JSON.stringify(before.position)} after=${JSON.stringify(after.position)}`)
        //spec: 拖曳過程不形成文字選取(殘留選取=下一次拖曳觸發 E2E-029 病徵之來源)
        const selText = await page.evaluate(() => String(window.getSelection()))
        expectOk('E2E-030 拖曳不形成文字選取', selText === '', `selection="${selText.slice(0, 30)}"`)
        await page.mouse.move(0, 0)
        const b2 = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-030-textdrag-no-selection-forms', { clip: clipAround(b2, PAD) })
    }),

    mkCase('E2E-031', 'from-anchor-right', async (page) => {
        //前置確認: demo 連線 e1-2 未設方位(取 defConn 之 bottom)
        const pre = await evalVm(page, `const c = vm.conns.find(c => c.id === 'e1-2'); return { has: !!c, fromPosition: c && c.fromPosition }`)
        expectOk('E2E-031 前置: e1-2 存在且未設 fromPosition', pre.has && pre.fromPosition === undefined, `pre=${JSON.stringify(pre)}`)
        const dBefore = await getConnPathD(page, 'e1-2')
        const handleStyleBefore = await page.evaluate(() => document.querySelector('.vue-flow__node[data-id="1"] .vue-flow__handle[data-handle-position="bottom"]').getAttribute('style'))

        //act(真 UI): 雙擊連線 e1-2 之 label 直接開設定 popup → 展開 Path 群 → 於 From Anchor 下拉選 Right
        await openEdgeSettings(page, 'e1-2')
        await page.waitForTimeout(400)
        await openSettingsGroup(page, 'Path')
        await selectByClick(page, 'From Anchor', 'Right')
        await page.waitForTimeout(300)
        //改完值 popup 須仍開著(表單內控制項不得觸發 popup 關閉)
        expectOk('E2E-031 改下拉值後設定 popup 仍開著', (await getForms(page)).count === 1, `forms=${JSON.stringify(await getForms(page))}`)

        //spec: conn.fromPosition === 'right'
        const post = await evalVm(page, `const c = vm.conns.find(c => c.id === 'e1-2'); return c.fromPosition`)
        expectOk('E2E-031 conn.fromPosition 為 right', post === 'right', `fromPosition=${post}`)
        //spec: 該邊路徑 d 改變(出發端改自右側射出)
        const dAfter = await getConnPathD(page, 'e1-2')
        expectOk('E2E-031 該邊路徑改道', !!dBefore && !!dAfter && dBefore !== dAfter, `d 未改變`)
        //spec: 節點把手不動——四把手恆在, bottom 把手 inline style 不變
        const handles = await page.evaluate(() => [...document.querySelectorAll('.vue-flow__node[data-id="1"] .vue-flow__handle')].map(h => h.dataset.handlePosition).sort())
        expectOk('E2E-031 from 節點仍為四把手', JSON.stringify(handles) === JSON.stringify(['bottom', 'left', 'right', 'top']), `handles=${JSON.stringify(handles)}`)
        const handleStyleAfter = await page.evaluate(() => document.querySelector('.vue-flow__node[data-id="1"] .vue-flow__handle[data-handle-position="bottom"]').getAttribute('style'))
        expectOk('E2E-031 bottom 把手不搬移', handleStyleBefore === handleStyleAfter, `before=${handleStyleBefore} after=${handleStyleAfter}`)
        expectOk('E2E-031 發出 conn-settings-update', (await emitted(page)).includes('conn-settings-update'), 'no conn-settings-update')

        //關閉popup後拍節點與其出邊之區域
        await page.mouse.move(5, 5)
        await page.mouse.down()
        await page.mouse.up()
        await page.waitForTimeout(400)
        await page.mouse.move(0, 0)
        const b = await nodeBox(page, '1')
        await shot(page, 'flow-E2E-031-from-anchor-right', { clip: clipAround(b, PAD * 2) })
    }),

    mkCase('E2E-032', 'connect-feedback', async (page) => {
        //單一 case 之承接式 journey(拖線中各 hover 階段承接同一次按住不放之真實手勢, 無法乾淨 seed 中間點):
        //起手(節點2 bottom)→ hover 已有同向邊之節點8(duplicate)→ hover 自己節點(self)→ hover 合法節點9 → 於不可連處放開
        const n0 = await getConnsLen(page)
        const pre = await evalVm(page, `return vm.conns.some(c => c.from === '2' && c.to === '8')`)
        expectOk('E2E-032 前置: 已存在 2→8', pre === true, `pre=${pre}`)
        const q = (sel) => page.evaluate((s) => {
            const el = document.querySelector(s)
            if (!el) return null
            const cs = getComputedStyle(el)
            return {
                status: el.getAttribute('data-connect-status'),
                role: el.getAttribute('data-connect-role'),
                cursor: cs.cursor,
                opacity: cs.opacity,
            }
        }, sel)
        const lineClass = () => page.evaluate(() => {
            const p = document.querySelector('.vue-flow__connection-path')
            return p ? p.getAttribute('class') : null
        })
        const H = (id, side) => `.vue-flow__node[data-id="${id}"] .vue-flow__handle[data-handle-position="${side}"]`
        const box = async (sel) => (await page.$(sel)).boundingBox()

        //act(真滑鼠): 自節點2之 bottom 把手按住拉出
        const sb = await box(H('2', 'bottom'))
        await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
        await page.mouse.down()
        await page.mouse.move(sb.x + sb.width / 2 + 30, sb.y + sb.height / 2 + 30, { steps: 4 })
        await page.waitForTimeout(200)

        //spec: 出發把手標記 origin; 出發節點之其他三把手(自我連線)一律淡化 not-allowed, 不需 hover 判定
        const o = await q(H('2', 'bottom'))
        expectOk('E2E-032 出發把手標記 origin', !!o && o.role === 'origin', `o=${JSON.stringify(o)}`)
        for (const side of ['top', 'left', 'right']) {
            const dim = await q(H('2', side))
            expectOk(`E2E-032 出發節點 ${side} 把手淡化且 not-allowed`, !!dim && Number(dim.opacity) < 0.5 && dim.cursor === 'not-allowed', `dim=${JSON.stringify(dim)}`)
        }
        //spec: 他節點把手未 hover 時不淡化(四把手皆可為落點)
        const other = await q(H('9', 'top'))
        expectOk('E2E-032 他節點把手未 hover 不淡化', !!other && Number(other.opacity) === 1, `other=${JSON.stringify(other)}`)

        //spec: hover 已有同向邊之節點8把手 → invalid(duplicate; 紅 ring + not-allowed), 預覽線轉 danger
        const t8 = await box(H('8', 'top'))
        await page.mouse.move(t8.x + t8.width / 2, t8.y + t8.height / 2, { steps: 8 })
        await page.waitForTimeout(200)
        const inv = await q(H('8', 'top'))
        expectOk('E2E-032 hover 已有同向邊之節點 → invalid(duplicate)', !!inv && inv.status === 'invalid', `inv=${JSON.stringify(inv)}`)
        expectOk('E2E-032 invalid 落點游標 not-allowed', !!inv && inv.cursor === 'not-allowed', `cursor=${inv && inv.cursor}`)
        expectOk('E2E-032 預覽線標 invalid', String(await lineClass()).includes('vue-flow__connection-path--invalid'), `class=${await lineClass()}`)
        const b8 = await nodeBox(page, '8')
        await shot(page, 'flow-E2E-032-connect-feedback-invalid', { clip: clipAround(b8, PAD), parkMouse: false })

        //spec: 自己節點之把手亦為不可連(self), hover → invalid
        const t2 = await box(H('2', 'top'))
        await page.mouse.move(t2.x + t2.width / 2, t2.y + t2.height / 2, { steps: 8 })
        await page.waitForTimeout(200)
        const self = await q(H('2', 'top'))
        expectOk('E2E-032 hover 自己節點把手 → invalid(self)', !!self && self.status === 'invalid', `self=${JSON.stringify(self)}`)

        //spec: hover 合法他節點把手 → valid(主題藍 ring + crosshair), 預覽線轉 valid
        const t9 = await box(H('9', 'top'))
        await page.mouse.move(t9.x + t9.width / 2, t9.y + t9.height / 2, { steps: 8 })
        await page.waitForTimeout(200)
        const val = await q(H('9', 'top'))
        expectOk('E2E-032 hover 合法落點 → valid', !!val && val.status === 'valid', `val=${JSON.stringify(val)}`)
        expectOk('E2E-032 valid 落點游標 crosshair', !!val && val.cursor === 'crosshair', `cursor=${val && val.cursor}`)
        expectOk('E2E-032 預覽線標 valid', String(await lineClass()).includes('vue-flow__connection-path--valid'), `class=${await lineClass()}`)
        const b9 = await nodeBox(page, '9')
        await shot(page, 'flow-E2E-032-connect-feedback-valid', { clip: clipAround(b9, PAD), parkMouse: false })

        //spec: 於不可連落點(自己節點)放開 → 不建線; 手勢暫態(標記/根class)全清
        await page.mouse.move(t2.x + t2.width / 2, t2.y + t2.height / 2, { steps: 6 })
        await page.mouse.up()
        await page.waitForTimeout(400)
        const n1 = await getConnsLen(page)
        expectOk('E2E-032 於不可連落點放開不建線', n1 === n0, `conns ${n0} → ${n1}`)
        const marks = await page.evaluate(() => document.querySelectorAll('[data-connect-role], [data-connect-status], [data-connect-origin-node]').length)
        expectOk('E2E-032 放開後暫態標記全清', marks === 0, `marks=${marks}`)
        const rootCls = await page.evaluate(() => document.querySelector('[data-flow-id]').classList.contains('vue-flow--connecting'))
        expectOk('E2E-032 放開後根 connecting class 移除', rootCls === false, `has=${rootCls}`)
    }),

    mkCase('E2E-033', 'multiselect-mode', async (page) => {
        //宿主回報場景: 點a開popup → 按住Shift點b各部位反應不一致 → 裁定為統一複選模式
        await setSettingsTrigger(page, 'hover') //本 case 驗 hover 出現之齒輪於複選模式被隱藏
        await clickMenu(page, 'fitView') //節點5/6須同時在視窗內(節點6原始座標在視窗外, elementFromPoint會回null)
        await page.waitForTimeout(400)
        const getNodePopupState = (id) => evalVm(page, `
            const ws = (vm.$refs.nodeRenderer && vm.$refs.nodeRenderer.$refs.wrappers) || []
            const w = ws.find(c => c.node && c.node.id === arg)
            if (!w) return null
            return { infoPopupShow: w.infoPopupShow, settingsPopupShow: w.settingsPopupShow }
        `, id)
        const vis = (sel) => page.evaluate((s) => {
            const el = document.querySelector(s)
            if (!el) return null
            const cs = getComputedStyle(el)
            return { visibility: cs.visibility, opacity: cs.opacity, pointerEvents: cs.pointerEvents }
        }, sel)

        //act 1: 點節點5本體 → 單選 + 資訊popup開啟
        const b5 = await nodeBox(page, '5')
        await page.mouse.click(b5.x + b5.width / 2, b5.y + b5.height / 2)
        await page.waitForTimeout(500)
        const st0 = await getNodePopupState('5')
        expectOk('E2E-033 前置: 點節點5開啟資訊popup', !!st0 && st0.infoPopupShow === true, `st=${JSON.stringify(st0)}`)
        const sel0 = await getSelectedNodes(page)
        expectOk('E2E-033 前置: 節點5為單選', sel0.length === 1 && sel0[0] === '5', `sel=${JSON.stringify(sel0)}`)

        //act 2: 按住Shift → 進入複選模式
        await page.keyboard.down('Shift')
        await page.waitForTimeout(300)
        //spec: 已開之popup於進入模式時關閉
        const st1 = await getNodePopupState('5')
        expectOk('E2E-033 按住Shift: 已開popup關閉', !!st1 && st1.infoPopupShow === false, `st=${JSON.stringify(st1)}`)
        //spec: 全部節點統一隱藏——齒輪/四角縮放/連出入把手(滑鼠仍hover節點5, 該三者DOM存在但computed hidden)
        const vGear = await vis('.vue-flow__node[data-id="5"] .vue-flow__node-settings-anchor')
        expectOk('E2E-033 設定齒輪隱藏', !!vGear && vGear.visibility === 'hidden' && vGear.pointerEvents === 'none', `v=${JSON.stringify(vGear)}`)
        const vResize = await vis('.vue-flow__node[data-id="5"] .vue-flow__resize')
        expectOk('E2E-033 四角縮放把手隱藏', !!vResize && vResize.visibility === 'hidden', `v=${JSON.stringify(vResize)}`)
        const vHandle = await vis('.vue-flow__node[data-id="6"] .vue-flow__handle')
        expectOk('E2E-033 連出入把手隱藏(全部節點)', !!vHandle && vHandle.visibility === 'hidden' && vHandle.pointerEvents === 'none', `v=${JSON.stringify(vHandle)}`)
        //spec: 原把手位置之真實hit-test落到節點, 不落在把手(pointer-events:none)
        const hb = await (await page.$('.vue-flow__node[data-id="5"] .vue-flow__handle')).boundingBox()
        const hit = await page.evaluate(({ x, y }) => {
            const el = document.elementFromPoint(x, y)
            return { onHandle: !!(el && el.closest('.vue-flow__handle')), onNode: !!(el && el.closest('.vue-flow__node')) }
        }, { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 })
        expectOk('E2E-033 把手原位置hit-test不落在把手', hit.onHandle === false, `hit=${JSON.stringify(hit)}`)

        //act 3: Shift+點節點6本體 → toggle加入, 節點5之選取保留(宿主目標場景), 且不開popup
        const b6 = await nodeBox(page, '6')
        await page.mouse.click(b6.x + b6.width / 2, b6.y + b6.height / 2)
        await page.waitForTimeout(400)
        const sel1 = await getSelectedNodes(page)
        expectOk('E2E-033 Shift+點6: 5保留且6加入', sel1.includes('5') && sel1.includes('6'), `sel=${JSON.stringify(sel1)}`)
        const st6 = await getNodePopupState('6')
        expectOk('E2E-033 模式中點擊不開popup', !!st6 && st6.infoPopupShow === false && st6.settingsPopupShow === false, `st=${JSON.stringify(st6)}`)
        await shot(page, 'flow-E2E-033-multiselect-mode', { clip: await getCanvasClip(page), parkMouse: false })

        //act 4: 放開Shift → affordance恢復(hover節點5, 齒輪與把手重現)
        await page.keyboard.up('Shift')
        await page.mouse.move(b5.x + b5.width / 2, b5.y + b5.height / 2)
        await page.waitForTimeout(500)
        const vGear2 = await vis('.vue-flow__node[data-id="5"] .vue-flow__node-settings-anchor')
        expectOk('E2E-033 放開後齒輪恢復', !!vGear2 && vGear2.visibility === 'visible', `v=${JSON.stringify(vGear2)}`)
        const vHandle2 = await vis('.vue-flow__node[data-id="5"] .vue-flow__handle')
        expectOk('E2E-033 放開後把手恢復', !!vHandle2 && vHandle2.visibility === 'visible', `v=${JSON.stringify(vHandle2)}`)
    }),

    mkCase('E2E-034', 'any-side-origin', async (page) => {
        //承接式 journey: 自節點9之 left 把手按住 → hover 自己 top(self) → hover 節點2之 right(合法) → 放開建線 9→2
        //真實 user path: ①移入左側連接點看到 crosshair ②按住拖出 ③沿途看游標三態 ④於他節點右側連接點放開 ⑤看到新連線
        const n0 = await getConnsLen(page)
        const q = (sel) => page.evaluate((s) => {
            const el = document.querySelector(s)
            if (!el) return null
            const cs = getComputedStyle(el)
            return { status: el.getAttribute('data-connect-status'), role: el.getAttribute('data-connect-role'), cursor: cs.cursor, opacity: cs.opacity }
        }, sel)
        const H = (id, side) => `.vue-flow__node[data-id="${id}"] .vue-flow__handle[data-handle-position="${side}"]`
        const box = async (sel) => (await page.$(sel)).boundingBox()

        //spec: 靜止時任一邊把手游標 crosshair(四把手皆可出發)
        const lb = await box(H('9', 'left'))
        await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2)
        await page.waitForTimeout(150)
        const idle = await q(H('9', 'left'))
        expectOk('E2E-034 左側把手靜止游標 crosshair', !!idle && idle.cursor === 'crosshair', `cursor=${idle && idle.cursor}`)

        //act: 自左側把手按住拉出
        await page.mouse.down()
        await page.mouse.move(lb.x + lb.width / 2 - 30, lb.y + lb.height / 2 - 30, { steps: 4 })
        await page.waitForTimeout(200)
        const originNode = await page.evaluate(() => {
            const n = document.querySelector('.vue-flow__node[data-connect-origin-node]')
            return n ? n.getAttribute('data-id') : null
        })
        expectOk('E2E-034 出發節點標記 origin-node', originNode === '9', `originNode=${originNode}`)
        const o = await q(H('9', 'left'))
        expectOk('E2E-034 出發把手標記 origin', !!o && o.role === 'origin', `o=${JSON.stringify(o)}`)
        for (const side of ['top', 'right', 'bottom']) {
            const dim = await q(H('9', side))
            expectOk(`E2E-034 自己節點 ${side} 把手淡化且 not-allowed`, !!dim && Number(dim.opacity) < 0.5 && dim.cursor === 'not-allowed', `dim=${JSON.stringify(dim)}`)
        }

        //spec: hover 自己節點 top → invalid(self)
        const t9 = await box(H('9', 'top'))
        await page.mouse.move(t9.x + t9.width / 2, t9.y + t9.height / 2, { steps: 8 })
        await page.waitForTimeout(200)
        const self = await q(H('9', 'top'))
        expectOk('E2E-034 hover 自己 top → invalid', !!self && self.status === 'invalid' && self.cursor === 'not-allowed', `self=${JSON.stringify(self)}`)
        const b9 = await nodeBox(page, '9')
        await shot(page, 'flow-E2E-034-any-side-origin-invalid', { clip: clipAround(b9, PAD), parkMouse: false })

        //spec: hover 他節點 right → valid + crosshair
        const r2 = await box(H('2', 'right'))
        await page.mouse.move(r2.x + r2.width / 2, r2.y + r2.height / 2, { steps: 8 })
        await page.waitForTimeout(200)
        const val = await q(H('2', 'right'))
        expectOk('E2E-034 hover 他節點 right → valid + crosshair', !!val && val.status === 'valid' && val.cursor === 'crosshair', `val=${JSON.stringify(val)}`)
        const b2 = await nodeBox(page, '2')
        await shot(page, 'flow-E2E-034-any-side-origin-valid', { clip: clipAround(b2, PAD), parkMouse: false })

        //spec: 放開 → 建立 9→2, fromPosition=left / toPosition=right, 發 update:conns
        await page.mouse.up()
        await page.waitForTimeout(400)
        const n1 = await getConnsLen(page)
        expectOk('E2E-034 放開建立連線', n1 === n0 + 1, `conns ${n0} → ${n1}`)
        const last = await evalVm(page, 'return JSON.parse(JSON.stringify(vm.conns[vm.conns.length - 1]))')
        expectOk('E2E-034 新連線 from=出發節點 to=落點節點', !!last && last.from === '9' && last.to === '2', `last=${JSON.stringify(last)}`)
        expectOk('E2E-034 新連線方位為兩把手所在邊', !!last && last.fromPosition === 'left' && last.toPosition === 'right', `last=${JSON.stringify(last)}`)
        expectOk('E2E-034 發出 update:conns', (await emitted(page)).includes('update:conns'), 'no update:conns')
        const after = await page.evaluate(() => ({
            originNode: !!document.querySelector('[data-connect-origin-node]'),
            marks: document.querySelectorAll('[data-connect-role], [data-connect-status]').length,
        }))
        expectOk('E2E-034 放開後暫態標記全清', after.originNode === false && after.marks === 0, `after=${JSON.stringify(after)}`)
    }),

    mkCase('E2E-035', 'gesture-popup', async (page) => {
        //真實 user path: ①點節點1看到資訊 popup ②自節點2連出點按住拉線 → popup 該關 ③放開 ④再點節點1開 popup ⑤按住節點2四角縮放 → popup 該關
        //⑥放開 ⑦拖節點1經過節點2 → 節點2不得亮起齒輪/四角/陰影 ⑧放開後 hover 節點2恢復
        await setSettingsTrigger(page, 'hover') //本 case 驗手勢中非擁有者之 hover 齒輪抑制
        const popupOpen = (id) => evalVm(page, `
            const ws = vm.$refs.nodeRenderer.$refs.wrappers
            const w = ws.find(c => c.node.id === arg)
            return w ? w.infoPopupShow : null
        `, id)
        const b1 = await nodeBox(page, '1')
        await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2)
        await page.waitForTimeout(400)
        expectOk('E2E-035 前置: 節點1 資訊 popup 已開', (await popupOpen('1')) === true, `open=${await popupOpen('1')}`)

        const src2 = await (await page.$('.vue-flow__node[data-id="2"] .vue-flow__handle[data-handle-position="bottom"]')).boundingBox()
        await page.mouse.move(src2.x + src2.width / 2, src2.y + src2.height / 2)
        await page.mouse.down()
        await page.mouse.move(src2.x + 40, src2.y + 40, { steps: 4 })
        await page.waitForTimeout(200)
        expectOk('E2E-035 自 B 把手拉線 → A popup 關閉', (await popupOpen('1')) === false, `open=${await popupOpen('1')}`)
        await page.mouse.up()
        await page.waitForTimeout(300)

        await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2)
        await page.waitForTimeout(400)
        expectOk('E2E-035 前置: 節點1 popup 再開', (await popupOpen('1')) === true, `open=${await popupOpen('1')}`)
        const b2 = await nodeBox(page, '2')
        await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2)
        await page.waitForTimeout(300)
        const rb = await (await page.$('.vue-flow__node[data-id="2"] .vue-flow__resize--bottom-right')).boundingBox()
        await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2)
        await page.mouse.down()
        await page.mouse.move(rb.x + 20, rb.y + 20, { steps: 4 })
        await page.waitForTimeout(200)
        expectOk('E2E-035 按 B 四角縮放 → A popup 關閉', (await popupOpen('1')) === false, `open=${await popupOpen('1')}`)
        await page.mouse.up()
        await page.waitForTimeout(300)

        //拖曳 A 經過 B: B 之 hover affordance 抑制
        await page.mouse.move(0, 0)
        await page.waitForTimeout(300)
        const b1b = await nodeBox(page, '1')
        const b2b = await nodeBox(page, '2')
        await page.mouse.move(b1b.x + b1b.width / 2, b1b.y + b1b.height / 2)
        await page.mouse.down()
        //落點取 B 中心偏右下(仍在 B 內): 兩節點同尺寸且 B 於 DOM 較後(繪於上層), 正中疊放會把被拖之 A 完全遮住, 截圖看不出拖曳
        await page.mouse.move(b2b.x + b2b.width / 2 + 30, b2b.y + b2b.height / 2 + 12, { steps: 12 })
        await page.waitForTimeout(300)
        const during = await page.evaluate(() => {
            const n = document.querySelector('.vue-flow__node[data-id="2"]')
            const gear = n.querySelector('.vue-flow__node-settings-anchor')
            const rs = n.querySelector('.vue-flow__resize-group')
            return {
                gearOpacity: gear ? getComputedStyle(gear).opacity : 'none',
                resizeOpacity: rs ? getComputedStyle(rs).opacity : 'none',
                shadow: getComputedStyle(n).boxShadow,
                gesturing: document.querySelector('[data-flow-id]').classList.contains('vue-flow--gesturing'),
            }
        })
        expectOk('E2E-035 拖曳中根 class gesturing', during.gesturing === true, `d=${JSON.stringify(during)}`)
        expectOk('E2E-035 拖曳經過 B: 齒輪不現', during.gearOpacity === 'none' || Number(during.gearOpacity) === 0, `d=${JSON.stringify(during)}`)
        expectOk('E2E-035 拖曳經過 B: 四角不現', during.resizeOpacity === 'none' || Number(during.resizeOpacity) === 0, `d=${JSON.stringify(during)}`)
        expectOk('E2E-035 拖曳經過 B: 無 hover 陰影', during.shadow === 'none', `d=${JSON.stringify(during)}`)
        //spec(契約 §5): 非建線手勢中把手游標 default(不承諾可出發)
        const hCursor = await page.evaluate(() => {
            const h = document.querySelector('.vue-flow__node[data-id="2"] .vue-flow__handle')
            return h ? getComputedStyle(h).cursor : 'none'
        })
        expectOk('E2E-035 拖曳中把手游標 default', hCursor === 'default', `cursor=${hCursor}`)
        await shot(page, 'flow-E2E-035-drag-no-hover-pollution', { clip: clipAround(b2b, PAD * 2), parkMouse: false })
        await page.mouse.up()
        await page.waitForTimeout(400)
        //放開後 hover B 恢復
        await page.mouse.move(0, 0)
        await page.waitForTimeout(300)
        const b2c = await nodeBox(page, '2')
        await page.mouse.move(b2c.x + b2c.width / 2, b2c.y + 6)
        await page.waitForTimeout(500)
        const afterHover = await page.evaluate(() => {
            const gear = document.querySelector('.vue-flow__node[data-id="2"] .vue-flow__node-settings-anchor')
            return gear ? getComputedStyle(gear).opacity : 'none'
        })
        expectOk('E2E-035 放開後 hover B 齒輪恢復', Number(afterHover) === 1, `opacity=${afterHover}`)
    }),

    mkCase('E2E-036', 'bidirectional-arrows', async (page) => {
        //真實 user path: ①看到 e3-5 兩端箭頭(線式 start / 實心橘 end) ②開該連線齒輪 ③展開 Arrows 群 ④改 From Marker=Arrow Closed、To Marker Size=20 ⑤看到箭頭更新
        await clickMenu(page, 'fitView')
        await page.waitForTimeout(400)
        const markerState = () => page.evaluate(() => {
            const path = document.querySelector('.vue-flow__edge[data-id="e3-5"] path[marker-end]')
            if (!path) return null
            const ref = (attr) => {
                const v = path.getAttribute(attr)
                const m = v && v.match(/^url\(#(.+)\)$/)
                const el = m ? document.getElementById(m[1]) : null
                if (!el) return { url: v, found: false }
                const p = el.querySelector('path')
                return { url: v, found: true, width: el.getAttribute('markerWidth'), units: el.getAttribute('markerUnits'), fill: p.getAttribute('fill'), d: p.getAttribute('d') }
            }
            return { start: ref('marker-start'), end: ref('marker-end') }
        })
        const s0 = await markerState()
        expectOk('E2E-036 兩端皆引用存在之 marker', !!s0 && s0.start.found && s0.end.found, `s0=${JSON.stringify(s0)}`)
        expectOk('E2E-036 start 為線式(fill none)', !!s0 && s0.start.fill === 'none' && !/z$/i.test(s0.start.d), `start=${JSON.stringify(s0 && s0.start)}`)
        expectOk('E2E-036 end 為實心 #ffa500、size 14、userSpaceOnUse', !!s0 && s0.end.fill === '#ffa500' && s0.end.width === '14' && s0.end.units === 'userSpaceOnUse' && /z$/i.test(s0.end.d), `end=${JSON.stringify(s0 && s0.end)}`)
        const pb = await (await page.$('.vue-flow__edge[data-id="e3-5"] path[marker-end]')).boundingBox()
        await page.mouse.move(0, 0)
        await shot(page, 'flow-E2E-036-bidirectional-arrows-initial', { clip: clipAround(pb, PAD) })

        //act(真 UI): 雙擊 label 直接開設定 popup → 展開 Arrows 群 → 改 From Marker / To Marker Size
        await openEdgeSettings(page, 'e3-5')
        await page.waitForTimeout(400)
        await openSettingsGroup(page, 'Arrows')
        await selectByClick(page, 'From Marker', 'Arrow Closed')
        //改 marker 後 popup 須仍開著 —— 「切換 From/To Marker 導致 popup 消失」是實際回報過的缺陷,
        //故此處明確斷言而非只靠「後續還能操作」隱含驗證
        expectOk('E2E-036 改 From Marker 後設定 popup 仍開著', (await getForms(page)).count === 1, `forms=${JSON.stringify(await getForms(page))}`)
        const sizeInput = page.locator('.vue-flow__settings-form label:has-text("To Marker Size") input')
        await sizeInput.click()
        await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'INPUT')
        await page.keyboard.press('End')
        await page.keyboard.press('Backspace')
        await page.keyboard.press('Backspace')
        await page.keyboard.insertText('20')
        await page.waitForTimeout(400)

        const data = await evalVm(page, `const c = vm.conns.find(c => c.id === 'e3-5'); return { markerFrom: c.markerFrom, markerToSize: c.markerToSize }`)
        expectOk('E2E-036 conn 資料更新', data.markerFrom === 'arrowclosed' && data.markerToSize === 20, `data=${JSON.stringify(data)}`)
        const s1 = await markerState()
        expectOk('E2E-036 start 改為實心', !!s1 && s1.start.found && /z$/i.test(s1.start.d) && s1.start.fill !== 'none', `start=${JSON.stringify(s1 && s1.start)}`)
        expectOk('E2E-036 end size 改為 20', !!s1 && s1.end.found && s1.end.width === '20', `end=${JSON.stringify(s1 && s1.end)}`)
        expectOk('E2E-036 發出 conn-settings-update', (await emitted(page)).includes('conn-settings-update'), 'no conn-settings-update')

        //關閉 popup 後拍該邊區域
        await page.mouse.move(5, 5)
        await page.mouse.down()
        await page.mouse.up()
        await page.waitForTimeout(400)
        await page.mouse.move(0, 0)
        const pb2 = await (await page.$('.vue-flow__edge[data-id="e3-5"] path[marker-end]')).boundingBox()
        await shot(page, 'flow-E2E-036-bidirectional-arrows-edited', { clip: clipAround(pb2, PAD) })
    }),

    mkCase('E2E-037', 'settings-trigger', async (page) => {
        //真實 user path: ①移入節點看不到齒輪 ②雙擊節點 → 設定 popup 直接開啟(無齒輪 icon) ③點空白 → 關閉 ④雙擊連線 label → 連線設定 popup
        //⑤click 模式: 單擊即開 ⑥hover 模式: 移入出齒輪(既有行為)
        await centerOnNode(page, '2')
        await page.waitForTimeout(300)
        const gearVisible = (sel) => page.evaluate((s) => {
            const el = document.querySelector(s)
            if (!el) return null
            const cs = getComputedStyle(el)
            return { visibility: cs.visibility, pointerEvents: cs.pointerEvents }
        }, sel)
        const NG = '.vue-flow__node[data-id="2"] .vue-flow__node-settings'
        //spec: 預設 dblclick, hover 不出齒輪
        const b = await hoverNode(page, '2')
        expectOk('E2E-037 預設 hover 無齒輪', (await gearVisible(NG)) === null, 'gear present on hover')
        //spec: 雙擊 → 設定 popup 直接開啟, 齒輪 icon 不可見
        await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
        await page.waitForTimeout(500)
        const f1 = await getForms(page)
        expectOk('E2E-037 雙擊後節點設定表單開啟', f1.count === 1 && f1.hasNodeForm === true, `forms=${JSON.stringify(f1)}`)
        const g1 = await gearVisible(NG)
        expectOk('E2E-037 齒輪 icon 不可見', !g1 || g1.visibility === 'hidden', `gear=${JSON.stringify(g1)}`)
        const selN = await getSelectedNodes(page)
        expectOk('E2E-037 該節點為唯一選取', selN.length === 1 && selN[0] === '2', `sel=${JSON.stringify(selN)}`)
        await shot(page, 'flow-E2E-037-settings-trigger-node', { parkMouse: false })
        //點空白 → 關閉
        const bp = await blankPoint(page)
        await page.mouse.click(bp.x, bp.y)
        await page.waitForTimeout(400)
        expectOk('E2E-037 點空白後表單關閉', (await getForms(page)).count === 0, 'form still open')
        //連線: 雙擊 label → 連線設定 popup
        await openEdgeSettings(page, 'e1-2')
        await page.waitForTimeout(400)
        const f2 = await getForms(page)
        expectOk('E2E-037 雙擊連線 label 後連線設定表單開啟', f2.count === 1 && f2.hasNodeForm === false, `forms=${JSON.stringify(f2)}`)
        const eg = await gearVisible('.vue-flow__edge[data-id="e1-2"] .vue-flow__edge-settings')
        expectOk('E2E-037 連線齒輪 icon 不可見', !eg || eg.visibility === 'hidden', `gear=${JSON.stringify(eg)}`)
        await shot(page, 'flow-E2E-037-settings-trigger-edge', { parkMouse: false })
        await page.mouse.click(bp.x, bp.y)
        await page.waitForTimeout(300)
        //click 模式: 單擊即開設定(資訊 popup 讓位)
        await setSettingsTrigger(page, 'click')
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
        await page.waitForTimeout(500)
        const f3 = await getForms(page)
        expectOk('E2E-037 click 模式單擊開設定表單', f3.count === 1 && f3.hasNodeForm === true, `forms=${JSON.stringify(f3)}`)
        await page.mouse.click(bp.x, bp.y)
        await page.waitForTimeout(300)
        //hover 模式: 移入出齒輪、移出收
        await setSettingsTrigger(page, 'hover')
        await hoverNode(page, '2')
        const hg = await gearVisible(NG)
        expectOk('E2E-037 hover 模式移入出齒輪', !!hg && hg.visibility === 'visible', `gear=${JSON.stringify(hg)}`)
        await page.mouse.move(0, 0)
        await page.waitForTimeout(400)
        expectOk('E2E-037 hover 模式移出收齒輪', (await gearVisible(NG)) === null, 'gear persisted in hover mode')
        //spec: 連線 label 兩側空白不可點(無透明 hover 區): 點 label 右側 25px 不選取該連線
        await page.mouse.click(bp.x, bp.y)
        await page.waitForTimeout(300)
        const lb = await (await page.$('.vue-flow__edge[data-id="e1-2"] .vue-flow__edge-label')).boundingBox()
        await page.mouse.click(lb.x + lb.width + 25, lb.y + lb.height / 2)
        await page.waitForTimeout(300)
        const selC = await evalVm(page, 'return vm.selectedConns.slice()')
        expectOk('E2E-037 label 兩側空白不可點', selC.length === 0, `selectedConns=${JSON.stringify(selC)}`)
    }),

    mkCase('E2E-038', 'init-fit', async (page) => {
        //spec: 預設 fitViewOnInit —— 首幀隱藏量測 → fit → 顯示 → init; 使用者不會看到 fit 前之一幀
        const frames = await page.evaluate(() => window.__initFrames)
        const visible = frames.filter(f => f.visibility === 'visible')
        const transforms = [...new Set(visible.map(f => f.transform))]
        expectOk('E2E-038 可見期間 viewport transform 唯一(無 pre-fit 幀)', visible.length > 0 && transforms.length === 1, `transforms=${JSON.stringify(transforms)} frames=${frames.length}`)
        expectOk('E2E-038 可見之第一幀已非原點視口', !!visible[0] && !/scale\(1\)$/.test(visible[0].transform) && !visible[0].pending, `first=${JSON.stringify(visible[0])}`)
        expectOk('E2E-038 pending 期間不可見', frames.every(f => !f.pending || f.visibility === 'hidden'), 'pending frame was visible')
        //viewport = computeFitView(可見節點包絡, 容器, padding=50, maxZoom=zoomMax)
        const st = await evalVm(page, `
            const rect = vm.$refs.canvas.getContainerRect()
            return { viewport: { ...vm.viewport }, nodes: JSON.parse(JSON.stringify(vm.nodes)), internals: JSON.parse(JSON.stringify(vm.nodeInternals)),
                defNode: JSON.parse(JSON.stringify(vm.defNode)), container: { width: rect.width, height: rect.height }, zoomMax: vm.zoomMax,
                pending: vm.viewPending, hasPendingClass: vm.$el.classList.contains('vue-flow--pending') }
        `)
        //padding = 預設 50(CSS 像素, 不為選單讓位)
        const exp = computeFitView(nodesBounds(st.nodes, st.internals, st.defNode), st.container, { padding: 50, maxZoom: st.zoomMax })
        const near = (a, b) => Math.abs(a - b) < 1e-6
        expectOk('E2E-038 viewport 等於 fit 計算結果', !!exp && near(st.viewport.zoom, exp.zoom) && near(st.viewport.x, exp.x) && near(st.viewport.y, exp.y), `vp=${JSON.stringify(st.viewport)} exp=${JSON.stringify(exp)}`)
        expectOk('E2E-038 初始化完成後無 pending', st.pending === false && st.hasPendingClass === false, `pending=${st.pending} class=${st.hasPendingClass}`)
        //全部節點落在畫布內
        const inside = await page.evaluate(() => {
            const c = document.querySelector('.vue-flow').getBoundingClientRect()
            return [...document.querySelectorAll('.vue-flow__node')].every(n => {
                const r = n.getBoundingClientRect()
                return r.left >= c.left && r.top >= c.top && r.right <= c.right && r.bottom <= c.bottom
            })
        })
        expectOk('E2E-038 全部節點落在畫布內', inside === true, 'some node outside canvas')
        await shot(page, 'flow-E2E-038-init-fit', { clip: await getCanvasClip(page) })
    }, { rawInit: true }),

    mkCase('E2E-039', 'canvas-resize', async (page) => {
        //spec: opt.width/height 變更 → 舊圖台中心之內容於新圖台仍居中(zoom 不變), 發 resize 事件(payload 含新舊尺寸與 viewport)
        //setup: 節點 1 置中(其中心即圖台中心之內容)
        await centerOnNode(page, '1')
        await evalVm(page, 'window.__rs = []; vm.$on("resize", (p) => window.__rs.push(p)); return true')
        const nodeCenter = async () => {
            const b = await (await page.$('.vue-flow__node[data-id="1"]')).boundingBox()
            return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
        }
        const canvasCenter = async () => {
            const r = await getContainerRect(page)
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        }
        const vp0 = await getViewport(page)
        //act: 真實點擊 demo 之「set width to 300」
        await page.locator('button', { hasText: 'set width to 300' }).click()
        await page.waitForTimeout(300)
        let nc = await nodeCenter()
        let cc = await canvasCenter()
        expectOk('E2E-039 變寬後節點 1 中心仍在圖台中心', Math.abs(nc.x - cc.x) < 1.5 && Math.abs(nc.y - cc.y) < 1.5, `node=${JSON.stringify(nc)} canvas=${JSON.stringify(cc)}`)
        const vp1 = await getViewport(page)
        expectOk('E2E-039 zoom 不變', vp1.zoom === vp0.zoom, `zoom ${vp0.zoom} → ${vp1.zoom}`)
        //act: 真實點擊「set height to 300」
        await page.locator('button', { hasText: 'set height to 300' }).click()
        await page.waitForTimeout(300)
        nc = await nodeCenter()
        cc = await canvasCenter()
        expectOk('E2E-039 變高後節點 1 中心仍在圖台中心', Math.abs(nc.x - cc.x) < 1.5 && Math.abs(nc.y - cc.y) < 1.5, `node=${JSON.stringify(nc)} canvas=${JSON.stringify(cc)}`)
        const rs = await page.evaluate(() => window.__rs)
        expectOk('E2E-039 resize 事件兩次且 payload 完整', rs.length === 2 && rs[0].width === 300 && rs[0].oldWidth === 800 && rs[1].height === 300 && rs[1].oldHeight === 600 && typeof rs[1].viewport.x === 'number', `rs=${JSON.stringify(rs)}`)
        const rect = await getContainerRect(page)
        expectOk('E2E-039 容器尺寸已為 300×300', Math.round(rect.width) === 300 && Math.round(rect.height) === 300, `rect=${rect.width}x${rect.height}`)
        await shot(page, 'flow-E2E-039-canvas-resize', { clip: await getCanvasClip(page) })
    }),

    mkCase('E2E-040', 'fit-padding', async (page) => {
        //spec: fit 留白由 fitViewPadding 全權決定(CSS 像素): 預設 50 使預設工具區(右緣 40px)不遮節點且有間隙;
        //      0 = 貼邊, 節點可進入工具區底下(明確選擇, 不自動讓位——同 Leaflet/OpenLayers/React Flow)
        //setup(非 act): 塞入寬受限網格(2920×1544 vs 容器 800×600), 受限軸(左右)之邊距恰為 padding
        await evalVm(page, `
            const ns = []
            for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
                ns.push({ id: 'g' + (r * 8 + c), name: 'N', position: { x: c * 400, y: r * 300 }, width: 120, height: 44 })
            }
            vm.opt.nodes = ns
            vm.opt.conns = []
            return true
        `)
        await page.waitForTimeout(400)
        const measure = () => page.evaluate(() => {
            const c = document.querySelector('.vue-flow').getBoundingClientRect()
            const p = document.querySelector('.vue-flow__panel').getBoundingClientRect()
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            let hit = 0
            for (const n of document.querySelectorAll('.vue-flow__node')) {
                const b = n.getBoundingClientRect()
                minX = Math.min(minX, b.left); minY = Math.min(minY, b.top)
                maxX = Math.max(maxX, b.right); maxY = Math.max(maxY, b.bottom)
                if (b.left < p.right && b.right > p.left && b.top < p.bottom && b.bottom > p.top) hit++
            }
            return {
                hit,
                panelRight: p.right - c.left,
                margins: { left: minX - c.left, top: minY - c.top, right: c.right - maxX, bottom: c.bottom - maxY },
            }
        })
        //act: 真實點擊工具區之 fitView 鈕(自上而下第 4 個, 各鈕等高) → 預設 padding 50
        await clickMenu(page, 'fitView')
        await page.waitForTimeout(500)
        let geo = await measure()
        expectOk('E2E-040 預設 50: 無任何節點被工具區遮蔽', geo.hit === 0, `overlapped=${geo.hit} margins=${JSON.stringify(geo.margins)}`)
        expectOk('E2E-040 預設 50: 受限軸兩側邊距皆為 50', Math.abs(geo.margins.left - 50) < 1 && Math.abs(geo.margins.right - 50) < 1, `margins=${JSON.stringify(geo.margins)}`)
        expectOk('E2E-040 預設 50: 節點與工具區有間隙', geo.margins.left - geo.panelRight > 5, `gap=${geo.margins.left - geo.panelRight}`)
        //CSS 像素語義: 邊距不隨 zoom 縮水(舊畫布座標語義於此 zoom≈0.24 會縮成 ~12px)
        expectOk('E2E-040 邊距不隨 zoom 縮水', geo.margins.right > 40, `right=${geo.margins.right}`)
        await shot(page, 'flow-E2E-040-fit-padding', { clip: await getCanvasClip(page) })
        //setup(非 act): 改 fitViewPadding=0 → act: 再真實點擊 fitView 鈕 → 貼邊
        await evalVm(page, `vm.$set(vm.opt, 'fitViewPadding', 0); return true`)
        await page.waitForTimeout(200)
        await clickMenu(page, 'fitView')
        await page.waitForTimeout(500)
        geo = await measure()
        expectOk('E2E-040 padding 0: 受限軸貼邊(邊距 0)', Math.abs(geo.margins.left) < 1 && Math.abs(geo.margins.right) < 1, `margins=${JSON.stringify(geo.margins)}`)
        expectOk('E2E-040 padding 0: 節點可進入工具區下(明確選擇, 不自動讓位)', geo.hit >= 1, `overlapped=${geo.hit}`)
    }),

    mkCase('E2E-041', 'settings-groups', async (page) => {
        //spec 契約 §11: 屬性分為可顯隱之群; 三角形朝右=收合 / 朝下=展開; 各群獨立顯隱; 展開/收合不改 popup 寬度
        //真實 user path: ①雙擊節點開設定 popup ②只看到 Basic 展開 ③點 Appearance 標題文字展開 ④Basic 仍開著 ⑤再點一次收合
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        await openNodeSettings(page, '1')
        await page.waitForTimeout(400)

        const s0 = await settingsGroupState(page)
        expectOk('E2E-041 節點表單群標題與順序',
            !!s0 && JSON.stringify(s0.groups.map(g => g.title)) === JSON.stringify(['Basic', 'Appearance', 'Text', 'Advanced']),
            `titles=${JSON.stringify(s0 && s0.groups.map(g => g.title))}`)
        expectOk('E2E-041 預設僅 Basic 展開',
            !!s0 && s0.groups.filter(g => g.expanded).length === 1 && s0.groups[0].expanded === true,
            `expanded=${JSON.stringify(s0 && s0.groups.map(g => g.expanded))}`)
        //三角形朝向即狀態: 展開者帶 --open(CSS 轉 90 度朝下), 收合者不帶(朝右)
        expectOk('E2E-041 三角形朝向與展開態一致',
            !!s0 && s0.groups.every(g => g.caretOpen === g.expanded),
            `caret=${JSON.stringify(s0 && s0.groups.map(g => [g.title, g.caretOpen, g.expanded]))}`)
        //以 computed transform 驗真正的朝向(不只驗 class): 收合為未旋轉, 展開為 rotate(90deg) 之矩陣
        const upright = (t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'
        const rot90 = (t) => /^matrix\(-?0(\.\d+)?, 1, -1, -?0(\.\d+)?, 0, 0\)$/.test(t)
        expectOk('E2E-041 三角形實際旋轉: 收合未旋轉、展開轉 90 度',
            !!s0 && s0.groups.every(g => (g.expanded ? rot90(g.caretTransform) : upright(g.caretTransform))),
            `transforms=${JSON.stringify(s0 && s0.groups.map(g => [g.title, g.expanded, g.caretTransform]))}`)
        //APG accordion 之結構要求(標題按鈕包在 role="heading" 且帶 aria-level)
        expectOk('E2E-041 每群標題皆為帶 aria-level 之 heading',
            !!s0 && s0.groups.every(g => g.headingLevel === '3'),
            `levels=${JSON.stringify(s0 && s0.groups.map(g => [g.title, g.headingLevel]))}`)
        //三角形為狀態指示圖示: WCAG 2.2 §1.4.11 要求對「相鄰色」≥3:1。三角形坐在標題底色上而非白底,
        //#666 對淺色主題之標題底色為 5.04:1; 先前的 #888 僅 3.11:1(當時記載的 3.55:1 是誤以白底計算)。
        //此契約 pixel baseline 抓不到(一階色差落在 pixelmatch threshold 內), 故必須有語意斷言。
        expectOk('E2E-041 三角形色階以相鄰色計算且餘裕充足(#666)',
            !!s0 && s0.groups.every(g => g.caretColor === 'rgb(102, 102, 102)'),
            `colors=${JSON.stringify(s0 && s0.groups.map(g => [g.title, g.caretColor]))}`)
        //群標題與欄位之視覺分區: 標題列有底色、高度為契約(min-height 而非內容偶然撐出)
        expectOk('E2E-041 群標題列底色為可隨主題走之疊加色', s0 && s0.headBg === 'rgba(0, 0, 0, 0.06)', `headBg=${s0 && s0.headBg}`)
        expectOk('E2E-041 群標題列高度為契約 min-height:27px', s0 && s0.headMinHeight === '27px', `minHeight=${s0 && s0.headMinHeight}`)
        expectOk('E2E-041 群標題列明顯高於欄位列',
            !!s0 && s0.headHeight >= s0.labelHeight + 5,
            `head=${s0 && s0.headHeight} label=${s0 && s0.labelHeight}`)
        //full-bleed: 「每一個」標題底色都貼齊 popup 左右邊緣, 且不留圓角(圓角是浮起元素的語彙, 與 full-bleed 相斥)
        expectOk('E2E-041 每個群標題列皆 full-bleed 貼齊 popup 左右邊緣',
            !!s0 && s0.headInsets.length === s0.groups.length && s0.headInsets.every(([l, r]) => Math.abs(l) < 0.6 && Math.abs(r) < 0.6),
            `insets=${JSON.stringify(s0 && s0.headInsets)}`)
        expectOk('E2E-041 貼齊邊緣者不留圓角', s0 && s0.headRadius === '0px', `radius=${s0 && s0.headRadius}`)
        //標題文字與欄位標籤同一條垂直線(標題列以負 margin full-bleed 後再補回同值 padding 之目的)
        expectOk('E2E-041 標題文字與欄位標籤左緣對齊',
            !!s0 && Math.abs(s0.titleLeft - s0.labelLeft) < 0.6,
            `title=${s0 && s0.titleLeft} label=${s0 && s0.labelLeft}`)
        //字級單一來源: label 與控制項繼承表單 root, opt.settingsPopupTextFontSize 才會真正生效
        expectOk('E2E-041 label 與控制項字級繼承表單 root',
            !!s0 && s0.labelFontSize === s0.rootFontSize && s0.controlFontSize === s0.rootFontSize,
            `root=${s0 && s0.rootFontSize} label=${s0 && s0.labelFontSize} control=${s0 && s0.controlFontSize}`)
        //表單高度上限(opt.settingsPopupMaxHeight, 預設 400px)與水平溢位
        expectOk('E2E-041 表單套用高度上限 400px 且可捲動',
            !!s0 && s0.maxHeight === '400px' && s0.overflowY === 'auto',
            `maxHeight=${s0 && s0.maxHeight} overflowY=${s0 && s0.overflowY}`)
        expectOk('E2E-041 表單不產生水平捲動',
            !!s0 && s0.overflowX === 'hidden' && s0.hScroll === false,
            `overflowX=${s0 && s0.overflowX} hScroll=${s0 && s0.hScroll}`)
        //收合群之欄位真的看不到(visibility:hidden → offsetParent 為 null)
        expectOk('E2E-041 收合群之欄位不可見, 展開群之欄位可見',
            !!s0 && s0.groups.every(g => g.fieldVisible === g.expanded) && s0.groups.every(g => g.panelClosed === !g.expanded),
            `fields=${JSON.stringify(s0 && s0.groups.map(g => [g.title, g.fieldVisible]))}`)
        //刪除鈕不歸入任何群, 且恆為表單最後一列
        expectOk('E2E-041 刪除區在群組之外且位於表單底部',
            !!s0 && s0.deleteInGroup === false && s0.deleteIsLast === true,
            `deleteInGroup=${s0 && s0.deleteInGroup} deleteIsLast=${s0 && s0.deleteIsLast}`)
        //分隔語彙一致: 刪除區之分隔線與群標題底色同樣 full-bleed(一內縮一貼齊即為兩套規則)
        expectOk('E2E-041 刪除區分隔線亦 full-bleed(與群標題同一邊界)',
            !!s0 && s0.deleteInset && Math.abs(s0.deleteInset[0]) < 0.6 && Math.abs(s0.deleteInset[1]) < 0.6,
            `deleteInset=${JSON.stringify(s0 && s0.deleteInset)}`)
        expectOk('E2E-041 刪除鈕右緣與輸入控制項右緣同一條線',
            !!s0 && s0.controlRightInset !== null && Math.abs(s0.deleteBtnRightInset - s0.controlRightInset) < 0.6,
            `btn=${s0 && s0.deleteBtnRightInset} control=${s0 && s0.controlRightInset}`)
        //縱向邊界一律緊貼: 群↔群與 末群↔刪除線 同一規則(間距只屬於展開內容之下緣)
        expectOk('E2E-041 縱向邊界間距一律 0(含末群與刪除線之間)',
            !!s0 && s0.boundaryGaps.length === s0.groups.length && s0.boundaryGaps.every(g => Math.abs(g) < 0.6),
            `gaps=${JSON.stringify(s0 && s0.boundaryGaps)}`)
        await shot(page, 'flow-E2E-041-settings-groups-node-default', { parkMouse: false })

        //act: 點 Appearance 之「標題文字」(非三角形)——整條標題列皆可點
        await page.locator('.vue-flow__settings-group-title:text-is("Appearance")').first().click()
        await page.waitForTimeout(400)
        const s1 = await settingsGroupState(page)
        expectOk('E2E-041 Appearance 已展開', !!s1 && s1.groups[1].expanded === true, `expanded=${JSON.stringify(s1 && s1.groups.map(g => g.expanded))}`)
        expectOk('E2E-041 各群獨立顯隱: Basic 仍展開', !!s1 && s1.groups[0].expanded === true, `expanded=${JSON.stringify(s1 && s1.groups.map(g => g.expanded))}`)
        expectOk('E2E-041 展開數為 2(非手風琴式互斥)', !!s1 && s1.groups.filter(g => g.expanded).length === 2, `count=${s1 && s1.groups.filter(g => g.expanded).length}`)
        //收合內容仍參與寬度計算 → popup 寬度不因展開/收合而跳動
        expectOk('E2E-041 展開前後表單寬度不變', !!s1 && Math.abs(s1.formWidth - s0.formWidth) < 0.5, `before=${s0 && s0.formWidth} after=${s1 && s1.formWidth}`)
        await shot(page, 'flow-E2E-041-settings-groups-node-appearance', { parkMouse: false })

        //act: 再點一次 → 收合, 且 Basic 不受影響
        await page.locator('.vue-flow__settings-group-title:text-is("Appearance")').first().click()
        await page.waitForTimeout(400)
        const s2 = await settingsGroupState(page)
        expectOk('E2E-041 再點即收合', !!s2 && s2.groups[1].expanded === false && s2.groups[1].caretOpen === false, `expanded=${JSON.stringify(s2 && s2.groups.map(g => g.expanded))}`)
        expectOk('E2E-041 收合他群後 Basic 仍展開', !!s2 && s2.groups[0].expanded === true, `expanded=${JSON.stringify(s2 && s2.groups.map(g => g.expanded))}`)
        expectOk('E2E-041 收合後表單寬度仍不變', !!s2 && Math.abs(s2.formWidth - s0.formWidth) < 0.5, `before=${s0 && s0.formWidth} after=${s2 && s2.formWidth}`)

        //act: 整條標題列皆可點 —— 分別點「三角形本身」與「標題列右側空白處」
        await settingsGroupHead(page, 'Text').locator('.vue-flow__settings-group-caret').click()
        await page.waitForTimeout(400)
        const s3 = await settingsGroupState(page)
        expectOk('E2E-041 點三角形本身即展開', !!s3 && s3.groups[2].expanded === true, `expanded=${JSON.stringify(s3 && s3.groups.map(g => g.expanded))}`)
        const headBox = await settingsGroupHead(page, 'Advanced').boundingBox()
        await page.mouse.click(headBox.x + headBox.width - 6, headBox.y + headBox.height / 2)
        await page.waitForTimeout(400)
        const s4 = await settingsGroupState(page)
        expectOk('E2E-041 點標題列右側空白處即展開', !!s4 && s4.groups[3].expanded === true, `expanded=${JSON.stringify(s4 && s4.groups.map(g => g.expanded))}`)

        //act: 鍵盤操作 —— 標題為 <button>, 須可 Tab 聚焦並以 Enter / Space 切換(APG 必要鍵盤行為)
        await settingsGroupHead(page, 'Text').focus()
        const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim())
        expectOk('E2E-041 群標題可被鍵盤聚焦', focused === 'Text', `activeElement=${focused}`)
        await page.keyboard.press('Enter')
        await page.waitForTimeout(400)
        const s5 = await settingsGroupState(page)
        expectOk('E2E-041 Enter 可收合已展開之群', !!s5 && s5.groups[2].expanded === false, `expanded=${JSON.stringify(s5 && s5.groups.map(g => g.expanded))}`)
        await page.keyboard.press(' ')
        await page.waitForTimeout(400)
        const s6 = await settingsGroupState(page)
        expectOk('E2E-041 Space 可重新展開', !!s6 && s6.groups[2].expanded === true, `expanded=${JSON.stringify(s6 && s6.groups.map(g => g.expanded))}`)
        //收合群內之控制項一律不得留在 Tab 序列中(visibility:hidden 之語義後果)
        const focusables = await page.evaluate(() => {
            const form = document.querySelector('.vue-flow__settings-form')
            const closed = [...form.querySelectorAll('.vue-flow__settings-group-panel--closed')]
            const ctrls = closed.flatMap(p => [...p.querySelectorAll('input,select,button,[tabindex]')])
            return { total: ctrls.length, reachable: ctrls.filter(c => getComputedStyle(c).visibility !== 'hidden').length }
        })
        expectOk('E2E-041 收合群內控制項不可聚焦', focusables.reachable === 0, `reachable=${focusables.reachable}/${focusables.total}`)

        //節點表單全展開: 四群皆開, 內容超過上限後於表單內捲動(連線表單另於後段驗, 此處補節點側之對稱覆蓋)
        await openSettingsGroup(page, 'Appearance')
        await openSettingsGroup(page, 'Text')
        await openSettingsGroup(page, 'Advanced')
        await page.mouse.move(0, 0)
        await page.waitForTimeout(400)
        const s7 = await settingsGroupState(page)
        expectOk('E2E-041 節點表單四群皆可同時展開',
            !!s7 && s7.groups.every(g => g.expanded) && s7.groups.length === 4,
            `expanded=${JSON.stringify(s7 && s7.groups.map(g => g.expanded))}`)
        expectOk('E2E-041 節點表單全展開後亦封頂於 400px 並捲動',
            !!s7 && Math.abs(s7.formHeight - 400) < 1 && s7.scrollable === true,
            `h=${s7 && s7.formHeight} scrollable=${s7 && s7.scrollable}`)
        expectOk('E2E-041 節點表單全展開後寬度與邊界不變',
            !!s7 && Math.abs(s7.formWidth - s0.formWidth) < 0.5 && s7.boundaryGaps.every(g => Math.abs(g) < 0.6),
            `w=${s0 && s0.formWidth}→${s7 && s7.formWidth} gaps=${JSON.stringify(s7 && s7.boundaryGaps)}`)
        await shot(page, 'flow-E2E-041-settings-groups-node-expanded', { parkMouse: false })

        //連線設定表單: 群數 5, 同一機制; Path 群展開後含 Waypoints 子區塊
        await openEdgeSettings(page, 'e1-2')
        await page.waitForTimeout(500)
        const c0 = await settingsGroupState(page)
        expectOk('E2E-041 連線表單群標題與順序',
            !!c0 && JSON.stringify(c0.groups.map(g => g.title)) === JSON.stringify(['Basic', 'Path', 'Appearance', 'Arrows', 'Text']),
            `titles=${JSON.stringify(c0 && c0.groups.map(g => g.title))}`)
        expectOk('E2E-041 連線表單預設僅 Basic 展開',
            !!c0 && c0.groups.filter(g => g.expanded).length === 1 && c0.groups[0].expanded === true,
            `expanded=${JSON.stringify(c0 && c0.groups.map(g => g.expanded))}`)
        expectOk('E2E-041 連線表單刪除區亦在群組之外且位於底部',
            !!c0 && c0.deleteInGroup === false && c0.deleteIsLast === true,
            `deleteInGroup=${c0 && c0.deleteInGroup} deleteIsLast=${c0 && c0.deleteIsLast}`)
        await shot(page, 'flow-E2E-041-settings-groups-conn-default', { parkMouse: false })

        await openSettingsGroup(page, 'Path')
        const c1 = await settingsGroupState(page)
        expectOk('E2E-041 連線 Path 群已展開且 Basic 仍展開',
            !!c1 && c1.groups[1].expanded === true && c1.groups[0].expanded === true,
            `expanded=${JSON.stringify(c1 && c1.groups.map(g => g.expanded))}`)
        const wp = await page.evaluate(() => {
            const el = document.querySelector('.vue-flow__settings-form .vue-flow__waypoints')
            const seen = (e) => !!e && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().height > 0
            return { exists: !!el, visible: seen(el), inPath: !!el && el.closest('.vue-flow__settings-group-panel') !== null }
        })
        expectOk('E2E-041 Waypoints 子區塊在 Path 群內且展開後可見', wp.exists && wp.visible && wp.inPath, `wp=${JSON.stringify(wp)}`)
        expectOk('E2E-041 連線表單展開前後寬度不變', !!c1 && Math.abs(c1.formWidth - c0.formWidth) < 0.5, `before=${c0 && c0.formWidth} after=${c1 && c1.formWidth}`)
        await shot(page, 'flow-E2E-041-settings-groups-conn-path', { parkMouse: false })

        //高度上限之實際效果: 連線表單全展開(內容遠超 400px)須封頂並於表單內捲動, 且寬度不因捲動條而變
        await openSettingsGroup(page, 'Appearance')
        await openSettingsGroup(page, 'Arrows')
        await openSettingsGroup(page, 'Text')
        const c2 = await settingsGroupState(page)
        expectOk('E2E-041 全展開後高度封頂於 400px',
            !!c2 && Math.abs(c2.formHeight - 400) < 1,
            `formHeight=${c2 && c2.formHeight}`)
        expectOk('E2E-041 全展開後於表單內捲動(非讓 popup 無限長高)', !!c2 && c2.scrollable === true, `scrollable=${c2 && c2.scrollable}`)
        //「寬度不變」須量到內容層: 只比外框寬會漏掉「外框同寬但內容被捲動條擠窄」的情形
        expectOk('E2E-041 出現捲動條後外框寬 / clientWidth / 控制項右緣皆不變',
            !!c2 && Math.abs(c2.formWidth - c0.formWidth) < 0.5 &&
                Math.abs(c2.clientWidth - c0.clientWidth) < 0.5 &&
                Math.abs(c2.controlRightInset - c0.controlRightInset) < 0.5,
            `outer=${c0 && c0.formWidth}→${c2 && c2.formWidth} client=${c0 && c0.clientWidth}→${c2 && c2.clientWidth} ctrlRight=${c0 && c0.controlRightInset}→${c2 && c2.controlRightInset}`)
        expectOk('E2E-041 捲動狀態下仍無水平捲動且標題列仍 full-bleed',
            !!c2 && c2.hScroll === false && c2.headInsets.every(([l, r]) => Math.abs(l) < 0.6 && Math.abs(r) < 0.6),
            `hScroll=${c2 && c2.hScroll} insets=${JSON.stringify(c2 && c2.headInsets)}`)
    }),

    mkCase('E2E-042', 'settings-groups-dark', async (page) => {
        //spec 契約 §11「主題適應」: 群標題之底色/hover/分隔線/三角形一律走 CSS 變數且不硬寫 hex,
        //表單依 opt.settingsPopupBackgroundColor 之相對亮度自動切換 —— 淺色疊黑加深、深色改疊白加亮並改用淺色三角形。
        //setup(非 act): 由宿主 opt 指定深色 popup(此為宿主組態, 不是使用者操作)
        await evalVm(page, `
            vm.$set(vm.opt, 'settingsPopupBackgroundColor', '#2b2b30')
            vm.$set(vm.opt, 'settingsPopupTextColor', '#eaeaea')
            return true
        `)
        await page.waitForTimeout(300)

        //act(真 UI): 雙擊節點開設定 popup, 再真實點擊展開 Appearance(驗 hover/展開態在深色下亦正確)
        await centerOnNode(page, '1')
        await page.waitForTimeout(300)
        await openNodeSettings(page, '1')
        await page.waitForTimeout(400)
        await page.locator('.vue-flow__settings-group-title:text-is("Appearance")').first().click()
        await page.mouse.move(0, 0)
        await page.waitForTimeout(400)

        const d = await settingsGroupState(page)
        //標題帶改為疊白加亮(淺色主題為 rgba(0,0,0,0.06)); 深色底上若仍疊黑, 標題帶會比背景更暗
        expectOk('E2E-042 深色底之群標題改為疊白加亮',
            d && d.headBg === 'rgba(255, 255, 255, 0.1)', `headBg=${d && d.headBg}`)
        //三角形改用淺色, 否則在深色底上看不見
        expectOk('E2E-042 深色底之三角形改為淺色',
            !!d && d.groups.every(g => g.caretColor === 'rgba(255, 255, 255, 0.72)'),
            `colors=${JSON.stringify(d && d.groups.map(g => [g.title, g.caretColor]))}`)
        //標題文字繼承 opt.settingsPopupTextColor(硬寫 #333 會在深色下不可讀)
        const titleColor = await page.evaluate(() => getComputedStyle(document.querySelector('.vue-flow__settings-group-title')).color)
        expectOk('E2E-042 標題文字繼承 popup 之 textColor', titleColor === 'rgb(234, 234, 234)', `titleColor=${titleColor}`)
        //幾何契約在深色下不變(full-bleed、邊界緊貼、標題列高度)
        expectOk('E2E-042 深色下 full-bleed 與縱向邊界不變',
            !!d && d.headInsets.every(([l, r]) => Math.abs(l) < 0.6 && Math.abs(r) < 0.6) && d.boundaryGaps.every(g => Math.abs(g) < 0.6),
            `insets=${JSON.stringify(d && d.headInsets)} gaps=${JSON.stringify(d && d.boundaryGaps)}`)
        expectOk('E2E-042 深色下標題列高度契約不變', d && d.headMinHeight === '27px', `minHeight=${d && d.headMinHeight}`)
        await shot(page, 'flow-E2E-042-settings-groups-dark', { parkMouse: false })
    }),

    mkCase('E2E-043', 'marker-face-edge-color', async (page) => {
        //spec 契約 §4.3: 箭頭之填色(FaceColor)與框色(EdgeColor)分列; 框色未給時跟隨線色, 給了才脫鉤。
        //真實 user path: ①開連線設定 popup ②展開 Arrows ③點色塊開色票 ④填 RGB ⑤按 Confirm ⑥看箭頭變色
        //demo 之 e3-5: markerFrom='arrow'(線式) / markerTo='arrowclosed'(實心, faceColor #ffa500)
        const markerOf = (endAttr) => page.evaluate((attr) => {
            const path = document.querySelector('.vue-flow__edge[data-id="e3-5"] path[marker-end]')
            const v = path && path.getAttribute(attr)
            const m = v && v.match(/^url\(#(.+)\)$/)
            const el = m ? document.getElementById(m[1]) : null
            if (!el) return null
            const p = el.querySelector('path')
            return { id: m[1], fill: p.getAttribute('fill'), stroke: p.getAttribute('stroke') }
        }, endAttr)
        const connOf = () => evalVm(page, `
            const c = vm.conns.find(c => c.id === 'e3-5')
            return { face: c.markerToFaceColor, edge: c.markerToEdgeColor, fromEdge: c.markerFromEdgeColor, lineColor: c.edgeColor }
        `)

        await clickMenu(page, 'fitView')
        await page.waitForTimeout(400)
        const before = await markerOf('marker-end')
        const lineColor = await evalVm(page, `const c = vm.conns.find(c => c.id === 'e3-5'); return c.edgeColor || vm.defConn.edgeColor`)
        expectOk('E2E-043 前置: to 端為實心箭頭且框色初始跟隨線色',
            !!before && before.fill === '#ffa500' && before.stroke === lineColor,
            `before=${JSON.stringify(before)} lineColor=${lineColor}`)

        await openEdgeSettings(page, 'e3-5')
        await page.waitForTimeout(400)
        await openSettingsGroup(page, 'Arrows')

        //線式箭頭之 Face Color 不可改(fill 恆 none), 但 Edge Color 可改 —— 契約 §4.3 之可改矩陣
        const editable = await page.evaluate(() => {
            const st = {}
            for (const lb of document.querySelectorAll('.vue-flow__settings-form label')) {
                const t = lb.textContent.trim().split('\n')[0].trim()
                const f = lb.querySelector('.vue-flow__field')
                if (f) st[t] = !f.classList.contains('vue-flow__field--disabled')
            }
            return st
        })
        expectOk('E2E-043 線式箭頭: Face 不可改而 Edge 可改',
            editable['From Marker Face Color'] === false && editable['From Marker Edge Color'] === true,
            `editable=${JSON.stringify(editable)}`)
        expectOk('E2E-043 實心箭頭: Face 與 Edge 皆可改',
            editable['To Marker Face Color'] === true && editable['To Marker Edge Color'] === true,
            `editable=${JSON.stringify(editable)}`)

        //開色票但不確認即關閉 → 不得寫回(WColorSelect 曾有「開啟即觸發變更」之缺陷, 於此鎖定)
        await openColorPanel(page, 'To Marker Face Color')
        await fillPanelRgb(page, [10, 20, 30])
        const midConn = await connOf()
        expectOk('E2E-043 填色但未按確認: 資料未寫回', midConn.face === '#ffa500', `face=${midConn.face}`)
        await page.mouse.click(5, 5) //點面板外關閉
        await page.waitForTimeout(500)
        const dismissed = await connOf()
        expectOk('E2E-043 未確認即關閉色票: 資料仍未變', dismissed.face === '#ffa500', `face=${dismissed.face}`)

        //真正改 Face Color
        await openEdgeSettings(page, 'e3-5')
        await page.waitForTimeout(400)
        await openSettingsGroup(page, 'Arrows')
        await pickColor(page, 'To Marker Face Color', [12, 34, 56])
        const afterFace = await connOf()
        const mkFace = await markerOf('marker-end')
        expectOk('E2E-043 Face Color 已寫回 conn', afterFace.face === 'rgba(12, 34, 56, 1)', `face=${afterFace.face}`)
        expectOk('E2E-043 marker 之 fill 隨之改變', !!mkFace && mkFace.fill === 'rgba(12, 34, 56, 1)', `marker=${JSON.stringify(mkFace)}`)
        expectOk('E2E-043 改 Face 不動框色(仍跟隨線色)', !!mkFace && mkFace.stroke === lineColor, `stroke=${mkFace && mkFace.stroke}`)
        expectOk('E2E-043 規格不同即換新 marker id', !!mkFace && mkFace.id !== before.id, `${before.id} → ${mkFace && mkFace.id}`)

        //再改 Edge Color —— 本次新增之能力: 框色脫離線色
        await pickColor(page, 'To Marker Edge Color', [200, 30, 90])
        const afterEdge = await connOf()
        const mkEdge = await markerOf('marker-end')
        expectOk('E2E-043 Edge Color 已寫回 conn', afterEdge.edge === 'rgba(200, 30, 90, 1)', `edge=${afterEdge.edge}`)
        expectOk('E2E-043 marker 之 stroke 改為該色', !!mkEdge && mkEdge.stroke === 'rgba(200, 30, 90, 1)', `marker=${JSON.stringify(mkEdge)}`)
        expectOk('E2E-043 框色已脫離線色(這正是本欄之目的)', !!mkEdge && mkEdge.stroke !== lineColor, `stroke=${mkEdge && mkEdge.stroke} lineColor=${lineColor}`)
        expectOk('E2E-043 Face 與 Edge 各自獨立保留', !!mkEdge && mkEdge.fill === 'rgba(12, 34, 56, 1)', `fill=${mkEdge && mkEdge.fill}`)
        expectOk('E2E-043 發出 conn-settings-update', (await emitted(page)).includes('conn-settings-update'), 'no conn-settings-update')

        //線式箭頭之框色亦可改(它只有描邊, 框色對它才是唯一有效的顏色)
        await pickColor(page, 'From Marker Edge Color', [0, 128, 64])
        const fromEdge = await connOf()
        const mkFrom = await markerOf('marker-start')
        expectOk('E2E-043 線式箭頭之 Edge Color 亦生效',
            fromEdge.fromEdge === 'rgba(0, 128, 64, 1)' && !!mkFrom && mkFrom.stroke === 'rgba(0, 128, 64, 1)' && mkFrom.fill === 'none',
            `conn=${fromEdge.fromEdge} marker=${JSON.stringify(mkFrom)}`)

        //關閉 popup 後拍該邊區域(看得到兩端箭頭之實際顏色)
        await page.mouse.click(5, 5)
        await page.waitForTimeout(400)
        await page.mouse.move(0, 0)
        const pb = await (await page.$('.vue-flow__edge[data-id="e3-5"] path[marker-end]')).boundingBox()
        await shot(page, 'flow-E2E-043-marker-face-edge-color', { clip: clipAround(pb, PAD) })
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
            const page = await openPage(browser, c.opts)
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
