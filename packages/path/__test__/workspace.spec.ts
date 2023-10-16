import type { IWorkspacePathResolver } from '@guanghechen/path.types'
import path from 'node:path'
import { PhysicalWorkspacePathResolver } from '../src/PhysicalWorkspacePathResolver'
import { VirtualWorkspacePathResolver } from '../src/VirtualWorkspacePathResolver'

describe('VirtualWorkspacePathResolver', () => {
  let workspacePathResolver: IWorkspacePathResolver

  beforeEach(() => {
    workspacePathResolver = new VirtualWorkspacePathResolver('/waw')
  })

  test('isSafePath', () => {
    expect(workspacePathResolver.isSafePath('/waw')).toEqual(true)
    expect(workspacePathResolver.isSafePath('/waw/')).toEqual(true)
    expect(workspacePathResolver.isSafePath('/waw/a')).toEqual(true)
    expect(workspacePathResolver.isSafePath('/wawa')).toEqual(false)
    expect(workspacePathResolver.isSafePath('')).toEqual(true)
    expect(workspacePathResolver.isSafePath('waw')).toEqual(true)
  })

  test('resolve', () => {
    expect(workspacePathResolver.resolve('a/b/c')).toEqual('/waw/a/b/c')
    expect(workspacePathResolver.resolve('/waw/a/b/c')).toEqual('/waw/a/b/c')
    expect(() => workspacePathResolver.resolve('/a/b/c')).toThrow(/not under the root/)
  })

  test('relative', () => {
    expect(workspacePathResolver.relative('/waw/a')).toEqual('a')
    expect(workspacePathResolver.relative('/waw/a/b/c')).toEqual('a/b/c')
    expect(() => workspacePathResolver.relative('/a')).toThrow(/not under the root/)
    expect(() => workspacePathResolver.relative('../a')).toThrow(/not under the root/)
  })
})

if (path.sep === '/') {
  describe('PhysicalWorkspacePathResolver', () => {
    let workspacePathResolver: IWorkspacePathResolver

    beforeEach(() => {
      workspacePathResolver = new PhysicalWorkspacePathResolver('/waw')
    })

    test('isSafePath', () => {
      expect(workspacePathResolver.isSafePath('/waw')).toEqual(true)
      expect(workspacePathResolver.isSafePath('/waw/')).toEqual(true)
      expect(workspacePathResolver.isSafePath('/waw/a')).toEqual(true)
      expect(workspacePathResolver.isSafePath('/wawa')).toEqual(false)
      expect(workspacePathResolver.isSafePath('')).toEqual(true)
      expect(workspacePathResolver.isSafePath('waw')).toEqual(true)
    })

    test('resolve', () => {
      expect(workspacePathResolver.resolve('a/b/c')).toEqual('/waw/a/b/c')
      expect(workspacePathResolver.resolve('/waw/a/b/c')).toEqual('/waw/a/b/c')
      expect(() => workspacePathResolver.resolve('/a/b/c')).toThrow(/not under the root/)
      expect(() => workspacePathResolver.ensureSafePath('/a/b/c')).toThrow(/not under the root/)
    })

    test('relative', () => {
      expect(workspacePathResolver.relative('/waw/a')).toEqual('a')
      expect(workspacePathResolver.relative('/waw/a/b/c')).toEqual('a/b/c')
      expect(() => workspacePathResolver.relative('/a')).toThrow(/not under the root/)
      expect(() => workspacePathResolver.ensureSafePath('/a')).toThrow(/not under the root/)
    })
  })
}
