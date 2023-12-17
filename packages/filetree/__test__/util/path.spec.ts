import { splitPathFromRoot } from '../../src'

describe('splitPathFromRoot', () => {
  test('absolute path', () => {
    expect(() => splitPathFromRoot('/a/b/c')).toThrow(
      '[splitPathFromRoot] pathFromRoot should be a relative path',
    )

    expect(() => splitPathFromRoot('\\a/b/c')).toThrow(
      '[splitPathFromRoot] pathFromRoot should be a relative path',
    )
  })

  test('empty path', () => {
    expect(splitPathFromRoot('')).toEqual([])
    expect(splitPathFromRoot('.')).toEqual([])
    expect(splitPathFromRoot('../.')).toEqual([])
    expect(splitPathFromRoot('a/..')).toEqual([])
  })

  test('misc', () => {
    expect(splitPathFromRoot('a/b/c/d')).toEqual(['a', 'b', 'c', 'd'])
    expect(splitPathFromRoot('a/b/c/../d')).toEqual(['a', 'b', 'd'])
    expect(splitPathFromRoot('a/b/c/./d')).toEqual(['a', 'b', 'c', 'd'])
    expect(splitPathFromRoot('a/b/c///./d')).toEqual(['a', 'b', 'c', 'd'])
  })
})
