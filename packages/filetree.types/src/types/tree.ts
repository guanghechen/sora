import type { FileTreeErrorCodeEnum } from '../constant'
import type { IFileTreeFolderNodeInstance, IFileTreeRootNodeInstance } from './instance'
import type { IFileTreeDrawOptions } from './misc'
import type { IFileTreeFolderNode, IFileTreeNodeStat } from './node'
import type { IRawFileTreeNode } from './raw'

export interface IFileTree {
  readonly root: IFileTreeRootNodeInstance

  /**
   * Return a new root node instance which based on the given folder as the root.
   *
   * @param folder
   */
  attach(folder: IFileTreeFolderNodeInstance): void

  /**
   * Copy the srcPathFromRoot to dstPathFromRoot.
   *
   * @param srcPathFromRoot
   * @param dstPathFromRoot
   * @param overwrite
   * @param recursive
   */
  copy(
    srcPathFromRoot: ReadonlyArray<string>,
    dstPathFromRoot: ReadonlyArray<string>,
    overwrite: boolean,
    recursive: boolean,
  ):
    | FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER // When any ancestor node of the target node is not a folder.
    | FileTreeErrorCodeEnum.DST_NODE_EXIST // When the target node exist and overwrite set to false.
    | FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER // When the target node is a folder.
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT // When the src node type and dst node type are different.
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT // When the src node does not exist.
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node of the src node is not a folder.
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY // When the src node is a folder with at least one child and the recursive is not set.
    | void // When succeed.

  /**
   * Draw the file tree.
   *
   * @param options
   */
  draw(options?: IFileTreeDrawOptions): string[]

  /**
   * Insert a new tree node.
   *
   * @param rawNode
   * @param overwrite whether if overwrite if the node existed.
   */
  insert(
    rawNode: IRawFileTreeNode,
    overwrite: boolean,
  ):
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT // When the node existed but the type is different.
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node is not a folder.
    | FileTreeErrorCodeEnum.SRC_NODE_EXIST // When the node existed but overwrite set to false.
    | void // When succeed.

  /**
   * Return the names of the children of node located at the given path.
   *
   * @param pathFromRoot
   */
  readdir(pathFromRoot: ReadonlyArray<string>):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node is not a folder.
    | FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FOLDER // When the node is not a folder.
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT // When the node does not exist.
    | string[] // When succeed.

  /**
   * Remove a tree node by path.
   *
   * @param pathFromRoot
   * @param recursive
   * @returns the status of the path before insert.
   */
  remove(
    pathFromRoot: ReadonlyArray<string>,
    recursive: boolean,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node is not a folder.
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT // When the node does not exist.
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY // When the node is a folder with at least one child and the recursive is not set.
    | void // When succeed.

  /**
   * Rename srcPathFromRoot to dstPathFromRoot.
   *
   * @param srcPathFromRoot
   * @param dstPathFromRoot
   * @param overwrite
   * @param recursive
   */
  rename(
    srcPathFromRoot: ReadonlyArray<string>,
    dstPathFromRoot: ReadonlyArray<string>,
    overwrite: boolean,
    recursive: boolean,
  ):
    | FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER // When any ancestor node of the target node is not a folder.
    | FileTreeErrorCodeEnum.DST_NODE_EXIST // When the target node exist and overwrite set to false.
    | FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER // When the target node is a folder.
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT // When the src node type and dst node type are different.
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT // When the src node does not exist.
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node of the src node is not a folder.
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY // When the src node is a folder with at least one child and the recursive is not set.
    | void // When succeed.

  /**
   * Reset the file tree with the given rawNodes.
   *
   * @param rawNodes
   */
  reset(rawNodes: ReadonlyArray<IRawFileTreeNode>):
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT // When there are at least two nodes with same path but with different type.
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When there is a file node is an ancestor of another node.
    | void

  /**
   * Get the path type.
   *
   * @param pathFromRoot
   */
  stat(pathFromRoot: ReadonlyArray<string>):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node is not a folder.
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT // When the node does not exist.
    | IFileTreeNodeStat // When succeed.

  /**
   * Get the plain object.
   */
  toJSON(): IFileTreeFolderNode
}
