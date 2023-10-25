import { bytes2text, hexText2bytes, text2bytes, validateBase64Text } from '../src'

describe('encode / decode', () => {
  describe('base64', () => {
    describe('basic', () => {
      const kases = [
        {
          plaintext: 'Hello, world!',
          ciphertext: 'SGVsbG8sIHdvcmxkIQ==',
        },
        {
          plaintext: 'Hello, world!1',
          ciphertext: 'SGVsbG8sIHdvcmxkITE=',
        },
        {
          plaintext: 'Hello, world!11',
          ciphertext: 'SGVsbG8sIHdvcmxkITEx',
        },
        {
          plaintext: 'Hello, world!111',
          ciphertext: 'SGVsbG8sIHdvcmxkITExMQ==',
        },
      ]

      test('encode', function () {
        for (const { plaintext, ciphertext } of kases) {
          const bytes: Uint8Array = text2bytes(plaintext, 'utf8')
          expect(bytes2text(bytes, 'base64')).toEqual(ciphertext)
        }
      })

      test('decode', function () {
        for (const { plaintext, ciphertext } of kases) {
          expect(text2bytes(ciphertext, 'base64')).toEqual(text2bytes(plaintext, 'utf8'))
        }
      })

      test('validate', function () {
        expect(validateBase64Text('a')).toBe(false)
        expect(validateBase64Text('aa')).toBe(false)
        expect(validateBase64Text('aaa')).toBe(false)
        expect(validateBase64Text('a===')).toBe(false)
        expect(() => text2bytes('a', 'base64')).toThrow(/Invalid base64 string/)
      })
    })

    describe('edge case', () => {
      test('%4 == 0', () => testWithBytes(1000))
      test('%4 == 1', () => testWithBytes(1001))
      test('%4 == 2', () => testWithBytes(1002))
      test('%4 == 3', () => testWithBytes(1003))

      function testWithBytes(size: number): void {
        const bytes = new Uint8Array(size)
        for (let i = 0; i < size; ++i) bytes[i] = Math.round(Math.random() * 256) * 0xff

        const encodedData = bytes2text(bytes, 'base64')
        expect(typeof encodedData).toBe('string')
        expect(validateBase64Text(encodedData)).toBe(true)

        const decodedData = text2bytes(encodedData, 'base64')
        expect(decodedData).toBeInstanceOf(Uint8Array)
        expect(bytes.length).toEqual(decodedData.length)

        expect(bytes).toEqual(decodedData)
      }
    })
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

  test('utf8', () => {
    const originalText: string = 'Hello, world. 你好，世界。'
    const bytes: Uint8Array = text2bytes(originalText, 'utf8')
    const text: string = bytes2text(bytes, 'utf8')
    expect(text).toEqual(originalText)
  })

  test('unknown encoding', () => {
    expect(() => text2bytes('waw', 'waw' as any)).toThrow('[text2bytes] Unsupported encoding: waw.')
    expect(() => bytes2text(new Uint8Array(2), 'waw' as any)).toThrow(
      '[bytes2text] Unsupported encoding: waw.',
    )
  })
})
