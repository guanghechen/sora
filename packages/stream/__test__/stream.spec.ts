import crypto from 'crypto'
import { locateFixtures, unlinkSync } from 'jest.helper'
import fs from 'node:fs'
import { consumeStream, consumeStreams, stream2buffer, stream2bytes } from '../src'

const encoding = 'utf8'
const filepaths = ['a.txt', 'b.txt', 'c.txt'].map(fp => locateFixtures(fp))
const loadContent = async (fp: string): Promise<string> => fs.readFileSync(fp, encoding)

const _iv: Uint8Array = crypto.randomBytes(32)
const _key: Uint8Array = crypto.randomBytes(32)
const getCipher = (): crypto.Cipher => crypto.createCipheriv('aes-256-gcm', _key, _iv)

describe('consumeStream', () => {
  const outFilepaths: string[] = filepaths.map(fp => fp + '.out')
  const cipherOutFilepaths: string[] = filepaths.map(fp => fp + '.out.cipher')

  afterAll(async () => {
    const tmpFiles: string[] = [outFilepaths, cipherOutFilepaths].flat()
    for (const fp of tmpFiles) unlinkSync(fp)
  })

  it('basic', async () => {
    for (const fp of filepaths) {
      const content = await loadContent(fp)
      const outFilepath = fp + '.out'
      const reader = fs.createReadStream(fp)
      const writer = fs.createWriteStream(outFilepath)
      await consumeStream(reader, writer)
      expect(await loadContent(outFilepath)).toEqual(content)
    }
  })

  it('cipher', async () => {
    for (const fp of filepaths) {
      const content = await loadContent(fp)

      const outFilepath = fp + '.out'
      const reader = fs.createReadStream(fp)
      const writer = fs.createWriteStream(outFilepath)
      await consumeStream(reader, writer, getCipher())
      expect(await loadContent(outFilepath)).not.toEqual(content)

      const cipherOutFilepath = fp + '.out.cipher'
      await consumeStream(
        fs.createReadStream(outFilepath),
        fs.createWriteStream(cipherOutFilepath),
        getCipher(),
      )
      expect(await loadContent(cipherOutFilepath)).toEqual(content)
    }
  })
})

describe('consumeStreams', () => {
  const outFilepath = locateFixtures('1.out')
  const cipherOutFilepath = locateFixtures('1.out.cipher')

  afterAll(async () => {
    ;[outFilepath, cipherOutFilepath].flat().forEach(fp => unlinkSync(fp))
  })

  it('basic', async () => {
    const content = (await Promise.all(filepaths.map(fp => loadContent(fp)))).join('')
    const readers = filepaths.map(fp => fs.createReadStream(fp))
    const writer = fs.createWriteStream(outFilepath)
    await consumeStreams(readers, writer)
    expect(await loadContent(outFilepath)).toEqual(content)
  })

  it('single', async () => {
    for (const fp of filepaths) {
      const content = await loadContent(fp)
      const reader = fs.createReadStream(fp)
      const writer = fs.createWriteStream(outFilepath)
      await consumeStreams([reader], writer)
      expect(await loadContent(outFilepath)).toEqual(content)
    }
  })

  it('cipher', async () => {
    const content = (await Promise.all(filepaths.map(fp => loadContent(fp)))).join('')
    const readers = filepaths.map(fp => fs.createReadStream(fp))
    const writer = fs.createWriteStream(outFilepath)
    await consumeStreams(readers, writer, getCipher())
    expect(await loadContent(outFilepath)).not.toEqual(content)

    await consumeStream(
      fs.createReadStream(outFilepath),
      fs.createWriteStream(cipherOutFilepath),
      getCipher(),
    )
    expect(await loadContent(cipherOutFilepath)).toEqual(content)
  })
})

describe('stream2buffer', function () {
  it('basic', async () => {
    for (const fp of filepaths) {
      const reader = fs.createReadStream(fp)
      const buffer = await stream2buffer(reader, true)
      expect(buffer.toString(encoding)).toEqual(await loadContent(fp))
    }
  })

  it('string stream', async () => {
    for (const fp of filepaths) {
      const reader = fs.createReadStream(fp, encoding)
      const buffer = await stream2buffer(reader, false)
      expect(buffer.toString(encoding)).toEqual(await loadContent(fp))
    }
  })
})

describe('stream2bytes', function () {
  it('basic', async () => {
    for (const fp of filepaths) {
      const reader = fs.createReadStream(fp)
      const bytes: Uint8Array = await stream2bytes(reader, true)
      const buffer = Buffer.from(bytes)
      expect(buffer.toString(encoding)).toEqual(await loadContent(fp))
    }
  })

  it('string stream', async () => {
    for (const fp of filepaths) {
      const reader = fs.createReadStream(fp, encoding)
      const bytes: Uint8Array = await stream2bytes(reader, false)
      const buffer = Buffer.from(bytes)
      expect(buffer.toString(encoding)).toEqual(await loadContent(fp))
    }
  })
})
