/**
 * Validate a potential connection.
 */
export function isValidConnection(connection, nodes, conns, validator) {
    if (!connection.from || !connection.to) return false

    // Self-connection not allowed by default
    if (connection.from === connection.to) return false

    // Check duplicate (same from→to path)
    const duplicate = conns.find(
        e => e.from === connection.from && e.to === connection.to
    )
    if (duplicate) return false

    // Custom validator
    if (validator && !validator(connection)) return false

    return true
}

let _idCounter = 0

/**
 * Generate a unique ID.
 */
export function generateId() {
    _idCounter++
    return `${Date.now()}-${_idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

