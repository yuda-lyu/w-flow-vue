/**
 * Generate routing snapshot data for all 4×4×36 = 576 combinations.
 * - 4 source handle positions (top/bottom/left/right)
 * - 4 target handle positions (top/bottom/left/right)
 * - 36 angles (0°–350° in 10° steps): B position around A
 *
 * Based on AppExamConnectivity.vue defaults:
 *   A center: (350, 250), Node size: 100×40, Offset: 200
 */
import { calculateStepPoints, clearStepCache } from '../src/js/step-routing.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CENTER_X = 350
const CENTER_Y = 250
const OFFSET = 200
const NODE_W = 100
const NODE_H = 40
const BUF = 24

const positions = ['top', 'bottom', 'left', 'right']

// Handle position on node edge
function handleXY(pos, nx, ny, w, h) {
    switch (pos) {
    case 'top': return { x: nx + w / 2, y: ny }
    case 'bottom': return { x: nx + w / 2, y: ny + h }
    case 'left': return { x: nx, y: ny + h / 2 }
    case 'right': return { x: nx + w, y: ny + h / 2 }
    }
}

let allCases = []

for (let srcPos of positions) {
    for (let tgtPos of positions) {
        for (let deg = 0; deg < 360; deg += 10) {
            let rad = deg * Math.PI / 180
            let bx = Math.round(CENTER_X + OFFSET * Math.cos(rad))
            let by = Math.round(CENTER_Y - OFFSET * Math.sin(rad)) // Y-axis inverted

            let sH = handleXY(srcPos, CENTER_X, CENTER_Y, NODE_W, NODE_H)
            let tH = handleXY(tgtPos, bx, by, NODE_W, NODE_H)

            let nodes = [
                { id: 'A', position: { x: CENTER_X, y: CENTER_Y }, width: NODE_W, height: NODE_H },
                { id: 'B', position: { x: bx, y: by }, width: NODE_W, height: NODE_H },
            ]

            clearStepCache()
            let pts = calculateStepPoints(
                sH.x, sH.y, srcPos,
                tH.x, tH.y, tgtPos,
                BUF, nodes, {}, 'A', 'B'
            )

            allCases.push({
                srcPos,
                tgtPos,
                deg,
                aPos: { x: CENTER_X, y: CENTER_Y },
                bPos: { x: bx, y: by },
                sourceXY: sH,
                targetXY: tH,
                pts,
            })
        }
    }
}

let outPath = path.join(__dirname, 'jsons', 'routing-snapshots.json')
fs.writeFileSync(outPath, JSON.stringify(allCases, null, 2))
console.log(`Generated ${allCases.length} cases → ${outPath}`)
