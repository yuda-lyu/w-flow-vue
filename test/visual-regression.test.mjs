/**
 * Visual regression test using Playwright screenshots.
 * Compares current rendering against baseline images pixel-by-pixel.
 *
 * Requires: npm run serve (http://localhost:8080) running
 * Run: node test/visual-regression.test.mjs
 *
 * To regenerate baselines after intentional visual changes:
 *   node test/generate-visual-baselines.mjs
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baselineDir = path.join(__dirname, 'pics')

function comparePNG(baselinePath, currentBuffer, threshold = 0.01) {
    if (!fs.existsSync(baselinePath)) {
        return { match: false, reason: 'Baseline not found: ' + baselinePath }
    }
    const baseline = PNG.sync.read(fs.readFileSync(baselinePath))
    const current = PNG.sync.read(currentBuffer)
    if (baseline.width !== current.width || baseline.height !== current.height) {
        return { match: false, reason: `Size: ${baseline.width}x${baseline.height} vs ${current.width}x${current.height}` }
    }
    let diffPixels = 0
    const total = baseline.width * baseline.height
    for (let i = 0; i < baseline.data.length; i += 4) {
        let d = Math.abs(baseline.data[i] - current.data[i]) + Math.abs(baseline.data[i + 1] - current.data[i + 1]) + Math.abs(baseline.data[i + 2] - current.data[i + 2])
        if (d > 30) diffPixels++
    }
    let diffRatio = diffPixels / total
    return { match: diffRatio <= threshold, diffRatio, diffPixels, total }
}

let passed = 0, failed = 0, errors = []

async function assert(name, result) {
    if (result.match) {
        passed++
        console.log(`  ✓ ${name}`)
    } else {
        failed++
        let msg = result.reason || `${(result.diffRatio * 100).toFixed(2)}% diff (${result.diffPixels}/${result.total})`
        errors.push(`${name}: ${msg}`)
        console.log(`  ✗ ${name} — ${msg}`)
    }
}

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
            if (el.__vue__ && el.__vue__.setViewport) {
                vm = el.__vue__
                break
            }
        }
        if (!vm) return false
        let n = vm.nodes.find(n => n.id === id)
        if (!n) return false
        let cw = vm.widthInp
        let ch = vm.heightInp
        let w = n.width || 100
        let h = n.height || 40
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
            if (el.__vue__ && el.__vue__.fitView) {
                el.__vue__.fitView(30)
                return
            }
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

    console.log('Visual Regression Tests\n')
    const pad = 60

    // 1. Overview — fitView to show all nodes
    await fitView(page)
    await page.waitForTimeout(500)
    let canvasClip = await getCanvasClip(page)
    let buf = await page.screenshot({ clip: canvasClip })
    await assert('overview', comparePNG(path.join(baselineDir, 'vb-overview.png'), buf))

    // 2. Each node — center on node, clip with padding (includes surrounding edges)
    let nodes = await page.$$('.vue-flow__node')
    for (let node of nodes) {
        let id = await node.getAttribute('data-id')
        if (!id) continue
        let bp = path.join(baselineDir, `vb-node-${id}.png`)
        if (!fs.existsSync(bp)) continue
        await centerOnNode(page, id)
        await page.waitForTimeout(300)
        let box = await node.boundingBox()
        if (!box) continue
        let clip = clipAround(box, pad)
        if (!clip) continue
        buf = await page.screenshot({ clip })
        await assert(`node-${id}`, comparePNG(bp, buf))
    }

    // 3. Node hovered — resize handles + settings icon
    let firstNode = nodes[0]
    let firstId = firstNode ? await firstNode.getAttribute('data-id') : null
    if (firstNode && firstId) {
        await centerOnNode(page, firstId)
        await page.waitForTimeout(300)
        let box = await firstNode.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(500)
        box = await firstNode.boundingBox()
        buf = await page.screenshot({ clip: clipAround(box, pad) })
        await assert('node-hovered', comparePNG(path.join(baselineDir, 'vb-node-hovered.png'), buf))
        await page.mouse.move(0, 0)
        await page.waitForTimeout(300)
    }

    // 4. Node selected
    if (firstNode && firstId) {
        await centerOnNode(page, firstId)
        await page.waitForTimeout(300)
        await firstNode.click()
        await page.waitForTimeout(300)
        let box = await firstNode.boundingBox()
        buf = await page.screenshot({ clip: clipAround(box, pad) })
        await assert('node-selected', comparePNG(path.join(baselineDir, 'vb-node-selected.png'), buf))
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
            buf = await page.screenshot({ clip: clipAround(box, 40) })
            await assert('edge-hovered', comparePNG(path.join(baselineDir, 'vb-edge-hovered.png'), buf))
            await page.mouse.move(0, 0)
            await page.waitForTimeout(300)
        }
    }

    // 6. Edges normal
    await fitView(page)
    await page.waitForTimeout(500)
    buf = await page.screenshot({ clip: canvasClip })
    await assert('edges-normal', comparePNG(path.join(baselineDir, 'vb-edges-normal.png'), buf))

    // ===== LOCKED STATE =====
    console.log('')
    let lockBtn = await page.$('.vue-flow__controls button[title="Lock"]')
    if (lockBtn) {
        await lockBtn.click()
        await page.waitForTimeout(500)
    }

    // 7. Locked overview
    buf = await page.screenshot({ clip: canvasClip })
    await assert('locked-overview', comparePNG(path.join(baselineDir, 'vb-locked-overview.png'), buf))

    // 8. Locked node hovered — no resize handles, no settings icon, no handles
    if (firstNode && firstId) {
        await centerOnNode(page, firstId)
        await page.waitForTimeout(300)
        let box = await firstNode.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(500)
        box = await firstNode.boundingBox()
        buf = await page.screenshot({ clip: clipAround(box, pad) })
        await assert('locked-node-hovered', comparePNG(path.join(baselineDir, 'vb-locked-node-hovered.png'), buf))
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
        buf = await page.screenshot({ clip: clipAround(box, pad) })
        await assert('locked-node-selected', comparePNG(path.join(baselineDir, 'vb-locked-node-selected.png'), buf))
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
            buf = await page.screenshot({ clip: clipAround(box, 40) })
            await assert('locked-edge-hovered', comparePNG(path.join(baselineDir, 'vb-locked-edge-hovered.png'), buf))
            await page.mouse.move(0, 0)
            await page.waitForTimeout(300)
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`)
    if (errors.length > 0) {
        console.log('\nFailed:')
        errors.forEach(e => console.log('  ' + e))
    }

    await browser.close()
    process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })