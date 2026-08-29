//resetIdCounter 已自 graph.mjs 移除; generateId 以 Date.now()+內部counter+random 組成,
//唯一性不依賴 counter 歸零, 故原斷言仍有效, 僅移除該前置
import { generateId } from '../src/js/graph.mjs'
import { assessGraphConnection } from '../src/js/connectPolicy.mjs'

//圖層級連線判定之單一來源為 connectPolicy.assessGraphConnection(graph.mjs 不再另設委派層)
const isValidConnection = (c, nodes, conns, validator) => assessGraphConnection(c, nodes, conns, validator).valid

describe('graph', () => {
    const conns = [
        { id: 'e1-2', from: '1', to: '2' },
        { id: 'e2-3', from: '2', to: '3' },
        { id: 'e1-3', from: '1', to: '3' },
    ]

    const nodes = [
        { id: '1', position: { x: 0, y: 0 } },
        { id: '2', position: { x: 100, y: 0 } },
        { id: '3', position: { x: 200, y: 0 } },
    ]

    describe('isValidConnection', () => {
        test('valid connection returns true', () => {
            const connection = { from: '1', to: '2' }
            expect(isValidConnection(connection, nodes, [], null)).toBe(true)
        })

        test('self-connection returns false', () => {
            const connection = { from: '1', to: '1' }
            expect(isValidConnection(connection, nodes, [], null)).toBe(false)
        })

        test('duplicate connection returns false', () => {
            const connection = { from: '1', to: '2' }
            expect(isValidConnection(connection, nodes, conns, null)).toBe(false)
        })

        test('missing from returns false', () => {
            expect(isValidConnection({ to: '1' }, nodes, [], null)).toBe(false)
        })

        test('missing to returns false', () => {
            expect(isValidConnection({ from: '1' }, nodes, [], null)).toBe(false)
        })

        test('custom validator rejection', () => {
            const connection = { from: '1', to: '3' }
            const validator = () => false
            expect(isValidConnection(connection, nodes, [], validator)).toBe(false)
        })

        test('custom validator approval', () => {
            const connection = { from: '1', to: '3' }
            const validator = () => true
            expect(isValidConnection(connection, nodes, [], validator)).toBe(true)
        })

        test('same from-to pair is always duplicate', () => {
            const existing = [{ id: 'e1-2', from: '1', to: '2' }]
            const connection = { from: '1', to: '2' }
            expect(isValidConnection(connection, nodes, existing, null)).toBe(false)
        })
    })

    describe('generateId', () => {
        test('generates unique ids', () => {
            const id1 = generateId()
            const id2 = generateId()
            expect(id1).not.toBe(id2)
        })

        test('returns string', () => {
            expect(typeof generateId()).toBe('string')
        })
    })
})
