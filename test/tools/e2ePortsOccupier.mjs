//測試用占用者(配套工具, 非測試檔): 在指定埠起一個真實 HTTP 監聽(模擬「別的套件正在跑之服務」), 每個請求記一行到 log。
//用法: node e2ePortsOccupier.mjs <port> <logfile> [host]
//  log 行: `<毫秒> listening pid=… port=… host=…` | `<毫秒> hit <METHOD> <url>`(被測碼打到) | `<毫秒> probe <METHOD> <url>`(測試端自己探測, 帶 x-fv309-probe 標頭) | `<毫秒> error <code>`(綁定失敗, 離開碼 3)
import fs from 'fs'
import http from 'http'

const port = Number(process.argv[2])
const fpLog = process.argv[3]
const host = process.argv[4] || undefined //未給則同 node 預設(雙棧 ::)
const server = http.createServer((req, res) => {
    const kind = req.headers['x-fv309-probe'] ? 'probe' : 'hit'
    fs.appendFileSync(fpLog, `${Date.now()} ${kind} ${req.method} ${req.url}\n`)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ occupier: true, pid: process.pid, port }))
})
server.on('error', (err) => {
    fs.appendFileSync(fpLog, `${Date.now()} error ${err.code || err.message}\n`)
    process.exit(3)
})
server.listen(port, host, () => {
    fs.appendFileSync(fpLog, `${Date.now()} listening pid=${process.pid} port=${port} host=${host || '(default)'}\n`)
})
