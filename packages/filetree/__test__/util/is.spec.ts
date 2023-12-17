import {
  FileTreeErrorCodeEnum,
  FileTreeFileNode,
  FileTreeFolderNode,
  isFileTreeFileNode,
  isFileTreeFileNodeInstance,
  isFileTreeFolderNode,
  isFileTreeFolderNodeInstance,
  isFileTreeOperationFailed,
  isFileTreeOperationSucceed,
} from '../../src'

test('isFileTreeOperationSucceed', () => {
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER)).toEqual(false)
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.DST_NODE_EXIST)).toEqual(false)
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER)).toEqual(false)
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.DST_NODE_NONEXISTENT)).toEqual(false)
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT)).toEqual(false)
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER)).toEqual(false)
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.SRC_NODE_EXIST)).toEqual(false)
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT)).toEqual(false)
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FOLDER)).toEqual(false)
  expect(isFileTreeOperationSucceed(FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY)).toEqual(false)
  expect(isFileTreeOperationSucceed(undefined)).toEqual(true)
  expect(isFileTreeOperationSucceed(null)).toEqual(true)
  expect(isFileTreeOperationSucceed(0)).toEqual(true)
  expect(isFileTreeOperationSucceed(false)).toEqual(true)
  expect(isFileTreeOperationSucceed('')).toEqual(true)
  expect(isFileTreeOperationSucceed(true)).toEqual(true)
  expect(isFileTreeOperationSucceed(1)).toEqual(true)
  expect(isFileTreeOperationSucceed({})).toEqual(true)
  expect(isFileTreeOperationSucceed([])).toEqual(true)
  expect(isFileTreeOperationSucceed(() => {})).toEqual(true)
})

test('isFileTreeOperationFailed', () => {
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER)).toEqual(true)
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.DST_NODE_EXIST)).toEqual(true)
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER)).toEqual(true)
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.DST_NODE_NONEXISTENT)).toEqual(true)
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT)).toEqual(true)
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER)).toEqual(true)
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.SRC_NODE_EXIST)).toEqual(true)
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT)).toEqual(true)
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FOLDER)).toEqual(true)
  expect(isFileTreeOperationFailed(FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY)).toEqual(true)
  expect(isFileTreeOperationFailed(undefined)).toEqual(false)
  expect(isFileTreeOperationFailed(null)).toEqual(false)
  expect(isFileTreeOperationFailed(0)).toEqual(false)
  expect(isFileTreeOperationFailed(false)).toEqual(false)
  expect(isFileTreeOperationFailed('')).toEqual(false)
  expect(isFileTreeOperationFailed(true)).toEqual(false)
  expect(isFileTreeOperationFailed(1)).toEqual(false)
  expect(isFileTreeOperationFailed({})).toEqual(false)
  expect(isFileTreeOperationFailed([])).toEqual(false)
  expect(isFileTreeOperationFailed(() => {})).toEqual(false)
})

describe('node', () => {
  const file = FileTreeFileNode.create('alice', 20, 30, 40)
  const folder = FileTreeFolderNode.create('bob', [file])

  test('pretest', () => {
    expect(isFileTreeOperationFailed(undefined)).toBe(false)
    expect(isFileTreeOperationFailed(file)).toBe(false)
    expect(isFileTreeOperationFailed(folder)).toBe(false)
  })

  test('isFileTreeFileNode', () => {
    expect(isFileTreeFileNode(file)).toBe(true)
    expect(isFileTreeFileNode(file.toJSON())).toBe(true)
    expect(isFileTreeFileNode(folder)).toBe(false)
    expect(isFileTreeFileNode(folder.toJSON())).toBe(false)
  })

  test('isFileTreeFolderNode', () => {
    expect(isFileTreeFolderNode(file)).toBe(false)
    expect(isFileTreeFolderNode(file.toJSON())).toBe(false)
    expect(isFileTreeFolderNode(folder)).toBe(true)
    expect(isFileTreeFolderNode(folder.toJSON())).toBe(true)
  })

  test('isFileTreeFileNodeInstance', () => {
    expect(isFileTreeFileNodeInstance(file)).toBe(true)
    expect(isFileTreeFileNodeInstance(folder)).toBe(false)
  })

  test('isFileTreeFolderNodeInstance', () => {
    expect(isFileTreeFolderNodeInstance(file)).toBe(false)
    expect(isFileTreeFolderNodeInstance(folder)).toBe(true)
  })
})
