import type {
  IFileTreeFileNode,
  IFileTreeFileNodeInstance,
  IFileTreeFolderNode,
  IFileTreeFolderNodeInstance,
  IFileTreeNode,
  IFileTreeNodeInstance,
} from '@guanghechen/filetree.types'
import { FileTreeErrorCodeEnum, FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'

const fileTreeNodeTypeEnumSet = new Set<FileTreeErrorCodeEnum>([
  FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER,
  FileTreeErrorCodeEnum.DST_NODE_EXIST,
  FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER,
  FileTreeErrorCodeEnum.DST_NODE_NONEXISTENT,
  FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT,
  FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
  FileTreeErrorCodeEnum.SRC_NODE_EXIST,
  FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT,
  FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FILE,
  FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FOLDER,
  FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY,
])

export function isFileTreeOperationSucceed<T extends Exclude<unknown, FileTreeErrorCodeEnum>>(
  codeOrResult: T | FileTreeErrorCodeEnum,
): codeOrResult is T {
  return !fileTreeNodeTypeEnumSet.has(codeOrResult as FileTreeErrorCodeEnum)
}

export function isFileTreeOperationFailed<T extends Exclude<unknown, FileTreeErrorCodeEnum>>(
  codeOrResult: T | FileTreeErrorCodeEnum,
): codeOrResult is FileTreeErrorCodeEnum {
  return fileTreeNodeTypeEnumSet.has(codeOrResult as FileTreeErrorCodeEnum)
}

export function isFileTreeFileNode(
  node: IFileTreeNode | FileTreeErrorCodeEnum | undefined,
): node is IFileTreeFileNode {
  if (node === undefined) return false
  if (isFileTreeOperationFailed(node)) return false
  return node.type === FileTreeNodeTypeEnum.FILE
}

export function isFileTreeFolderNode(
  node: IFileTreeNode | FileTreeErrorCodeEnum | undefined,
): node is IFileTreeFolderNode {
  if (node === undefined) return false
  if (isFileTreeOperationFailed(node)) return false
  return node.type === FileTreeNodeTypeEnum.FOLDER
}

export function isFileTreeFileNodeInstance(
  node: IFileTreeNodeInstance | FileTreeErrorCodeEnum | undefined,
): node is IFileTreeFileNodeInstance {
  if (node === undefined) return false
  if (isFileTreeOperationFailed(node)) return false
  return node.type === FileTreeNodeTypeEnum.FILE
}

export function isFileTreeFolderNodeInstance(
  node: IFileTreeNodeInstance | FileTreeErrorCodeEnum | undefined,
): node is IFileTreeFolderNodeInstance {
  if (node === undefined) return false
  if (isFileTreeOperationFailed(node)) return false
  return node.type === FileTreeNodeTypeEnum.FOLDER
}
