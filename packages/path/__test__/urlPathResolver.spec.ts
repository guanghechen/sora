import type { IPathResolver } from '@guanghechen/path.types'
import { UrlPathResolver } from '../src'

describe('UrlPathResolver', () => {
  let pathResolver: IPathResolver

  beforeEach(() => {
    pathResolver = new UrlPathResolver()
  })

  it('basename', () => {
    expect(pathResolver.basename('/a/b/c')).toEqual('c')
    expect(pathResolver.basename('/')).toEqual('')
    expect(() => pathResolver.basename('a/b/c')).toThrow(/not an absolute path/)
    expect(() => pathResolver.basename('')).toThrow(/not an absolute path/)
  })

  it('dirname', () => {
    expect(pathResolver.dirname('/a/b/c')).toEqual('/a/b')
    expect(pathResolver.dirname('/')).toEqual('/')
    expect(() => pathResolver.dirname('a/b/c')).toThrow(/not an absolute path/)
    expect(() => pathResolver.dirname('')).toThrow(/not an absolute path/)
  })

  it('isAbsolute', () => {
    expect(pathResolver.isAbsolute('/')).toEqual(true)
    expect(pathResolver.isAbsolute('/a/b')).toEqual(true)
    expect(pathResolver.isAbsolute('')).toEqual(false)
    expect(pathResolver.isAbsolute('a/b')).toEqual(false)
  })

  it('join', () => {
    expect(pathResolver.join('/a/b/c', 'd')).toEqual('/a/b/c/d')
    expect(pathResolver.join('/a/b/c/', 'd', 'e')).toEqual('/a/b/c/d/e')
    expect(pathResolver.join('/', 'd')).toEqual('/d')
    expect(pathResolver.join('/', 'd/')).toEqual('/d')
    expect(pathResolver.join('/', 'd/', 'e/')).toEqual('/d/e')
    expect(pathResolver.join('/', 'd/', 'e/', '..')).toEqual('/d')
    expect(pathResolver.join('/', 'd/', 'e/', '..', '..')).toEqual('/')
    expect(pathResolver.join('/', 'd/', 'e/', '..', '..', '..')).toEqual('/')
    expect(pathResolver.join('/', '../a')).toEqual('/a')
    expect(() => pathResolver.join('', 'd')).toThrow(/not an absolute path/)
    expect(() => pathResolver.join('/', 'd', '/e')).toThrow(/pathPiece shouldn't be absolute path./)
  })

  it('normalize', () => {
    expect(pathResolver.normalize('/a/../b')).toEqual('/b')
    expect(pathResolver.normalize('/a/.//c/./b')).toEqual('/a/c/b')
  })

  it('relative', () => {
    expect(pathResolver.relative('/waw', '/wawa')).toEqual('../wawa')
    expect(pathResolver.relative('/a/b/c', '/a/b/cd')).toEqual('../cd')
    expect(pathResolver.relative('/a/b/c', '/a/b/d')).toEqual('../d')
    expect(pathResolver.relative('/a/b/d', '/a/b/c')).toEqual('../c')
    expect(pathResolver.relative('/a/b/d', '/b')).toEqual('../../../b')
    expect(pathResolver.relative('/a/b/d', '/a/b/d/e')).toEqual('e')
  })
})
