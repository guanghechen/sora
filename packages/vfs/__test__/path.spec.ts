import { DEFAULT_FILEPART_CODE_PREFIX } from '@guanghechen/filepart'
import type { IVfsPathResolver } from '@guanghechen/vfs.types'
import path from 'node:path'
import { VfsPathResolver } from '../src'
import { simple } from './_data'

describe('simple', () => {
  const { FIXTURE_PHYSICAL_DIR, FIXTURE_VIRTUAL_DIR, FILEPATH_1, FILEPATH_2 } = simple

  let pathResolver: IVfsPathResolver
  beforeAll(() => {
    pathResolver = new VfsPathResolver({
      FILEPART_CODE_PREFIX: DEFAULT_FILEPART_CODE_PREFIX,
      physicalRoot: FIXTURE_PHYSICAL_DIR,
      virtualRoot: FIXTURE_VIRTUAL_DIR,
    })
  })

  it('physicalRoot', () => {
    expect(pathResolver.physicalRoot).toBe(FIXTURE_PHYSICAL_DIR)
  })

  it('virtualRoot', () => {
    expect(pathResolver.virtualRoot).toBe(FIXTURE_VIRTUAL_DIR)
  })

  it('dirPhysicalPath', () => {
    const c: string = path.join(FIXTURE_PHYSICAL_DIR, 'a/b/c/d/e/f/g')
    expect(pathResolver.dirPhysicalPath(c)).toBe(path.join(FIXTURE_PHYSICAL_DIR, 'a/b/c/d/e/f'))
  })

  it('dirVirtualPath', () => {
    const c: string = path.join(FIXTURE_VIRTUAL_DIR, 'a/b/c/d/e/f/g')
    expect(pathResolver.dirVirtualPath(c)).toBe(path.join(FIXTURE_VIRTUAL_DIR, 'a/b/c/d/e/f'))
  })

  it('isPhysicalPath', () => {
    expect(pathResolver.isPhysicalPath(FIXTURE_PHYSICAL_DIR)).toEqual(true)
    expect(pathResolver.isPhysicalPath(FIXTURE_VIRTUAL_DIR)).toEqual(false)

    expect(pathResolver.isPhysicalPath(path.join(FIXTURE_PHYSICAL_DIR, 'a/b/c'))).toEqual(true)
    expect(pathResolver.isPhysicalPath(path.join(FIXTURE_VIRTUAL_DIR, 'a/b/c'))).toEqual(false)
  })

  it('isVirtualPath', () => {
    expect(pathResolver.isVirtualPath(FIXTURE_PHYSICAL_DIR)).toEqual(false)
    expect(pathResolver.isVirtualPath(FIXTURE_VIRTUAL_DIR)).toEqual(true)

    expect(pathResolver.isVirtualPath(path.join(FIXTURE_PHYSICAL_DIR, 'a/b/c'))).toEqual(false)
    expect(pathResolver.isVirtualPath(path.join(FIXTURE_VIRTUAL_DIR, 'a/b/c'))).toEqual(true)
  })

  it('isPhysicalPathExist', () => {
    const p1: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
    const p2: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2)
    const p3: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1 + 'non-exist')
    const p4: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2 + 'non-exist')
    expect(pathResolver.isPhysicalPathExist(p1)).toEqual(true)
    expect(pathResolver.isPhysicalPathExist(p2)).toEqual(true)
    expect(pathResolver.isPhysicalPathExist(p3)).toEqual(false)
    expect(pathResolver.isPhysicalPathExist(p4)).toEqual(false)
  })

  it('joinPhysicalPath', () => {
    const p1: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
    const p2: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2)
    const p3: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1 + 'non-exist')
    const p4: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2 + 'non-exist')
    expect(pathResolver.joinPhysicalPath(FIXTURE_PHYSICAL_DIR, FILEPATH_1)).toEqual(p1)
    expect(pathResolver.joinPhysicalPath(FIXTURE_PHYSICAL_DIR, FILEPATH_2)).toEqual(p2)
    expect(pathResolver.joinPhysicalPath(FIXTURE_PHYSICAL_DIR, FILEPATH_1 + 'non-exist')).toEqual(
      p3,
    )
    expect(pathResolver.joinPhysicalPath(FIXTURE_PHYSICAL_DIR, FILEPATH_2 + 'non-exist')).toEqual(
      p4,
    )
  })

  it('joinVirtualPath', () => {
    const v1: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1)
    const v2: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2)
    const v3: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1 + 'non-exist')
    const v4: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2 + 'non-exist')
    expect(pathResolver.joinVirtualPath(FIXTURE_VIRTUAL_DIR, FILEPATH_1)).toEqual(v1)
    expect(pathResolver.joinVirtualPath(FIXTURE_VIRTUAL_DIR, FILEPATH_2)).toEqual(v2)
    expect(pathResolver.joinVirtualPath(FIXTURE_VIRTUAL_DIR, FILEPATH_1 + 'non-exist')).toEqual(v3)
    expect(pathResolver.joinVirtualPath(FIXTURE_VIRTUAL_DIR, FILEPATH_2 + 'non-exist')).toEqual(v4)
  })

  it('locatePhysicalPath', () => {
    const v1: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1)
    const v2: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2)
    const v3: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1 + 'non-exist')
    const v4: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2 + 'non-exist')
    const p1: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
    const p2: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2)
    const p3: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1 + 'non-exist')
    const p4: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2 + 'non-exist')

    expect(pathResolver.locatePhysicalPath(v1)).toEqual({ physicalPath: p1, partTotal: 1 })
    expect(pathResolver.locatePhysicalPath(v2)).toEqual({ physicalPath: p2, partTotal: 1 })
    expect(pathResolver.locatePhysicalPath(v3)).toEqual({ physicalPath: p3, partTotal: 0 })
    expect(pathResolver.locatePhysicalPath(v4)).toEqual({ physicalPath: p4, partTotal: 0 })
    expect(() => pathResolver.locatePhysicalPath(p1)).toThrow('bad virtual path.')
    expect(() => pathResolver.locatePhysicalPath(p2)).toThrow('bad virtual path.')
    expect(() => pathResolver.locatePhysicalPath(p3)).toThrow('bad virtual path.')
    expect(() => pathResolver.locatePhysicalPath(p4)).toThrow('bad virtual path.')
  })

  it('normalizePhysicalPath', () => {
    const v1: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1)
    const v2: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2)
    const v3: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1 + 'non-exist')
    const v4: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2 + 'non-exist')
    const p1: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
    const p2: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2)
    const p3: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1 + 'non-exist')
    const p4: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2 + 'non-exist')

    expect(() => pathResolver.normalizePhysicalPath(v1)).toThrow('bad physical path.')
    expect(() => pathResolver.normalizePhysicalPath(v2)).toThrow('bad physical path.')
    expect(() => pathResolver.normalizePhysicalPath(v3)).toThrow('bad physical path.')
    expect(() => pathResolver.normalizePhysicalPath(v4)).toThrow('bad physical path.')
    expect(pathResolver.normalizePhysicalPath(p1)).toEqual(p1.replace(/\\/g, '/'))
    expect(pathResolver.normalizePhysicalPath(p2)).toEqual(p2.replace(/\\/g, '/'))
    expect(pathResolver.normalizePhysicalPath(p3)).toEqual(p3.replace(/\\/g, '/'))
    expect(pathResolver.normalizePhysicalPath(p4)).toEqual(p4.replace(/\\/g, '/'))
  })

  it('normalizeVirtualPath', () => {
    const v1: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1)
    const v2: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2)
    const v3: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_1 + 'non-exist')
    const v4: string = path.join(FIXTURE_VIRTUAL_DIR, FILEPATH_2 + 'non-exist')
    const p1: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1)
    const p2: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2)
    const p3: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_1 + 'non-exist')
    const p4: string = path.join(FIXTURE_PHYSICAL_DIR, FILEPATH_2 + 'non-exist')

    expect(pathResolver.normalizeVirtualPath(v1)).toEqual(v1.replace(/\\/g, '/'))
    expect(pathResolver.normalizeVirtualPath(v2)).toEqual(v2.replace(/\\/g, '/'))
    expect(pathResolver.normalizeVirtualPath(v3)).toEqual(v3.replace(/\\/g, '/'))
    expect(pathResolver.normalizeVirtualPath(v4)).toEqual(v4.replace(/\\/g, '/'))
    expect(() => pathResolver.normalizeVirtualPath(p1)).toThrow('bad virtual path.')
    expect(() => pathResolver.normalizeVirtualPath(p2)).toThrow('bad virtual path.')
    expect(() => pathResolver.normalizeVirtualPath(p3)).toThrow('bad virtual path.')
    expect(() => pathResolver.normalizeVirtualPath(p4)).toThrow('bad virtual path.')
  })
})
