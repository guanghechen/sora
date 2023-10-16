import type { IWorkspacePathResolver } from '@guanghechen/path.types'
import path from 'node:path'
import { WorkspacePathResolver, pathResolver, urlPathResolver } from '../src'

describe('WorkspacePathResolver (url)', () => {
  let workspacePathResolver: IWorkspacePathResolver

  beforeEach(() => {
    workspacePathResolver = new WorkspacePathResolver('/waw', urlPathResolver)
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
  describe('WorkspacePathResolver', () => {
    let workspacePathResolver: IWorkspacePathResolver

    beforeEach(() => {
      workspacePathResolver = new WorkspacePathResolver('/waw', pathResolver)
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
