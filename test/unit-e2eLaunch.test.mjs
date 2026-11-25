/**
 * e2e 啟動瀏覽器一律經 w-playwright(排程第 442 項; 規則帳本 R-WPW-LAUNCH-01; w-playwright 帳本 R-PW-ONLY／R-PW-WIRING)。
 *
 * 背景: Chromium 系瀏覽器每啟動一個新根行程即可能觸發一次錯誤密碼登入紀錄, w-playwright 於每次啟動合併出恰一串 `--disable-features`
 * (含守門功能)。本套件 e2e 以 `test/tools/e2eLaunch.mjs` 為唯一啟動點, 其下一律走 `wpw.launchChromium`。
 *
 * 本檔不啟動任何瀏覽器(接線以 setBrowserTypeForTest 之替身接住; 真路徑見 api-e2eLaunch)。
 *
 * 項目:
 *  EL-1  R-PW-ONLY:  repo 內(排除 node_modules／dist／docs 等產物)之 .mjs／.js／.cjs 不得匯入 playwright／playwright-core(靜態、動態、require)
 *  EL-2  依賴:       package.json 不宣告 playwright／playwright-core; w-playwright 為 devDependencies(下限 1.0.1)、不入 dependencies
 *  EL-3  站點全集:   e2e-flow 不再引用 w-package-tools-e2e 之 launchChromium(該套件將移除); 直接 launch 呼叫 0; wpw.launchChromium( 只在 e2eLaunch.mjs 一處
 *  EL-4  R-PW-WIRING: 啟動點送出之選項含守門(args 最後一個元素為合併之 --disable-features 且含 AutofillAiWalletPrivatePasses、全命令列恰一串),
 *                    且為 headless shell 之形態(無頭、不給通道與執行檔); 替身確被呼叫(次數 1); 啟動出口回傳之瀏覽器已掛 CDN 本地副本路由(R-CDN-01, 見 unit-e2eCdn)
 *  EL-6  R-WPW-INSTALL-01(排程第 632 項): 受管瀏覽器集中取得、啟動不安裝
 *        ①安裝預算 PW_INSTALL_BUDGET_MS ≥ 600000 且為 ensureChromium 之 timeout(替身子行程核對傳入之選項、同行程只取一次、真下載項數之計算)
 *        ②autoInstall 全 repo 之程式碼只有啟動出口之 false 一處, 無 true
 *        ③站點全集: 啟動瀏覽器之入口(呼叫 launchE2eBrowser 之非測試檔)皆先 await ensureE2eBrowser(); e2e-flow 之取得早於 startServers 早於首次啟動
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

jest.setTimeout(120000)

const projRoot = path.resolve(__dirname, '..')
const CHILD = path.join(__dirname, 'tools', 'e2eLaunchChild.mjs')

//R-PW-ONLY 盤點用之正則(與 w-playwright 帳本同源); 下列片段以串接組字, 避免本檔原文被自己的盤點命中
const PW = 'play' + 'wright'
const RE_IMPORT = /(from\s+|import\(\s*|require\(\s*)['"`]playwright(-core)?['"`/]/

//掃描範圍: repo 內自有之 .mjs／.js／.cjs; 排除第三方、建置產物、暫存與圖檔
const SKIP_DIRS = new Set(['node_modules', 'dist', 'docs', 'tmp', 'testPending', '.git', 'public', '_tmp', 'pics'])
function walk(dir, out) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.isDirectory()) {
            if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name), out)
        }
        else if (/\.(mjs|js|cjs)$/.test(ent.name)) {
            out.push(path.join(dir, ent.name))
        }
    }
    return out
}
const FILES = walk(projRoot, [])
const rel = (f) => path.relative(projRoot, f).replace(/\\/g, '/')

function runChild(mode) {
    const r = spawnSync(process.execPath, [CHILD, mode], { cwd: projRoot, encoding: 'utf8', windowsHide: true, timeout: 100000 })
    const line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
    if (!line) throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
    return JSON.parse(line.slice('RESULT:'.length))
}

describe('EL-1 R-PW-ONLY: 不得直接匯入 playwright／playwright-core', () => {
    test('盤點正則對五種寫法皆命中(防空集合: 正例)', () => {
        const samples = [
            `import { chromium } from '${PW}'`,
            `import { chromium } from "${PW}-core"`,
            `const m = await import('${PW}')`,
            `const m = require("${PW}-core")`,
            `import x from '${PW}/lib/foo.js'`,
        ]
        for (const s of samples) expect(RE_IMPORT.test(s)).toBe(true)
        //負例: w-playwright 與其他套件名不命中
        expect(RE_IMPORT.test(`import wpw from 'w-${PW}'`)).toBe(false)
        expect(RE_IMPORT.test(`import x from '${PW}x'`)).toBe(false)
    })

    test('掃描範圍非空(防空集合): 含 e2e 主檔與本檔, 檔數合理', () => {
        const rels = FILES.map(rel)
        expect(rels).toContain('test/e2e-flow.test.mjs')
        expect(rels).toContain('test/unit-e2eLaunch.test.mjs')
        expect(rels.some((r) => r.startsWith('src/'))).toBe(true)
        expect(rels.some((r) => r.startsWith('toolg/'))).toBe(true)
        expect(FILES.length).toBeGreaterThan(30)
    })

    test('src／test／toolg 等自有碼匯入 playwright／playwright-core 者 0 處', () => {
        const hits = []
        for (const f of FILES) {
            const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
            lines.forEach((ln, i) => {
                if (RE_IMPORT.test(ln)) hits.push(`${rel(f)}:${i + 1}: ${ln.trim()}`)
            })
        }
        expect(hits).toEqual([])
    })
})

describe('EL-2 依賴宣告', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(projRoot, 'package.json'), 'utf8'))

    test('package.json 不宣告 playwright／playwright-core', () => {
        for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
            const o = pkg[k] || {}
            expect(Object.keys(o).filter((n) => n === PW || n === PW + '-core')).toEqual([])
        }
    })

    test('w-playwright 為 devDependencies(下限 1.0.1)且不入 dependencies(僅測試使用, 不入 dist)', () => {
        const range = (pkg.devDependencies || {})['w-' + PW]
        expect(typeof range).toBe('string')
        const m = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range)
        expect(m).not.toBeNull()
        const v = [Number(m[1]), Number(m[2]), Number(m[3])]
        const min = [1, 0, 1]
        const ok = v[0] > min[0] || (v[0] === min[0] && (v[1] > min[1] || (v[1] === min[1] && v[2] >= min[2])))
        expect(ok).toBe(true)
        expect((pkg.dependencies || {})['w-' + PW]).toBeUndefined()
    })
})

describe('EL-3 啟動點站點全集', () => {
    const e2eMain = fs.readFileSync(path.join(__dirname, 'e2e-flow.test.mjs'), 'utf8')

    test('e2e-flow 不再引用 w-package-tools-e2e 之 launchChromium(該套件將移除之匯出)', () => {
        expect(/w-package-tools-e2e\/src\/launchChromium/.test(e2eMain)).toBe(false)
        const all = FILES.filter((f) => /w-package-tools-e2e\/src\/launchChromium/.test(fs.readFileSync(f, 'utf8')) && rel(f) !== 'test/unit-e2eLaunch.test.mjs')
        expect(all.map(rel)).toEqual([])
    })

    test('e2e-flow 經 ./tools/e2eLaunch.mjs 啟動, 且主檔無任何直接 launch 呼叫', () => {
        expect(/from\s+'\.\/tools\/e2eLaunch\.mjs'/.test(e2eMain)).toBe(true)
        expect(/launchE2eBrowser\(\)/.test(e2eMain)).toBe(true)
        expect(/\.launch\w*\(/.test(e2eMain)).toBe(false)
    })

    test('wpw.launchChromium( 於 src 0 處、於 test 只在 e2eLaunch.mjs 一處(不含本檔與子行程配套之說明文字)', () => {
        const re = /\bwpw\.(launchChromium|launchChromiumPersistent)\(/
        const hits = []
        for (const f of FILES) {
            const r = rel(f)
            if (r === 'test/unit-e2eLaunch.test.mjs' || r === 'test/api-e2eLaunch.test.mjs') continue
            fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((ln, i) => {
                if (re.test(ln) && !/^\s*\/\//.test(ln)) hits.push(`${r}:${i + 1}`)
            })
        }
        expect(hits.length).toBe(1)
        expect(hits[0].startsWith('test/tools/e2eLaunch.mjs:')).toBe(true)
    })
})

describe('EL-4 R-PW-WIRING: 啟動點送出之選項含守門(替身接住, 不啟動瀏覽器)', () => {
    let r
    beforeAll(() => {
        r = runChild('fake')
    })

    test('替身確被呼叫恰 1 次(依賴樹有兩份 w-playwright 時未斷言即可能空過)', () => {
        expect(r.calls).toBe(1)
    })

    test('內附表與實裝之 playwright-core 版本吻合(否則 w-playwright 會拒絕啟動)', () => {
        expect(r.tableMatch).toBe(true)
        //實裝版本須等於 w-playwright 所釘者(版本所有權在 w-playwright, 不寫死哪一版; 2026-11-21 升 1.65.1 時之殷鑑)
        const pin = JSON.parse(fs.readFileSync(path.join(projRoot, 'node_modules', 'w-' + PW, 'package.json'), 'utf8')).dependencies[PW + '-core']
        expect(pin).toMatch(/^\d+\.\d+\.\d+$/)
        expect(r.coreVersion).toBe(pin)
    })

    test('命令列恰一串 --disable-features, 為 args 最後一個元素, 且含守門功能 AutofillAiWalletPrivatePasses', () => {
        const args = r.seen[0].args
        const dis = args.filter((a) => /^--disable-features=/i.test(a))
        expect(dis.length).toBe(1)
        expect(args[args.length - 1]).toBe(dis[0])
        expect(dis[0].split('=')[1].split(',')).toContain('AutofillAiWalletPrivatePasses')
    })

    test('以 ignoreDefaultArgs 去掉 Playwright 預設之那一串 --disable-features(使命令列只剩本套件合併之一串)', () => {
        const ign = r.seen[0].ignoreDefaultArgs
        expect(Array.isArray(ign)).toBe(true)
        expect(ign.some((a) => /^--disable-features=/i.test(a))).toBe(true)
        expect(r.seen[0].hasIgnoreAll).toBe(false)
    })

    test('headless shell 形態(無頭、不給通道與執行檔): 與修前 chromium.launch() 之瀏覽器種類相同, 非真 Chrome／Edge／完整 Chromium', () => {
        expect(r.seen[0].headless).not.toBe(false)
        expect(r.seen[0].channelUndefined).toBe(true)
        expect(r.seen[0].executablePathUndefined).toBe(true)
    })

    test('單一啟動出口回傳之瀏覽器已掛 CDN 本地副本路由(R-CDN-01; 替身瀏覽器走真實之 routeBrowser)', () => {
        expect(r.routed).toBe(true)
    })
})

describe('EL-6 R-WPW-INSTALL-01: 受管瀏覽器集中取得、啟動不安裝', () => {
    const SRC_LAUNCH = fs.readFileSync(path.join(__dirname, 'tools', 'e2eLaunch.mjs'), 'utf8')
    //去註解(行註解與區塊註解; 字串內之 // 以負向後瞻避開), 供程式碼之結構斷言
    const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
    const CODE_LAUNCH = strip(SRC_LAUNCH)

    function runEnsureChild(mode = 'ok') {
        const f = path.join(__dirname, 'tools', 'e2eEnsureChild.mjs')
        const r = spawnSync(process.execPath, [f, mode], { cwd: projRoot, encoding: 'utf8', windowsHide: true, timeout: 100000 })
        const line = String(r.stdout || '').split(/\r?\n/).reverse().find((s) => s.startsWith('RESULT:'))
        if (!line) throw new Error(`子行程未回報結果 status=${r.status} stderr=${String(r.stderr || '').slice(-1500)}`)
        return JSON.parse(line.slice('RESULT:'.length))
    }

    test('安裝預算為 900000(15 分鐘), 不低於 w-playwright 自身測試對同一操作之 600000', () => {
        const m = /const PW_INSTALL_BUDGET_MS = (\d+)/.exec(CODE_LAUNCH)
        expect(m).not.toBeNull()
        expect(Number(m[1])).toBe(900000)
        expect(Number(m[1])).toBeGreaterThanOrEqual(600000)
    })

    test('ensureE2eBrowser 以安裝預算呼叫 ensureChromium(替身接住, 不下載): 時限為預算、有 funLog、同行程只呼叫 1 次', () => {
        const r = runEnsureChild()
        expect(r.calls.length).toBe(1)
        expect(r.calls[0].timeout).toBe(r.budget)
        expect(r.budget).toBe(900000)
        expect(r.calls[0].hasFunLog).toBe(true)
        expect(r.samePromise).toBe(true)
        expect(r.sameResult).toBe(true)
        expect(r.kind).toBe('headless-shell')
    })

    test('真下載項數只計 install-output 之 Downloading 行(去終端機控制碼): 替身給 2 行有效、1 行他標籤、1 行非 Downloading → 2 項', () => {
        expect(runEnsureChild().downloads).toBe(2)
    })

    test('取得失敗(含逾時)被記住: 同行程再呼叫得到同一個 rejected Promise, ensureChromium 只呼叫 1 次(不重跑整個預算), 錯誤原樣傳出', () => {
        const r = runEnsureChild('fail')
        expect(r.calls.length).toBe(1)
        expect(r.samePromise).toBe(true)
        expect(r.errCodes).toEqual(['E_INSTALL', 'E_INSTALL', 'E_INSTALL'])
    })

    test('autoInstall: 啟動出口為 false; 全 repo 之程式碼無 autoInstall: true(正例防空集合)', () => {
        const re = /\bautoInstall\s*:\s*true\b/
        expect(re.test('wpw.launchChromium({ autoInstall: true })')).toBe(true)
        expect(re.test('wpw.launchChromium({ autoInstall: false })')).toBe(false)
        expect((CODE_LAUNCH.match(/\bautoInstall\s*:\s*false\b/g) || []).length).toBe(1)
        const hits = []
        for (const f of FILES) {
            if (/test\/(unit|api)-[^/]+\.test\.mjs$/.test(rel(f))) continue //測試檔之說明與正例不計
            strip(fs.readFileSync(f, 'utf8')).split(/\r?\n/).forEach((ln, i) => {
                if (re.test(ln)) hits.push(`${rel(f)}:${i + 1}`)
            })
        }
        expect(hits).toEqual([])
    })

    test('站點全集: 呼叫 launchE2eBrowser 之非測試檔(e2e 主檔與兩個子行程配套)皆先 await ensureE2eBrowser(), 且不另有啟動點', () => {
        const callRe = /await\s+launchE2eBrowser\(\)/
        const sites = []
        for (const f of FILES) {
            if (/test\/(unit|api)-[^/]+\.test\.mjs$/.test(rel(f))) continue
            const code = strip(fs.readFileSync(f, 'utf8'))
            if (!callRe.test(code)) continue
            sites.push(rel(f))
            const iEnsure = code.search(/await\s+ensureE2eBrowser\(\)/)
            expect(`${rel(f)}:${iEnsure}`).not.toBe(`${rel(f)}:-1`)
            expect(iEnsure).toBeLessThan(code.search(callRe))
        }
        expect(sites.sort()).toEqual(['test/e2e-flow.test.mjs', 'test/tools/e2eCdnChild.mjs', 'test/tools/e2eLaunchChild.mjs'])
    })

    test('e2e-flow 之 run: 取得瀏覽器早於啟動伺服器早於首次啟動(取得於主流程最前, 不在每 case 之啟動中隱式安裝)', () => {
        const main = strip(fs.readFileSync(path.join(__dirname, 'e2e-flow.test.mjs'), 'utf8'))
        const body = main.slice(main.indexOf('async function run()'))
        const iEnsure = body.indexOf('await ensureE2eBrowser()')
        const iServers = body.indexOf('await startServers()')
        const iLaunch = body.indexOf('await launchE2eBrowser()')
        expect(iEnsure).toBeGreaterThan(-1)
        expect(iEnsure).toBeLessThan(iServers)
        expect(iServers).toBeLessThan(iLaunch)
    })
})
