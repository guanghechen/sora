import type { IWorkspacePathResolver } from '@guanghechen/types'
import path from 'node:path'
import { WorkspacePathResolver, pathResolver, urlPathResolver } from '../src'

describe('WorkspacePathResolver (url)', () => {
  let workspacePathResolver: IWorkspacePathResolver

  beforeEach(() => {
    workspacePathResolver = new WorkspacePathResolver('/waw', urlPathResolver)
  })

  it('isSafePath', () => {
    expect(workspacePathResolver.isSafePath('/waw')).toEqual(true)
    expect(workspacePathResolver.isSafePath('/waw/')).toEqual(true)
    expect(workspacePathResolver.isSafePath('/waw/a')).toEqual(true)
    expect(workspacePathResolver.isSafePath('/wawa')).toEqual(false)
    expect(workspacePathResolver.isSafePath('')).toEqual(true)
    expect(workspacePathResolver.isSafePath('waw')).toEqual(true)
  })

  it('resolve', () => {
    expect(workspacePathResolver.resolve('a/b/c')).toEqual('/waw/a/b/c')
    expect(workspacePathResolver.resolve('/waw/a/b/c')).toEqual('/waw/a/b/c')
    expect(() => workspacePathResolver.resolve('/a/b/c')).toThrow(/not under the root/)
  })

  it('relative', () => {
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

    it('isSafePath', () => {
      expect(workspacePathResolver.isSafePath('/waw')).toEqual(true)
      expect(workspacePathResolver.isSafePath('/waw/')).toEqual(true)
      expect(workspacePathResolver.isSafePath('/waw/a')).toEqual(true)
      expect(workspacePathResolver.isSafePath('/wawa')).toEqual(false)
      expect(workspacePathResolver.isSafePath('')).toEqual(true)
      expect(workspacePathResolver.isSafePath('waw')).toEqual(true)
    })

    it('resolve', () => {
      expect(workspacePathResolver.resolve('a/b/c')).toEqual('/waw/a/b/c')
      expect(workspacePathResolver.resolve('/waw/a/b/c')).toEqual('/waw/a/b/c')
      expect(() => workspacePathResolver.resolve('/a/b/c')).toThrow(/not under the root/)
      expect(() => workspacePathResolver.ensureSafePath('/a/b/c')).toThrow(/not under the root/)
    })

    it('relative', () => {
      expect(workspacePathResolver.relative('/waw/a')).toEqual('a')
      expect(workspacePathResolver.relative('/waw/a/b/c')).toEqual('a/b/c')
      expect(() => workspacePathResolver.relative('/a')).toThrow(/not under the root/)
      expect(() => workspacePathResolver.ensureSafePath('/a')).toThrow(/not under the root/)
    })
  })
}
