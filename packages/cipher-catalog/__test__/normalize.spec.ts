import { WorkspacePathResolver, pathResolver } from '@guanghechen/path'
import { locateFixtures } from 'jest.helper'
import { normalizePlainPath } from '../src'

const plainRootDir = locateFixtures('basic')
const plainPathResolver = new WorkspacePathResolver(plainRootDir, pathResolver)

test('normalizePlainPath', () => {
  expect(normalizePlainPath('a.txt', plainPathResolver)).toEqual('a.txt')
  expect(normalizePlainPath('a.txt/', plainPathResolver)).toEqual('a.txt')
  expect(normalizePlainPath('./a.txt', plainPathResolver)).toEqual('a.txt')
  expect(normalizePlainPath('./a.txt/', plainPathResolver)).toEqual('a.txt')
  expect(normalizePlainPath('a/b/c//d/e/a.txt', plainPathResolver)).toEqual('a/b/c/d/e/a.txt')
  expect(() => normalizePlainPath('/a.txt', plainPathResolver)).toThrow('not under the root')
  expect(() => normalizePlainPath('../a.txt', plainPathResolver)).toThrow('not under the root')
  expect(() => normalizePlainPath('..', plainPathResolver)).toThrow('not under the root')
  expect(normalizePlainPath(plainPathResolver.resolve('a.txt'), plainPathResolver)).toEqual('a.txt')
})
