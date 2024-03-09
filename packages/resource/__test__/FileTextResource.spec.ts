import { emptyDir, mkdirsIfNotExists, rm, writeFile } from '@guanghechen/internal'
import { assertPromiseNotThrow, assertPromiseThrow, locateFixtures } from 'jest.helper'
import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { FileTextResource } from '../src'

describe('FileTextResource', () => {
  const workspaceDir: string = locateFixtures('__fictitious__.FileStorage')

  beforeEach(async () => {
    await emptyDir(workspaceDir)
  })

  afterEach(async () => {
    await rm(workspaceDir)
  })

  describe('no strict', () => {
    const configFilepath = path.join(workspaceDir, 'a/b/c/ghc.json')
    const content = 'Hello, world!'
    const encoding: BufferEncoding = 'utf8'
    const resource = new FileTextResource({ strict: false, filepath: configFilepath, encoding })

   it('exists', async () => {
      expect(await resource.exists()).toEqual(false)

      await resource.save('waw')
      expect(await resource.exists()).toEqual(true)

      await rm(configFilepath)
      expect(await resource.exists()).toEqual(false)
    })

   it('load-1', async () => {
      expect(existsSync(configFilepath)).toEqual(false)
      expect(await resource.load()).toEqual(undefined)
    })

   it('load-2', async () => {
      mkdirsIfNotExists(configFilepath, true)
      await assertPromiseThrow(() => resource.load(), 'Not a file')
    })

   it('load-3', async () => {
      await writeFile(configFilepath, content, encoding)
      expect(existsSync(configFilepath)).toEqual(true)
      expect(await resource.load()).toEqual(content)
    })

   it('save-1', async () => {
      await resource.save(content)
      expect(await readFile(configFilepath, encoding)).toEqual(content)
    })

   it('save-2', async () => {
      mkdirsIfNotExists(configFilepath, true)
      await assertPromiseThrow(() => resource.save(content), 'Not a file')
    })

   it('save-3', async () => {
      await resource.save(content)
      expect(await readFile(configFilepath, encoding)).toEqual(content)
    })

   it('save-4', async () => {
      const dir = path.dirname(configFilepath)
      await writeFile(dir, content, encoding)
      expect(existsSync(dir)).toEqual(true)
      expect(statSync(dir).isFile()).toEqual(true)
      await assertPromiseThrow(() => resource.save(content), 'Parent path is not a dir')
    })

   it('remove-1', async () => {
      await assertPromiseNotThrow(() => resource.destroy())
      expect(existsSync(configFilepath)).toEqual(false)
    })

   it('remove-2', async () => {
      mkdirsIfNotExists(configFilepath, true)
      await assertPromiseThrow(() => resource.destroy(), 'Not a file')
    })

   it('remove-3', async () => {
      await writeFile(configFilepath, content)
      expect(existsSync(configFilepath)).toEqual(true)

      await resource.destroy()
      expect(existsSync(configFilepath)).toEqual(false)
    })
  })

  describe('strict', () => {
    const configFilepath = path.join(workspaceDir, 'a/b/c/ghc.json')
    const content = 'Hello, world!'
    const encoding: BufferEncoding = 'utf8'
    const resource = new FileTextResource({ strict: true, filepath: configFilepath, encoding })

   it('load-1', async () => {
      expect(existsSync(configFilepath)).toEqual(false)
      await assertPromiseThrow(() => resource.load(), 'Cannot find file.')
    })

   it('load-2', async () => {
      mkdirsIfNotExists(configFilepath, true)
      await assertPromiseThrow(() => resource.load(), 'Not a file')
    })

   it('load-3', async () => {
      await writeFile(configFilepath, content, encoding)
      expect(existsSync(configFilepath)).toEqual(true)
      expect(await resource.load()).toEqual(content)
    })

   it('save-1', async () => {
      await resource.save(content)
      expect(await readFile(configFilepath, encoding)).toEqual(content)
    })

   it('save-2', async () => {
      mkdirsIfNotExists(configFilepath, true)
      await assertPromiseThrow(() => resource.save(content), 'Not a file')
    })

   it('save-3', async () => {
      await resource.save(content)
      expect(await readFile(configFilepath, encoding)).toEqual(content)
    })

   it('save-4', async () => {
      const dir = path.dirname(configFilepath)
      await writeFile(dir, content, encoding)
      expect(existsSync(dir)).toEqual(true)
      expect(statSync(dir).isFile()).toEqual(true)
      await assertPromiseThrow(() => resource.save(content), 'Parent path is not a dir')
    })

   it('remove-1', async () => {
      await assertPromiseNotThrow(() => resource.destroy())
      expect(existsSync(configFilepath)).toEqual(false)
    })

   it('remove-2', async () => {
      mkdirsIfNotExists(configFilepath, true)
      await assertPromiseThrow(() => resource.destroy(), 'Not a file')
    })

   it('remove-3', async () => {
      await writeFile(configFilepath, content)
      expect(existsSync(configFilepath)).toEqual(true)

      await resource.destroy()
      expect(existsSync(configFilepath)).toEqual(false)
    })
  })
})
