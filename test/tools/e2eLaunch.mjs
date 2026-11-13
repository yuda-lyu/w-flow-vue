//e2e 啟動瀏覽器之唯一站點(排程第 442 項; 規則帳本 R-WPW-LAUNCH-01)。
//
//一律經自有套件 w-playwright 啟動(本套件不直接依賴 playwright／playwright-core): w-playwright 於每次啟動合併出恰一串 `--disable-features`
//(Playwright 預設清單＋守門功能 AutofillAiWalletPrivatePasses＋呼叫端自給者), 避免 Windows 上 Chromium 系瀏覽器每啟動一個新根行程即以
//錯誤密碼替目前使用者登入一次、累積而鎖住帳號。
//
//本站點不傳 headless／channel／executablePath: 與修前 `chromium.launch()` 同為無頭之 headless shell(不是真 Chrome／Edge／完整 Chromium),
//Playwright 版本與預設參數不變, 標準圖(test/pics)不受影響; 守門僅多停用一個與繪製無關之功能。
//autoInstall: 受管瀏覽器(Playwright 1.64.1 之 headless shell)缺檔時安裝一次再啟動, 與修前之行為相同。
//
//接線測試見 unit-e2eLaunch(替身接住, 不啟動瀏覽器)與 api-e2eLaunch(真路徑, 啟動 headless shell 一次); 配套子行程 e2eLaunchChild.mjs。
import wpw from 'w-playwright'

/** 啟動 e2e 用之瀏覽器(Promise<Browser>); 每個 case 各呼叫一次, 由呼叫端負責 close */
async function launchE2eBrowser() {
    return wpw.launchChromium({ autoInstall: true })
}

export default launchE2eBrowser
