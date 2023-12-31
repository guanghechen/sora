import { bytes2text, randomBytes, text2bytes } from '@guanghechen/byte'
import { emptyDir, rm } from '@guanghechen/internal'
import { assertPromiseThrow, locateFixtures } from 'jest.helper'
import fs from 'node:fs/promises'
import path from 'node:path'
import { calcMac, calcMacFromFile } from '../src'

describe('mac', () => {
  const workspaceDir: string = locateFixtures('__fictitious__.helper-mac')

  const filepath1: string = path.join(workspaceDir, '1.txt')
  const filepath2: string = path.join(workspaceDir, '2.txt')
  const filepath3: string = path.join(workspaceDir, '3.txt')
  const filepaths: string[] = [filepath1, filepath2, filepath3]

  const content1: Uint8Array = text2bytes('Hello, world! 你好'.repeat(20), 'utf8')
  const content2: Uint8Array = randomBytes(500)
  const content3: Uint8Array = randomBytes(2048)
  const contents: Uint8Array[] = [content1, content2, content3]

  beforeEach(async () => {
    await emptyDir(workspaceDir)

    await fs.writeFile(filepath1, content1)
    await fs.writeFile(filepath2, content2)
    await fs.writeFile(filepath3, content3)
  })

  afterEach(async () => {
    await rm(workspaceDir)
  })

  test('calcMac', () => {
    expect(bytes2text(calcMac([content1], 'sha1'), 'hex')).toEqual(
      'a04d3dfd586c6c8a8cd167874d1e15663278c0bc',
    )
    expect(bytes2text(calcMac([content1], 'sha256'), 'hex')).toEqual(
      'ab47c1f9fb44e3476f421be3e7561c1bee18b521db50e5f5dc518e8af930c624',
    )
    expect(bytes2text(calcMac([content1], 'sha512'), 'hex')).toEqual(
      '35532d952f3846f4b07425ccf609c50fafeb6d4a4a90dc0202348de8d1124b5bc3d29ba8d58e1ecdd40feb14fc654c31aea16bf8ef69843521a2d73fd2ee982f',
    )

    for (let i = 0; i < contents.length; ++i) {
      const content: Uint8Array = contents[i]
      expect(calcMac([content], 'sha1').byteLength).toEqual(20)
      expect(calcMac([content], 'sha256').byteLength).toEqual(32)
      expect(calcMac([content], 'sha512').byteLength).toEqual(64)
    }

    expect(calcMac(contents, 'sha1').byteLength).toEqual(20)
    expect(calcMac(contents, 'sha256').byteLength).toEqual(32)
    expect(calcMac(contents, 'sha512').byteLength).toEqual(64)
  })

  describe('calcMacFromFile', () => {
    test('basic', async () => {
      for (let i = 0; i < contents.length; ++i) {
        const filepath: string = filepaths[i]
        const content: Uint8Array = contents[i]

        expect(bytes2text(await calcMacFromFile(filepath, 'sha1'), 'hex')).toEqual(
          bytes2text(calcMac([content], 'sha1'), 'hex'),
        )
        expect(bytes2text(await calcMacFromFile(filepath, 'sha256'), 'hex')).toEqual(
          bytes2text(calcMac([content], 'sha256'), 'hex'),
        )
        expect(bytes2text(await calcMacFromFile(filepath, 'sha512'), 'hex')).toEqual(
          bytes2text(calcMac([content], 'sha512'), 'hex'),
        )
      }
    })

    test('corner case', async () => {
      const filepath: string = filepath1 + Math.random()
      await assertPromiseThrow(
        () => calcMacFromFile(filepath, 'sha256'),
        '[calcMacFromFile] filepath is not found',
      )

      await fs.mkdir(filepath, { recursive: true })
      await assertPromiseThrow(
        () => calcMacFromFile(filepath, 'sha256'),
        '[calcMacFromFile] filepath is not a file',
      )
    })
  })
})
