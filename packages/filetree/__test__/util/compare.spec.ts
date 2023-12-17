import {
  FileTreeFileNode,
  FileTreeFolderNode,
  caseSensitiveCmp,
  comparePathFromRoot,
  compareTreeNode,
} from '../../src'

describe('compareTreeNode', () => {
  const folder1 = FileTreeFolderNode.create('a', [])
  const folder2 = FileTreeFolderNode.create('b', [])
  const file1 = FileTreeFileNode.create('a', 0, 0, 0)
  const file2 = FileTreeFileNode.create('b', 0, 0, 0)

  test('folder vs folder', () => {
    expect(compareTreeNode(folder1, folder1, caseSensitiveCmp)).toEqual(0)
    expect(compareTreeNode(folder2, folder2, caseSensitiveCmp)).toEqual(0)
    expect(compareTreeNode(folder1, folder2, caseSensitiveCmp)).toEqual(-1)
    expect(compareTreeNode(folder2, folder1, caseSensitiveCmp)).toEqual(1)
  })

  test('folder vs file', () => {
    expect(compareTreeNode(folder1, file1, caseSensitiveCmp)).toEqual(-1)
    expect(compareTreeNode(file1, folder1, caseSensitiveCmp)).toEqual(1)

    expect(compareTreeNode(folder1, file2, caseSensitiveCmp)).toEqual(-1)
    expect(compareTreeNode(file2, folder1, caseSensitiveCmp)).toEqual(1)

    expect(compareTreeNode(folder2, file1, caseSensitiveCmp)).toEqual(-1)
    expect(compareTreeNode(file1, folder2, caseSensitiveCmp)).toEqual(1)

    expect(compareTreeNode(folder2, file2, caseSensitiveCmp)).toEqual(-1)
    expect(compareTreeNode(file2, folder2, caseSensitiveCmp)).toEqual(1)
  })

  test('file vs file', () => {
    expect(compareTreeNode(file1, file1, caseSensitiveCmp)).toEqual(0)
    expect(compareTreeNode(file2, file2, caseSensitiveCmp)).toEqual(0)
    expect(compareTreeNode(file1, file2, caseSensitiveCmp)).toEqual(-1)
    expect(compareTreeNode(file2, file1, caseSensitiveCmp)).toEqual(1)
  })
})

describe('comparePathFromRoot', () => {
  const pathFromRoot1 = ['a', 'b', 'c']
  const pathFromRoot2 = ['a', 'b', 'd']
  const pathFromRoot3 = ['a', 'b']
  const pathFromRoot4 = ['a', 'b', 'c', 'd']
  const pathFromRoot5 = ['a', 'f', 'b', 'h']

  test('same length', () => {
    expect(comparePathFromRoot([], [], caseSensitiveCmp)).toEqual(0)
    expect(comparePathFromRoot(pathFromRoot1, pathFromRoot1, caseSensitiveCmp)).toEqual(0)
    expect(comparePathFromRoot(pathFromRoot2, pathFromRoot2, caseSensitiveCmp)).toEqual(0)
    expect(comparePathFromRoot(pathFromRoot3, pathFromRoot3, caseSensitiveCmp)).toEqual(0)
    expect(comparePathFromRoot(pathFromRoot4, pathFromRoot4, caseSensitiveCmp)).toEqual(0)
    expect(comparePathFromRoot(pathFromRoot5, pathFromRoot5, caseSensitiveCmp)).toEqual(0)

    expect(comparePathFromRoot(pathFromRoot1, pathFromRoot2, caseSensitiveCmp)).toBeLessThan(0)
    expect(comparePathFromRoot(pathFromRoot2, pathFromRoot1, caseSensitiveCmp)).toBeGreaterThan(0)

    expect(comparePathFromRoot(pathFromRoot4, pathFromRoot5, caseSensitiveCmp)).toBeLessThan(0)
    expect(comparePathFromRoot(pathFromRoot5, pathFromRoot4, caseSensitiveCmp)).toBeGreaterThan(0)
  })

  test('different length', () => {
    expect(comparePathFromRoot([], pathFromRoot1, caseSensitiveCmp)).toBeLessThan(0)
    expect(comparePathFromRoot(pathFromRoot1, [], caseSensitiveCmp)).toBeGreaterThan(0)

    expect(comparePathFromRoot(pathFromRoot1, pathFromRoot3, caseSensitiveCmp)).toBeGreaterThan(0)
    expect(comparePathFromRoot(pathFromRoot3, pathFromRoot1, caseSensitiveCmp)).toBeLessThan(0)

    expect(comparePathFromRoot(pathFromRoot1, pathFromRoot4, caseSensitiveCmp)).toBeLessThan(0)
    expect(comparePathFromRoot(pathFromRoot4, pathFromRoot1, caseSensitiveCmp)).toBeGreaterThan(0)

    expect(comparePathFromRoot(pathFromRoot1, pathFromRoot5, caseSensitiveCmp)).toBeLessThan(0)
    expect(comparePathFromRoot(pathFromRoot5, pathFromRoot1, caseSensitiveCmp)).toBeGreaterThan(0)
  })
})
