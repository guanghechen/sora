import { bytes2text, mergeBytes, text2bytes } from '../src'

describe('merge', () => {
  test('basic', () => {
    const encoding = 'utf8'
    const bytes1 = text2bytes('hello', encoding)
    const bytes2 = text2bytes(', world', encoding)
    const bytes3 = mergeBytes([bytes1, bytes2])
    expect(bytes2text(bytes3, encoding)).toEqual('hello, world')
  })
})
