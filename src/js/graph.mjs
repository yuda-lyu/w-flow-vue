let _idCounter = 0

/**
 * Generate a unique ID.
 */
export function generateId() {
    _idCounter++
    return `${Date.now()}-${_idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

