import { WorkspacePathResolver, pathResolver } from '@guanghechen/path'
import { locateFixtures } from 'jest.helper'
import { normalizePlainFilepath } from '../src'

const plainRootDir = locateFixtures('basic')
const plainPathResolver = new WorkspacePathResolver(plainRootDir, pathResolver)

test('normalizePlainFilepath', () => {
  expect(normalizePlainFilepath('a.txt', plainPathResolver)).toEqual('a.txt')
  expect(normalizePlainFilepath('a.txt/', plainPathResolver)).toEqual('a.txt')
  expect(normalizePlainFilepath('./a.txt', plainPathResolver)).toEqual('a.txt')
  expect(normalizePlainFilepath('./a.txt/', plainPathResolver)).toEqual('a.txt')
  expect(normalizePlainFilepath('a/b/c//d/e/a.txt', plainPathResolver)).toEqual('a/b/c/d/e/a.txt')
  expect(() => normalizePlainFilepath('/a.txt', plainPathResolver)).toThrow('not under the root')
  expect(() => normalizePlainFilepath('../a.txt', plainPathResolver)).toThrow('not under the root')
  expect(() => normalizePlainFilepath('..', plainPathResolver)).toThrow('not under the root')
  expect(normalizePlainFilepath(plainPathResolver.resolve('a.txt'), plainPathResolver)).toEqual(
    'a.txt',
  )
})
