import { bytes2text, hexText2bytes, text2bytes } from '../src'

describe('encode / decode', () => {
  test('utf8', () => {
    const originalText: string = 'Hello, world. 你好，世界。'
    const bytes: Uint8Array = text2bytes(originalText, 'utf8')
    const text: string = bytes2text(bytes, 'utf8')
    expect(text).toEqual(originalText)
  })

  describe('hex', () => {
    test('basic', () => {
      const originalText: string =
        '5b68774ab64c5d83a71ed329ee95eed5e156ccd89500693c3157c88fce380f30'
      const bytes: Uint8Array = text2bytes(originalText, 'hex')
      const text: string = bytes2text(bytes, 'hex')
      expect(text).toEqual(originalText)
    })

    test('edge case', () => {
      expect(() => hexText2bytes('2')).toThrow('[hexText2bytes] Hex string length must be even.')
      expect(() => hexText2bytes('2k')).toThrow('[hexText2bytes] bad hex string, unknown char (k).')
      expect(() => hexText2bytes('mk')).toThrow('[hexText2bytes] bad hex string, unknown char (m).')
    })
  })

  test('unknown encoding', () => {
    expect(() => text2bytes('waw', 'waw' as any)).toThrow('[text2bytes] Unsupported encoding: waw.')
    expect(() => bytes2text(new Uint8Array(2), 'waw' as any)).toThrow(
      '[bytes2text] Unsupported encoding: waw.',
    )
  })
})
