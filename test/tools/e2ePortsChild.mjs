//供 unit-e2ePorts 以子行程載入 e2ePorts.mjs 並回報保留結果(配套工具, 非測試檔; 不載入 playwright)。
//  輸出最後一行: @@RESULT <JSON>
//  環境變數 FV309_HOLD_FILE: 設定時, 回報後持有保留直到該檔案出現(上限 60 秒), 供「兩個行程同時保留」之測試; 結束時保留隨行程釋放。
import fs from 'fs'
import { FRONTEND_PORT, OTHER_TEST_PORTS, reservation } from './e2ePorts.mjs'

console.log('@@RESULT ' + JSON.stringify({
    source: reservation.source,
    offset: reservation.offset,
    shifted: reservation.shifted,
    ports: reservation.ports,
    base: FRONTEND_PORT,
    avoid: OTHER_TEST_PORTS,
    env: { E2E_PORT_OFFSET: process.env.E2E_PORT_OFFSET === undefined ? null : process.env.E2E_PORT_OFFSET, hold: !!process.env.E2E_PORT_HOLD },
}))

const holdFile = process.env.FV309_HOLD_FILE
if (holdFile) {
    const t0 = Date.now()
    while (!fs.existsSync(holdFile) && Date.now() - t0 < 60000) {
        await new Promise((r) => setTimeout(r, 100))
    }
}
