//假 dev server(配套工具, 非測試檔): 供 unit-e2ePorts 驗證 e2e-setup 之埠接線——在 127.0.0.1:<埠> 回應固定字串,
//並仿 vue-cli 於首編完成後印出 `- Local:   http://127.0.0.1:<埠>/`(供 startServers 核對實際綁定埠)。
//用法: node e2eFakeDevServer.mjs <port> [printedDelta]
//  printedDelta: 印出之埠 = port + printedDelta(預設 0); 非 0 用來仿 vue-cli portfinder 靜默改埠(實際綁定埠與輸出之埠不一致的情形之反面: 輸出之埠即 vue-cli 實際使用者)。
import http from 'http'

const port = Number(process.argv[2])
const printedDelta = Number(process.argv[3] || 0)
const HOST = '127.0.0.1'
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('fv309-fake-dev-server')
})
server.on('error', (err) => {
    console.error(`fake dev server error ${err.code || err.message}`)
    process.exit(3)
})
server.listen(port, HOST, () => {
    console.log(`  App running at:\n  - Local:   http://${HOST}:${port + printedDelta}/ \n`)
})
