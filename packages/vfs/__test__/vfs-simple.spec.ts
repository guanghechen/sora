import { text2bytes } from '@guanghechen/byte'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { chalk } from '@guanghechen/chalk/node'
import { type IReporterMock, createReporterMock } from '@guanghechen/helper-jest'
import { invariant, rm } from '@guanghechen/internal'
import { Reporter, ReporterLevelEnum } from '@guanghechen/reporter'
import type { IReporter } from '@guanghechen/reporter.types'
import type { IVfsFileStat, IVirtualFileSystem } from '@guanghechen/vfs.types'
import { VfsErrorCode, VfsFileType, isVfsOperationSucceed } from '@guanghechen/vfs.types'
import { desensitize } from 'jest.helper'
import path from 'node:path'
import url from 'node:url'
import { LocalVirtualFileSystem } from '../src'

describe('simple', () => {
  let vfs: IVirtualFileSystem
  let reporter: IReporter
  let reporterMock: IReporterMock

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
  const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'simple')
  const PHYSICAL_DIRNAME = 'physical'
  const VIRTUAL_DIRNAME = 'virtual'
  const FIXTURE_PHYSICAL_DIR = path.join(FIXTURE_DIR, PHYSICAL_DIRNAME)
  const FIXTURE_VIRTUAL_DIR = path.join(FIXTURE_DIR, VIRTUAL_DIRNAME)

  const FILEPATH_1 = 'a/b/c.md'
  const FILEPATH_2 = 'a/d.md'
  const CONTENT_1 = text2bytes('Content c.\n', 'utf8')
  // const CONTENT_2 = text2bytes('Content d.\n', 'utf8')

  const virtualPath1: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1)
  const virtualPath2: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2)
  const physicalPath1: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
  const physicalPath2: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2)

  beforeAll(async () => {
    reporter = new Reporter(chalk, {
      level: ReporterLevelEnum.DEBUG,
      flights: {
        colorful: false,
        date: false,
        inline: true,
        title: true,
      },
    })
    reporterMock = createReporterMock({ reporter, desensitize })
  })

  beforeEach(async () => {
    vfs = new LocalVirtualFileSystem({
      root: FIXTURE_DIR,
      reporter,
    })
    await rm(FIXTURE_VIRTUAL_DIR)
  })

  afterEach(async () => {
    vfs.dispose()
    reporterMock.restore()
    await rm(FIXTURE_VIRTUAL_DIR)
  })

  describe('copy', () => {
    it('folders', async () => {
      expect(await vfs.isExist(physicalPath1)).toEqual(true)
      expect(await vfs.isExist(physicalPath2)).toEqual(true)
      expect(await vfs.isExist(virtualPath1)).toEqual(false)
      expect(await vfs.isExist(virtualPath2)).toEqual(false)

      const result: VfsErrorCode | void = await vfs.copy(
        PHYSICAL_DIRNAME,
        VIRTUAL_DIRNAME,
        true,
        true,
      )
      expect(isVfsOperationSucceed(result)).toEqual(true)

      expect(await vfs.isExist(virtualPath1)).toEqual(true)
      expect(await vfs.isExist(virtualPath2)).toEqual(true)
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })

    it('files', async () => {
      expect(await vfs.isExist(physicalPath1)).toEqual(true)
      expect(await vfs.isExist(physicalPath2)).toEqual(true)
      expect(await vfs.isExist(virtualPath1)).toEqual(false)
      expect(await vfs.isExist(virtualPath2)).toEqual(false)

      {
        const result: VfsErrorCode | void = await vfs.copy(physicalPath1, virtualPath1, true, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_PARENT_NOT_FOUND)

        expect(await vfs.isExist(physicalPath1)).toEqual(true)
        expect(await vfs.isExist(physicalPath2)).toEqual(true)
        expect(await vfs.isExist(virtualPath1)).toEqual(false)
        expect(await vfs.isExist(virtualPath2)).toEqual(false)
      }

      {
        const result: VfsErrorCode | void = await vfs.mkdir(path.dirname(virtualPath1), true)
        expect(isVfsOperationSucceed(result)).toEqual(true)
      }

      {
        const result: VfsErrorCode | void = await vfs.copy(physicalPath1, virtualPath1, true, false)
        expect(isVfsOperationSucceed(result)).toEqual(true)

        expect(await vfs.isExist(physicalPath1)).toEqual(true)
        expect(await vfs.isExist(physicalPath2)).toEqual(true)
        expect(await vfs.isExist(virtualPath1)).toEqual(true)
        expect(await vfs.isExist(virtualPath2)).toEqual(false)
      }

      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })
  })

  it('exist', async () => {
    expect(await vfs.isExist(FIXTURE_DIR)).toEqual(true)
    expect(await vfs.isExist('')).toEqual(true)
    expect(await vfs.isExist(PHYSICAL_DIRNAME)).toEqual(true)
    expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
  })

  it('isFile', async () => {
    expect(await vfs.isFile(FIXTURE_DIR)).toEqual(false)
    expect(await vfs.isFile(path.join(FIXTURE_VIRTUAL_DIR, 'non-exist'))).toEqual(false)
    expect(await vfs.isFile(path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1))).toEqual(true)
    expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
  })

  it('isDirectory', async () => {
    expect(await vfs.isDirectory(FIXTURE_DIR)).toEqual(true)
    expect(await vfs.isDirectory(path.join(FIXTURE_VIRTUAL_DIR, 'non-exist'))).toEqual(false)
    expect(await vfs.isDirectory(path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1))).toEqual(false)
    expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
  })

  describe('mkdir', () => {
    it('source parent is not found', async () => {
      const p: string = path.join(FIXTURE_VIRTUAL_DIR, 'a/b/c/d/e/f/g')
      expect(await vfs.isExist(p)).toEqual(false)

      const result: VfsErrorCode | void = await vfs.mkdir(p, false)
      expect(isVfsOperationSucceed(result)).toEqual(false)
      expect(result).toEqual(VfsErrorCode.SOURCE_PARENT_NOT_FOUND)
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })

    it('source parent is not directory', async () => {
      const p: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1, 'a')
      expect(await vfs.isExist(p)).toEqual(false)

      const result: VfsErrorCode | void = await vfs.mkdir(p, false)
      expect(isVfsOperationSucceed(result)).toEqual(false)
      expect(result).toEqual(VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY)
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })

    it('source exist', async () => {
      const p: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      expect(await vfs.isExist(p)).toEqual(true)

      const result: VfsErrorCode | void = await vfs.mkdir(p, false)
      expect(isVfsOperationSucceed(result)).toEqual(false)
      expect(result).toEqual(VfsErrorCode.SOURCE_EXIST)
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })

    it('succeed', async () => {
      const p: string = path.join(FIXTURE_VIRTUAL_DIR, 'a/b/c/d/e/f/g')
      expect(await vfs.isExist(p)).toEqual(false)

      const result: VfsErrorCode | void = await vfs.mkdir(p, true)
      expect(isVfsOperationSucceed(result)).toEqual(true)
      expect(await vfs.isExist(p)).toEqual(true)
    })
  })

  describe('readdir', () => {
    it('source is not found', async () => {
      const p: string = path.join(FIXTURE_VIRTUAL_DIR, 'non-exist')
      expect(await vfs.isExist(p)).toEqual(false)

      const result: VfsErrorCode | string[] = await vfs.readdir(p)
      expect(isVfsOperationSucceed(result)).toEqual(false)
      expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
    })

    it('source is not directory', async () => {
      const p: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      expect(await vfs.isExist(p)).toEqual(true)
      expect(await vfs.isFile(p)).toEqual(true)

      const result: VfsErrorCode | string[] = await vfs.readdir(p)
      expect(isVfsOperationSucceed(result)).toEqual(false)
      expect(result).toEqual(VfsErrorCode.SOURCE_NOT_DIRECTORY)
    })

    it('succeed', async () => {
      const p: string = path.dirname(path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1))
      expect(await vfs.isExist(p)).toEqual(true)
      expect(await vfs.isDirectory(p)).toEqual(true)

      const result: VfsErrorCode | string[] = await vfs.readdir(p)
      expect(isVfsOperationSucceed(result)).toEqual(true)
      expect((result as string[]).sort()).toMatchInlineSnapshot(`
        [
          "c.md",
        ]
      `)
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })
  })

  describe('remove', () => {
    it('source is not found', async () => {
      const p: string = path.join(FIXTURE_VIRTUAL_DIR, 'non-exist')
      expect(await vfs.isExist(p)).toEqual(false)

      {
        const result: VfsErrorCode | void = await vfs.remove(p, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
      }

      {
        const result: VfsErrorCode | void = await vfs.remove(p, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
      }
    })

    it('file', async () => {
      const physicalPath: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      const virtualPath: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1)
      expect(await vfs.isFile(virtualPath)).toEqual(false)
      expect(await vfs.isFile(physicalPath)).toEqual(true)

      const mkdirResult: VfsErrorCode | void = await vfs.mkdir(path.dirname(virtualPath), true)
      expect(isVfsOperationSucceed(mkdirResult)).toEqual(true)

      const copyResult: VfsErrorCode | void = await vfs.copy(physicalPath, virtualPath, true, false)
      expect(isVfsOperationSucceed(copyResult)).toEqual(true)
      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isFile(virtualPath)).toEqual(true)

      const result: VfsErrorCode | void = await vfs.remove(virtualPath, false)
      expect(isVfsOperationSucceed(result)).toEqual(true)
      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isFile(virtualPath)).toEqual(false)
    })

    it('folder', async () => {
      const p1: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1)
      const p2: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2)
      expect(await vfs.isExist(p1)).toEqual(false)
      expect(await vfs.isExist(p2)).toEqual(false)

      const copyResult: VfsErrorCode | void = await vfs.copy(
        PHYSICAL_DIRNAME,
        VIRTUAL_DIRNAME,
        true,
        true,
      )
      expect(isVfsOperationSucceed(copyResult)).toEqual(true)
      expect(await vfs.isFile(p1)).toEqual(true)
      expect(await vfs.isFile(p2)).toEqual(true)

      {
        const result: VfsErrorCode | void = await vfs.remove(VIRTUAL_DIRNAME, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_NO_PERMISSION)
        expect(await vfs.isFile(p1)).toEqual(true)
        expect(await vfs.isFile(p2)).toEqual(true)
      }

      {
        const result: VfsErrorCode | void = await vfs.remove(VIRTUAL_DIRNAME, true)
        expect(isVfsOperationSucceed(result)).toEqual(true)
        expect(await vfs.isFile(p1)).toEqual(false)
        expect(await vfs.isFile(p2)).toEqual(false)
      }
    })
  })

  describe('rename', () => {
    test('source is not found', async () => {
      const p1: string = path.join(FIXTURE_VIRTUAL_DIR, 'non-exist/a.md')
      const p2: string = path.join(FIXTURE_VIRTUAL_DIR, 'non-exist/b.md')
      expect(await vfs.isExist(p1)).toEqual(false)
      expect(await vfs.isExist(p2)).toEqual(false)

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
      }

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
      }
    })

    test('target parent is not found', async () => {
      const physicalPath: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      const p1: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/a.md')
      const p2: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/b/c.md')
      const parentOfP2: string = path.dirname(p2)

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(false)
      expect(await vfs.isExist(p2)).toEqual(false)
      expect(await vfs.isExist(parentOfP2)).toEqual(false)

      const mkdirResult: VfsErrorCode | void = await vfs.mkdir(path.dirname(p1), true)
      expect(isVfsOperationSucceed(mkdirResult)).toEqual(true)

      const copyResult: VfsErrorCode | void = await vfs.copy(physicalPath, p1, true, false)
      expect(isVfsOperationSucceed(copyResult)).toEqual(true)

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(true)
      expect(await vfs.isExist(p2)).toEqual(false)
      expect(await vfs.isExist(parentOfP2)).toEqual(false)

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_PARENT_NOT_FOUND)
        expect(await vfs.isFile(physicalPath)).toEqual(true)
        expect(await vfs.isExist(p1)).toEqual(true)
        expect(await vfs.isExist(p2)).toEqual(false)
      }

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_PARENT_NOT_FOUND)
        expect(await vfs.isFile(physicalPath)).toEqual(true)
        expect(await vfs.isExist(p1)).toEqual(true)
        expect(await vfs.isExist(p2)).toEqual(false)
      }
    })

    test('target parent is not directory', async () => {
      const physicalPath: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      const p1: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/a.md')
      const p2: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/b/c.md')
      const parentOfP2: string = path.dirname(p2)

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(false)
      expect(await vfs.isExist(p2)).toEqual(false)
      expect(await vfs.isExist(parentOfP2)).toEqual(false)

      const mkdirResult: VfsErrorCode | void = await vfs.mkdir(path.dirname(p1), true)
      expect(isVfsOperationSucceed(mkdirResult)).toEqual(true)

      const copyResult: VfsErrorCode | void = await vfs.copy(physicalPath, p1, true, false)
      expect(isVfsOperationSucceed(copyResult)).toEqual(true)

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(true)
      expect(await vfs.isExist(p2)).toEqual(false)
      expect(await vfs.isExist(parentOfP2)).toEqual(false)

      const copyResult2: VfsErrorCode | void = await vfs.copy(physicalPath, parentOfP2, true, false)
      expect(isVfsOperationSucceed(copyResult2)).toEqual(true)

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(true)
      expect(await vfs.isExist(p2)).toEqual(false)
      expect(await vfs.isFile(parentOfP2)).toEqual(true)

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_PARENT_NOT_DIRECTORY)
        expect(await vfs.isFile(physicalPath)).toEqual(true)
        expect(await vfs.isExist(p1)).toEqual(true)
        expect(await vfs.isExist(p2)).toEqual(false)
      }

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_PARENT_NOT_DIRECTORY)
        expect(await vfs.isFile(physicalPath)).toEqual(true)
        expect(await vfs.isExist(p1)).toEqual(true)
        expect(await vfs.isExist(p2)).toEqual(false)
      }
    })

    test('target is exist', async () => {
      const physicalPath: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      const p1: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/a.md')
      const p2: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/b/c.md')

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(false)
      expect(await vfs.isExist(p2)).toEqual(false)

      const mkdirResult: VfsErrorCode | void = await vfs.mkdir(path.dirname(p1), true)
      expect(isVfsOperationSucceed(mkdirResult)).toEqual(true)

      const copyResult: VfsErrorCode | void = await vfs.copy(physicalPath, p1, true, false)
      expect(isVfsOperationSucceed(copyResult)).toEqual(true)

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(true)
      expect(await vfs.isExist(p2)).toEqual(false)

      const mkdirResult2: VfsErrorCode | void = await vfs.mkdir(path.dirname(p2), true)
      expect(isVfsOperationSucceed(mkdirResult2)).toEqual(true)

      const copyResult2: VfsErrorCode | void = await vfs.copy(physicalPath, p2, true, false)
      expect(isVfsOperationSucceed(copyResult2)).toEqual(true)

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isFile(p1)).toEqual(true)
      expect(await vfs.isFile(p2)).toEqual(true)

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_EXIST)
        expect(await vfs.isFile(physicalPath)).toEqual(true)
        expect(await vfs.isExist(p1)).toEqual(true)
        expect(await vfs.isExist(p2)).toEqual(true)
      }

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, true)
        expect(isVfsOperationSucceed(result)).toEqual(true)
        expect(await vfs.isFile(physicalPath)).toEqual(true)
        expect(await vfs.isExist(p1)).toEqual(false)
        expect(await vfs.isExist(p2)).toEqual(true)
      }
    })

    test('target is directory', async () => {
      const physicalPath: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      const p1: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/a.md')
      const p2: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/b/c.md')

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(false)
      expect(await vfs.isExist(p2)).toEqual(false)

      const mkdirResult: VfsErrorCode | void = await vfs.mkdir(path.dirname(p1), true)
      expect(isVfsOperationSucceed(mkdirResult)).toEqual(true)

      const copyResult: VfsErrorCode | void = await vfs.copy(physicalPath, p1, true, false)
      expect(isVfsOperationSucceed(copyResult)).toEqual(true)

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(true)
      expect(await vfs.isExist(p2)).toEqual(false)

      const mkdirResult2: VfsErrorCode | void = await vfs.mkdir(p2, true)
      expect(isVfsOperationSucceed(mkdirResult2)).toEqual(true)

      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isFile(p1)).toEqual(true)
      expect(await vfs.isDirectory(p2)).toEqual(true)

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_EXIST)
        expect(await vfs.isFile(physicalPath)).toEqual(true)
        expect(await vfs.isFile(p1)).toEqual(true)
        expect(await vfs.isDirectory(p2)).toEqual(true)
      }

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_IS_DIRECTORY)
        expect(await vfs.isFile(physicalPath)).toEqual(true)
        expect(await vfs.isFile(p1)).toEqual(true)
        expect(await vfs.isDirectory(p2)).toEqual(true)
      }
    })

    test('target is not directory', async () => {
      const physicalPath: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      const parentOfSrc: string = path.dirname(physicalPath)
      const p1: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/a')
      const p2: string = path.join(FIXTURE_VIRTUAL_DIR, 'tmp/b/c')

      expect(await vfs.isDirectory(parentOfSrc)).toEqual(true)
      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isExist(p1)).toEqual(false)
      expect(await vfs.isExist(p2)).toEqual(false)

      const mkdirResult: VfsErrorCode | void = await vfs.mkdir(path.dirname(p1), true)
      expect(isVfsOperationSucceed(mkdirResult)).toEqual(true)

      const copyResult: VfsErrorCode | void = await vfs.copy(parentOfSrc, p1, true, true)
      expect(isVfsOperationSucceed(copyResult)).toEqual(true)

      expect(await vfs.isDirectory(parentOfSrc)).toEqual(true)
      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isDirectory(p1)).toEqual(true)
      expect(await vfs.isExist(p2)).toEqual(false)

      const mkdirResult2: VfsErrorCode | void = await vfs.mkdir(path.dirname(p2), true)
      expect(isVfsOperationSucceed(mkdirResult2)).toEqual(true)

      expect(await vfs.isDirectory(parentOfSrc)).toEqual(true)
      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isDirectory(p1)).toEqual(true)
      expect(await vfs.isExist(p2)).toEqual(false)

      const copyResult2: VfsErrorCode | void = await vfs.copy(physicalPath, p2, true, false)
      expect(isVfsOperationSucceed(copyResult2)).toEqual(true)

      expect(await vfs.isDirectory(parentOfSrc)).toEqual(true)
      expect(await vfs.isFile(physicalPath)).toEqual(true)
      expect(await vfs.isDirectory(p1)).toEqual(true)
      expect(await vfs.isFile(p2)).toEqual(true)

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_EXIST)
        expect(await vfs.isDirectory(parentOfSrc)).toEqual(true)
        expect(await vfs.isDirectory(p1)).toEqual(true)
        expect(await vfs.isFile(p2)).toEqual(true)
      }

      {
        const result: VfsErrorCode | void = await vfs.rename(p1, p2, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.TARGET_NOT_DIRECTORY)
        expect(await vfs.isDirectory(parentOfSrc)).toEqual(true)
        expect(await vfs.isDirectory(p1)).toEqual(true)
        expect(await vfs.isFile(p2)).toEqual(true)
      }
    })
  })

  describe('stat', () => {
    it('source is not found', async () => {
      const p: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1)
      expect(await vfs.isExist(p)).toEqual(false)

      const result: VfsErrorCode | IVfsFileStat = await vfs.stat(p)
      expect(isVfsOperationSucceed(result)).toEqual(false)
      expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })

    it('folder', async () => {
      const p: string = path.dirname(path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1))
      expect(await vfs.isExist(p)).toEqual(true)

      const result: VfsErrorCode | IVfsFileStat = await vfs.stat(p)
      expect(isVfsOperationSucceed(result)).toEqual(true)

      invariant(isVfsOperationSucceed(result))
      expect(result.type).toEqual(VfsFileType.DIRECTORY)
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })

    it('file', async () => {
      const p: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      expect(await vfs.isExist(p)).toEqual(true)

      const result: VfsErrorCode | IVfsFileStat = await vfs.stat(p)
      expect(isVfsOperationSucceed(result)).toEqual(true)

      invariant(isVfsOperationSucceed(result))
      expect(result.type).toEqual(VfsFileType.FILE)
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })
  })

  describe('write', () => {
    const content: Uint8Array = text2bytes('hello world', 'utf8')

    it('source is not found', async () => {
      const p: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1 + '_non-exist')
      expect(await vfs.isExist(p)).toEqual(false)

      {
        const result: VfsErrorCode | void = await vfs.write(p, content, false, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
      }

      {
        const result: VfsErrorCode | void = await vfs.write(p, content, false, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
      }

      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })

    it('source parent is not found', async () => {
      const p: string = path.join(FIXTURE_VIRTUAL_DIR, 'non-exist', 'a.md')
      expect(await vfs.isExist(path.dirname(p))).toEqual(false)

      {
        const result: VfsErrorCode | void = await vfs.write(p, content, true, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_PARENT_NOT_FOUND)
      }

      {
        const result: VfsErrorCode | void = await vfs.write(p, content, true, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_PARENT_NOT_FOUND)
      }

      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })

    it('source parent is not directory', async () => {
      const p: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1, 'a.md')
      expect(await vfs.isExist(path.dirname(p))).toEqual(true)
      expect(await vfs.isFile(path.dirname(p))).toEqual(true)

      {
        const result: VfsErrorCode | void = await vfs.write(p, content, true, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY)
      }

      {
        const result: VfsErrorCode | void = await vfs.write(p, content, true, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY)
      }

      {
        const result: VfsErrorCode | void = await vfs.write(p, content, false, true)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
      }

      {
        const result: VfsErrorCode | void = await vfs.write(p, content, false, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_NOT_FOUND)
      }

      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })

    it('source is exist', async () => {
      const src: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
      const p: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1)

      const mkdirResult: VfsErrorCode | void = await vfs.mkdir(path.dirname(p), true)
      expect(isVfsOperationSucceed(mkdirResult)).toEqual(true)

      const copyResult: VfsErrorCode | void = await vfs.copy(src, p, true, false)
      expect(isVfsOperationSucceed(copyResult)).toEqual(true)

      expect(await vfs.isExist(p)).toEqual(true)
      expect(await vfs.isFile(p)).toEqual(true)

      {
        const result: VfsErrorCode | void = await vfs.write(p, content, true, false)
        expect(isVfsOperationSucceed(result)).toEqual(false)
        expect(result).toEqual(VfsErrorCode.SOURCE_EXIST)
      }

      {
        const c: VfsErrorCode | Uint8Array = await vfs.read(p)
        expect(isVfsOperationSucceed(c)).toEqual(true)
        expect(c).toEqual(CONTENT_1)

        const result: VfsErrorCode | void = await vfs.write(p, content, true, true)
        expect(isVfsOperationSucceed(result)).toEqual(true)
        expect(result).toEqual(undefined)

        const d: VfsErrorCode | Uint8Array = await vfs.read(p)
        expect(isVfsOperationSucceed(c)).toEqual(true)
        expect(d).toEqual(content)
      }

      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
    })
  })
})
