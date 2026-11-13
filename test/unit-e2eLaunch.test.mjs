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
 *                    且為 headless shell 之形態(無頭、不給通道與執行檔); 替身確被呼叫(次數 1)
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
        expect(r.coreVersion).toBe('1.64.1')
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
})
