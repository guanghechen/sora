import { text2bytes } from '../src/encode'
import { areSameBytes } from '../src/is'

describe('areSameBytes', () => {
  const bytes1 = text2bytes('hello', 'utf8')
  const bytes2 = text2bytes('world', 'utf8')
  const bytes3 = text2bytes('hel', 'utf8')

  test('diff', () => {
    expect(areSameBytes(undefined, bytes1)).toBe(false)
    expect(areSameBytes(undefined, bytes2)).toBe(false)
    expect(areSameBytes(undefined, bytes3)).toBe(false)

    expect(areSameBytes(bytes1, undefined)).toBe(false)
    expect(areSameBytes(bytes1, bytes2)).toBe(false)
    expect(areSameBytes(bytes1, bytes3)).toBe(false)

    expect(areSameBytes(bytes2, undefined)).toBe(false)
    expect(areSameBytes(bytes2, bytes1)).toBe(false)
    expect(areSameBytes(bytes2, bytes3)).toBe(false)

    expect(areSameBytes(bytes3, undefined)).toBe(false)
    expect(areSameBytes(bytes3, bytes1)).toBe(false)
    expect(areSameBytes(bytes3, bytes2)).toBe(false)
  })

  test('same', () => {
    expect(areSameBytes(undefined, undefined)).toBe(true)
    expect(areSameBytes(bytes1, bytes1)).toBe(true)
    expect(areSameBytes(bytes2, bytes2)).toBe(true)
    expect(areSameBytes(bytes3, bytes3)).toBe(true)
    expect(areSameBytes(bytes1, Uint8Array.from(bytes1))).toBe(true)
    expect(areSameBytes(bytes2, Uint8Array.from(bytes2))).toBe(true)
    expect(areSameBytes(bytes3, Uint8Array.from(bytes3))).toBe(true)
  })
})
