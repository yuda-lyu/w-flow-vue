/**
 * Generate visual baseline screenshots for regression testing.
 * Requires: npm run serve (http://localhost:8080) running
 * Usage: node test/generate-visual-baselines.mjs
 */
import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, 'pics')

const VW = 1280
const VH = 900

/** Clip a region around a bounding box with padding, clamped to viewport */
function clipAround(box, pad) {
    let x = Math.max(0, Math.floor(box.x - pad))
    let y = Math.max(0, Math.floor(box.y - pad))
    let w = Math.min(Math.ceil(box.width + pad * 2), VW - x)
    let h = Math.min(Math.ceil(box.height + pad * 2), VH - y)
    if (w < 1 || h < 1) return null
    return { x, y, width: w, height: h }
}

/** Center viewport on a node by its data id */
function centerOnNode(page, nodeId) {
    return page.evaluate((id) => {
        let vm
        for (let el of document.querySelectorAll('*')) {
            if (el.__vue__ && el.__vue__.setViewport) { vm = el.__vue__; break }
        }
        if (!vm) return false
        let n = vm.nodes.find(n => n.id === id)
        if (!n) return false
        let cw = vm.widthInp, ch = vm.heightInp
        let w = n.width || 100, h = n.height || 40
        vm.setViewport({ x: cw / 2 - (n.position.x + w / 2), y: ch / 2 - (n.position.y + h / 2), zoom: 1 })
        return true
    }, nodeId)
}

/** Reset viewport to origin */
function resetViewport(page) {
    return page.evaluate(() => {
        for (let el of document.querySelectorAll('*')) {
            if (el.__vue__ && el.__vue__.setViewport) {
                el.__vue__.setViewport({ x: 0, y: 0, zoom: 1 })
                return
            }
        }
    })
}

/** fitView to show all nodes */
function fitView(page) {
    return page.evaluate(() => {
        for (let el of document.querySelectorAll('*')) {
            if (el.__vue__ && el.__vue__.fitView) { el.__vue__.fitView(30); return }
        }
    })
}

/** Get the canvas container clip region */
function getCanvasClip(page) {
    return page.evaluate(() => {
        let el = document.querySelector('.vue-flow__viewport')
        if (!el) return null
        let container = el.closest('[style*="height"]')
        if (!container) return null
        let rect = container.getBoundingClientRect()
        return { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height) }
    })
}

async function run() {
    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: VW, height: VH } })
    await page.goto('http://localhost:8080')
    await page.waitForTimeout(2000)

    const pad = 60

    // 1. Overview — fitView to show all nodes
    await fitView(page)
    await page.waitForTimeout(500)
    let canvasClip = await getCanvasClip(page)
    await page.screenshot({ path: path.join(outDir, 'vb-overview.png'), clip: canvasClip })

    // 2. Each node — center on node, clip with padding (includes surrounding edges)
    let nodes = await page.$$('.vue-flow__node')
    for (const node of nodes) {
        const id = await node.getAttribute('data-id')
        if (!id) continue
        await centerOnNode(page, id)
        await page.waitForTimeout(300)
        let box = await node.boundingBox()
        if (!box) continue
        let clip = clipAround(box, pad)
        if (!clip) continue
        await page.screenshot({ path: path.join(outDir, `vb-node-${id}.png`), clip })
    }

    // 3. Node hovered (first node) — resize handles + settings icon
    let firstNode = nodes[0]
    let firstId = firstNode ? await firstNode.getAttribute('data-id') : null
    if (firstNode && firstId) {
        await centerOnNode(page, firstId)
        await page.waitForTimeout(300)
        let box = await firstNode.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(500)
        box = await firstNode.boundingBox()
        await page.screenshot({ path: path.join(outDir, 'vb-node-hovered.png'), clip: clipAround(box, pad) })
        await page.mouse.move(0, 0)
        await page.waitForTimeout(300)
    }

    // 4. Node selected (click first node)
    if (firstNode && firstId) {
        await centerOnNode(page, firstId)
        await page.waitForTimeout(300)
        await firstNode.click()
        await page.waitForTimeout(300)
        let box = await firstNode.boundingBox()
        await page.screenshot({ path: path.join(outDir, 'vb-node-selected.png'), clip: clipAround(box, pad) })
        await page.mouse.click(10, 10)
        await page.waitForTimeout(300)
    }

    // 5. Edge hovered — settings icon
    await resetViewport(page)
    await page.waitForTimeout(300)
    let edges = await page.$$('.vue-flow__edge-interaction')
    if (edges.length > 0) {
        let box = await edges[0].boundingBox()
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            await page.waitForTimeout(500)
            box = await edges[0].boundingBox()
            await page.screenshot({ path: path.join(outDir, 'vb-edge-hovered.png'), clip: clipAround(box, 40) })
            await page.mouse.move(0, 0)
            await page.waitForTimeout(300)
        }
    }

    // 6. Edges normal (overview, no hover)
    await fitView(page)
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(outDir, 'vb-edges-normal.png'), clip: canvasClip })

    // ===== LOCKED STATE =====
    let lockBtn = await page.$('.vue-flow__controls button[title="Lock"]')
    if (lockBtn) {
        await lockBtn.click()
        await page.waitForTimeout(500)
    }

    // 7. Locked overview
    await page.screenshot({ path: path.join(outDir, 'vb-locked-overview.png'), clip: canvasClip })

    // 8. Locked node hovered — no resize handles, no settings icon, no handles
    if (firstNode && firstId) {
        await centerOnNode(page, firstId)
        await page.waitForTimeout(300)
        let box = await firstNode.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(500)
        box = await firstNode.boundingBox()
        await page.screenshot({ path: path.join(outDir, 'vb-locked-node-hovered.png'), clip: clipAround(box, pad) })
        await page.mouse.move(0, 0)
        await page.waitForTimeout(300)
    }

    // 9. Locked node selected
    if (firstNode && firstId) {
        await centerOnNode(page, firstId)
        await page.waitForTimeout(300)
        await firstNode.click()
        await page.waitForTimeout(300)
        let box = await firstNode.boundingBox()
        await page.screenshot({ path: path.join(outDir, 'vb-locked-node-selected.png'), clip: clipAround(box, pad) })
        await page.mouse.click(10, 10)
        await page.waitForTimeout(300)
    }

    // 10. Locked edge hovered — no settings icon
    await resetViewport(page)
    await page.waitForTimeout(300)
    if (edges.length > 0) {
        let box = await edges[0].boundingBox()
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            await page.waitForTimeout(500)
            box = await edges[0].boundingBox()
            await page.screenshot({ path: path.join(outDir, 'vb-locked-edge-hovered.png'), clip: clipAround(box, 40) })
            await page.mouse.move(0, 0)
            await page.waitForTimeout(300)
        }
    }

    console.log('Visual baselines generated in test/pics/')
    await browser.close()
}

run().catch(e => { console.error(e); process.exit(1) })