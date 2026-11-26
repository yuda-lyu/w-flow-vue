//供 unit-e2eLaunch／unit-e2eCdn／api-e2eLaunch 以真實子行程載入 e2eLaunch.mjs 並回報啟動點送出之選項與路由接線(配套工具, 非測試檔)。
//用法: node test/tools/e2eLaunchChild.mjs <fake|real|hookfail|unrouted>
//  fake:     以 wpw.setBrowserTypeForTest 之替身接住啟動(不啟動任何瀏覽器), 回報替身收到之「合併後」選項
//  real:     替身只記錄選項, 再以 next() 走真路徑啟動 headless shell(經 w-playwright), 取版本後關閉
//  hookfail: 同 fake, 但植入「cdn.routeBrowser 回 rejected Promise」, 回報啟動出口之拒絕形態(code、替身瀏覽器是否被關閉、原錯誤是否印出)
//  unrouted: 同 fake, 但植入「cdn.isRouted 恆回 false」(模擬鉤子未註冊或被還原之漏接), 回報啟動出口之失敗閉鎖(拒絕、替身瀏覽器是否被關閉)
//輸出最後一行為 `RESULT:<json>`。為何用子行程: 沿用 e2ePortsChild 之作法——啟動點與替身取自同一份真實 node 載入之 w-playwright(jest 有自己的模組登錄表且為 jsdom 環境, 替身未必與啟動點共用同一份模組), 真路徑也在乾淨之 node 行程中跑。
//
//路由接線之回報(排程第 651 項: 路由由 e2eCdn.mjs 載入時註冊之 wpw.onBrowserCreated 鉤子掛上, 啟動出口不自行掛):
//  routeCalls:      cdn.routeBrowser 於本行程被呼叫之次數(以 spy 包住; 一次啟動須恰 1 次——啟動出口若又自行掛路由會變 2 次)
//  routedAtProbe:   本檔於 e2eCdn 之鉤子「之後」註冊之探針鉤子所見之 cdn.isRouted(target)——鉤子串行依註冊順序執行, 為 true 即證明路由於啟動後鉤子階段(wpw.launchChromium 回傳前)已掛上,
//                   不是啟動出口於回傳後才補掛
import wpw from 'w-playwright'
import launchE2eBrowser, { ensureE2eBrowser } from './e2eLaunch.mjs'
import { cdn } from './e2eCdn.mjs'

const mode = ['real', 'hookfail', 'unrouted'].includes(process.argv[2]) ? process.argv[2] : 'fake'
const seen = []
let closeCalls = 0

//替身瀏覽器: 具 routeBrowser 所需之最小介面(newContext／newPage／contexts／close), 使啟動後鉤子之掛路由步驟走真實路徑而不啟動瀏覽器
function makeFakeBrowser() {
    return {
        async close() {
            closeCalls++
        },
        version: () => 'fake',
        contexts: () => [],
        async newContext() {
            return {}
        },
        async newPage() {
            return {}
        },
    }
}

//只取斷言需要之欄位(undefined 以旗標表示, 避免 JSON 序列化吃掉)
function snapshot(opt) {
    return {
        args: opt.args,
        ignoreDefaultArgs: opt.ignoreDefaultArgs,
        headless: opt.headless,
        channelUndefined: opt.channel === undefined,
        executablePathUndefined: opt.executablePath === undefined,
        hasIgnoreAll: Object.prototype.hasOwnProperty.call(opt, 'ignoreAllDefaultArgs'),
    }
}

//spy: 計 cdn.routeBrowser 之呼叫次數(e2eCdn 之鉤子處理器以屬性查找呼叫, 故包住有效); hookfail 時植入失敗
//失敗之形態與真 routeBrowser 相同(async 函數: 回 rejected Promise, 不同步拋錯), 使「處理器未回傳該 Promise 即成為未處理之 rejection、啟動不失敗」之缺陷會被抓到
let routeCalls = 0
const routeBrowserOrig = cdn.routeBrowser
cdn.routeBrowser = (...a) => {
    routeCalls++
    if (mode === 'hookfail') return Promise.reject(new Error('route failed(測試植入)'))
    return routeBrowserOrig.apply(cdn, a)
}

//unrouted: 令啟動出口之 cdn.isRouted 斷言必敗(其以屬性查找呼叫, 故覆寫有效)
if (mode === 'unrouted') cdn.isRouted = () => false

//探針鉤子(註冊於 e2eCdn 之鉤子之後): 記錄輪到它時 target 是否已掛路由
let routedAtProbe = null
const restoreProbe = wpw.onBrowserCreated((target) => {
    routedAtProbe = cdn.isRouted(target)
})

//收集 [e2e-browser] 行(啟動出口於鉤子失敗時印出原錯誤), 仍照常輸出
const logs = []
const logOrig = console.log
console.log = (...a) => {
    const s = a.join(' ')
    if (s.startsWith('[e2e-browser]')) logs.push(s)
    logOrig(...a)
}

const restore = wpw.setBrowserTypeForTest({
    async launch(opt, next) {
        seen.push(snapshot(opt))
        if (mode === 'real') return next()
        return makeFakeBrowser()
    },
    async launchPersistentContext() {
        throw new Error('e2e 啟動點不應呼叫 launchPersistentContext')
    },
})

let out = { mode, calls: 0, seen, version: '', tableMatch: null, coreVersion: '', routed: false, routeCalls: 0, routedAtProbe: null, closeCalls: 0, errCode: null, errMsg: '', logs: [] }
try {
    //真路徑: 啟動一律不安裝(autoInstall: false), 故先集中取得受管瀏覽器(時限為安裝預算; 已安裝者只做檢查)
    if (mode === 'real') await ensureE2eBrowser()
    //啟動出口拒絕(hookfail 為預期; 其餘模式為接線錯誤, 如鉤子未註冊而被出口之 isRouted 斷言擋下)皆記 errCode／errMsg 回報, 不讓子行程崩潰(測試端得到可讀之斷言失敗)
    let browser = null
    try {
        browser = await launchE2eBrowser()
    }
    catch (err) {
        out.errCode = err && err.code
        out.errMsg = err && err.message
    }
    if (browser) {
        out.routed = cdn.isRouted(browser)
        out.version = browser.version()
        await browser.close()
    }
}
finally {
    restore()
    restoreProbe()
    console.log = logOrig
}
const info = wpw.getPlaywrightInfo()
out.calls = seen.length
out.tableMatch = info.tableMatch
out.coreVersion = info.coreVersion
out.routeCalls = routeCalls
out.routedAtProbe = routedAtProbe
out.closeCalls = closeCalls
out.logs = logs
console.log('RESULT:' + JSON.stringify(out))
