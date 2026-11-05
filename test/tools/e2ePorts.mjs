//e2e 埠之單一定義與保留(排程第 309 項, 2026-11-05 fv309; 規格 C:/opensrcOper/dspec/e2e埠與多套件同跑.md E1～E8; 套件 w-package-tools-e2e >= 1.0.22 README §2.12; 規則帳本 R-E2E-PORT-01)。
//
//本模組為「基準埠」唯一定義處, 並於模組載入時呼叫一次 reserveE2ePorts(本實例全部基準埠)——須早於任何 resolveE2ePort／createServiceManager:
//  e2e-setup.mjs 自本檔取得基準埠與保留(ES 模組先評估被匯入者, 故先於其本體之任何取埠)。本套件僅單一 e2e 檔自帶 runner(無逐檔 runner), 故只有 e2e-setup 一處匯入。
//行為(沒有占用時與導入前相同):
//  - 基準埠 8650 空閒 → 即基準埠, E2E_PORT_OFFSET 維持未設, 標準圖與行為不變。
//  - 基準埠被占用(別的套件正在跑, 或本機其他服務, 含開發者手動起的 dev server) → 整組位移 portStep(預設 100)至空閒之組, 位移寫入 E2E_PORT_OFFSET,
//    其後 resolveE2ePort／createServiceManager／dev server 之 --port 一律取得同一組實際埠; 實際埠印入輸出([e2e-port] …、[e2e-setup] starting frontend (port N))。絕不殺占用者(E4)。
//  - 手動設 E2E_PORT_OFFSET(含 0)＝不換埠(0 為「沿用本機已起之 dev server」逃生口, 此時被占用者可能不是本套件之 dev server, 責任在設定者); 上層已保留(E2E_PORT_HOLD)＝沿用上層之位移。
//OTHER_TEST_PORTS 為本套件其他測試(unit-／api-／e2e 之子行程)寫死之監聽埠: 位移後之實際埠不得落在其上。
//  實查(2026-11-05, 見 unit-e2ePorts 之 EP-S4 盤點): 本套件 unit-／api- 測試皆不監聽埠(jsdom 單元測試), 故為空陣列; 日後新增寫死監聽埠之測試時須列於此並維持 EP-S4 為綠。
//  非 e2e 測試之監聽埠與他套件之撞埠屬規格 E8; 本套件無此類埠。

import reserveE2ePorts from 'w-package-tools-e2e/src/reserveE2ePorts.mjs'

//基準埠。其餘組埠處一律經 resolveE2ePort(基準埠)／reservation.portOf(基準埠)。
//  不用 vue-cli 預設之 8080(2026-11-05 主控改): 8080 為多個套件共用, unit-e2ePorts 於基準埠起真實占用者時, 在 Windows 可與對方並存綁定而搶走其連線; 標準圖不含埠, 改基準埠不影響比對。
export const FRONTEND_PORT = 8650
//其他測試寫死之監聽埠(目前無)
export const OTHER_TEST_PORTS = []

export const reservation = reserveE2ePorts([FRONTEND_PORT], { avoid: OTHER_TEST_PORTS })
