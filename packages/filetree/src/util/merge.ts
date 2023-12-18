import type {
  IFileTreeFolderNodeInstance,
  IFileTreeNodeInstance,
  INodeNameCompare,
} from '@guanghechen/filetree.types'
import { FileTreeErrorCodeEnum, FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import { FileTreeFolderNode } from '../node/folder'
import { isFileTreeOperationSucceed } from './is'

/**
 * Merge two filetree folder nodes recursively.
 *
 * !!!NOTE: The two filetree folder nodes must have the same name.
 *
 * @param dstFolder
 * @param srcFolder
 * @param overwrite for same named file node, whether if perform overwrite operation.
 * @param cmp
 */
export function mergeFileTreeFolderNodeRecursive(
  srcFolder: IFileTreeFolderNodeInstance,
  dstFolder: IFileTreeFolderNodeInstance,
  overwrite: boolean,
  cmp: INodeNameCompare,
):
  | FileTreeErrorCodeEnum.DST_NODE_EXIST
  | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
  | IFileTreeFolderNodeInstance {
  const srcChildren: ReadonlyArray<IFileTreeNodeInstance> = srcFolder.children
  const dstChildren: ReadonlyArray<IFileTreeNodeInstance> = dstFolder.children
  const children: IFileTreeNodeInstance[] = []

  let i: number = 0
  let j: number = 0
  for (; i < srcChildren.length && j < dstChildren.length; ) {
    const srcChild: IFileTreeNodeInstance = srcChildren[i]
    const dstChild: IFileTreeNodeInstance = dstChildren[j]
    const delta: number = cmp(srcChild.name, dstChild.name)

    if (delta < 0) {
      i += 1
      children.push(srcChild)
      continue
    }

    if (delta > 0) {
      j += 1
      children.push(dstChild)
      continue
    }

    // Handle same named nodes.
    j += 1
    i += 1

    if (srcChild.type !== dstChild.type) return FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT

    if (srcChild.type === FileTreeNodeTypeEnum.FILE) {
      if (!overwrite) return FileTreeErrorCodeEnum.DST_NODE_EXIST
      children.push(srcChild)
      continue
    }

    if (srcChild.type === FileTreeNodeTypeEnum.FOLDER) {
      const codeOrChild = mergeFileTreeFolderNodeRecursive(
        srcChild,
        dstChild as IFileTreeFolderNodeInstance,
        overwrite,
        cmp,
      )
      if (!isFileTreeOperationSucceed(codeOrChild)) return codeOrChild
      children.push(codeOrChild)
      continue
    }

    // Unknown type
    throw new TypeError(`[mergeFileTreeFolderNodeRecursive] bad node type ${dstChild.type}.`)
  }

  for (; i < srcChildren.length; ++i) children.push(srcChildren[i])
  for (; j < dstChildren.length; ++j) children.push(dstChildren[j])

  return FileTreeFolderNode.create(srcFolder.name, children)
}
