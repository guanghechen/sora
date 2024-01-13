import { assertPromiseThrow } from 'jest.helper'
import { MemoTextResource } from '../src'

describe('MemoTextResource', () => {
  describe('no strict', () => {
    const content = 'Hello, world!'
    const encoding: BufferEncoding = 'utf8'
    const resource = new MemoTextResource({ strict: false, encoding, content: undefined })

    test('exists', async () => {
      expect(await resource.exists()).toEqual(true)

      await resource.save('waw')
      expect(await resource.exists()).toEqual(true)
    })

    test('load', async () => {
      expect(await resource.load()).toEqual('waw')
      await resource.save(content)
      expect(await resource.load()).toEqual(content)
    })

    test('destroy', async () => {
      expect(await resource.exists()).toEqual(true)
      await resource.destroy()
      expect(await resource.exists()).toEqual(false)
      expect(await resource.load()).toEqual(content)
    })
  })

  describe('strict', () => {
    const content = 'Hello, world!'
    const encoding: BufferEncoding = 'utf8'
    const resource = new MemoTextResource({ strict: true, encoding, content: undefined })

    test('load', async () => {
      await resource.save(content)
      expect(await resource.load()).toEqual(content)
    })

    test('destroy', async () => {
      await resource.destroy()
      await assertPromiseThrow(
        () => resource.save(content),
        '[MemoTextResource.save] the resource has been destroyed.'
      )
      await assertPromiseThrow(
        () => resource.load(),
        '[MemoTextResource.load] the resource has been destroyed.'
      )
    })
  })
})
