import { destroyBytes, destroyBytesList, text2bytes } from '../src'

const encoding = 'utf8'

test('destroyBytes', function () {
  const bytes: Uint8Array = text2bytes('waw', encoding)
  const original: Uint8Array = Uint8Array.from(bytes)

  destroyBytes(bytes)
  expect(bytes).not.toEqual(original)
})

test('destroyBytes overwrites with non-uniform, full-range random data', function () {
  // A 256-byte buffer makes the probabilistic assertions effectively deterministic
  // (each failure probability is on the order of 2^-256).
  const bytes = new Uint8Array(256)
  destroyBytes(bytes)

  // The old implementation filled every byte with a single constant <= 126.
  expect(bytes.some(b => b !== bytes[0])).toBe(true) // not a uniform fill
  expect(bytes.some(b => b > 127)).toBe(true) // the high bit is reachable

  // Independent runs must differ, i.e. the data is random rather than a fixed pattern.
  const other = new Uint8Array(256)
  destroyBytes(other)
  expect(other).not.toEqual(bytes)
})

test('destroyBytes handles an empty buffer', function () {
  expect(() => destroyBytes(new Uint8Array(0))).not.toThrow()
})

test('destroyBytesList', function () {
  expect(() => destroyBytesList([])).not.toThrow()

  const contents: string[] = ['waw', 'wu wa wu', 'guanghechen']
  const bytesList: Uint8Array[] = contents.map(content => text2bytes(content, encoding))
  const originals: Uint8Array[] = bytesList.map(bytes => Uint8Array.from(bytes))

  destroyBytesList(bytesList)

  for (let i = 0; i < bytesList.length; ++i) {
    expect(bytesList[i]).not.toEqual(originals[i])
  }
})
