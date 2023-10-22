import { bytes2text, destroyBytes, destroyBytesList, text2bytes } from '../src'

const encoding = 'utf8'

test('destroyBytes', function () {
  const content = 'waw'
  const bytes: Uint8Array = text2bytes(content, encoding)

  expect(bytes2text(bytes, encoding)).toEqual(content)
  destroyBytes(bytes)
  expect(bytes2text(bytes, encoding)).not.toEqual(content)
})

test('destroyBytesList', function () {
  expect(() => destroyBytesList([])).not.toThrow()

  const contents: string[] = ['waw', 'wu wa wu', 'guanghechen']
  const bytesList: Uint8Array[] = contents.map(content => text2bytes(content, encoding))

  for (let i = 0; i < contents.length; ++i) {
    const bytes: Uint8Array = bytesList[i]
    const content: string = contents[i]
    expect(bytes2text(bytes, encoding)).toEqual(content)
  }
  destroyBytesList(bytesList)

  for (let i = 0; i < contents.length; ++i) {
    const bytes: Uint8Array = bytesList[i]
    const content: string = contents[i]
    expect(bytes2text(bytes, encoding)).not.toEqual(content)
  }
})
