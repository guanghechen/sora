import type { IFileTreeNodeInstance, IRawFileTreeNode } from '@guanghechen/filetree.types'
import { FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import { FileTreeFileNode, FileTreeFolderNode } from '../node'

export function makeFileTreeLeafNode(
  name: string,
  rawNode: IRawFileTreeNode,
): IFileTreeNodeInstance {
  switch (rawNode.type) {
    case FileTreeNodeTypeEnum.FILE:
      return FileTreeFileNode.create(name, rawNode.ctime, rawNode.mtime, rawNode.size)
    case FileTreeNodeTypeEnum.FOLDER:
      return FileTreeFolderNode.create(name, [])
    /* c8 ignore start */
    default:
      throw new TypeError(`[makeFileTreeNode] unknown type (${(rawNode as any).type}).`)
    /* c8 ignore stop */
  }
}
