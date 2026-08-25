import { assessGraphConnection } from './connectPolicy.mjs'

/**
 * Validate a potential connection.
 * 委派 connectPolicy 之圖層級判定(單一來源, preview/commit 共用);
 * 相較舊版新增「端點必須存在於圖中」——缺任一端之 connection 原本會誤判為合法。
 */
export function isValidConnection(connection, nodes, conns, validator) {
    return assessGraphConnection(connection, nodes, conns, validator).valid
}

let _idCounter = 0

/**
 * Generate a unique ID.
 */
export function generateId() {
    _idCounter++
    return `${Date.now()}-${_idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

