import type { FileTreeErrorCodeEnum } from '../constant'
import type { IFileTreeDrawOptions, INodeNameCompare } from './misc'
import type { IFileTreeFileNode, IFileTreeFolderNode } from './node'
import type { IRawFileTreeNode } from './raw'

export interface IFileTreeFileNodeInstance extends IFileTreeFileNode {
  /**
   * The hash of this instance
   */
  readonly hash: string

  /**
   * Modify the content at the given path.
   * @param ctime
   * @param mtime
   * @param size
   */
  modify(ctime: number, mtime: number, size: number): IFileTreeFileNodeInstance

  /**
   * Create a new node with the given new name.
   * @param newName
   */
  rename(newName: string): IFileTreeFileNodeInstance

  /**
   * Get the plain object.
   */
  toJSON(): IFileTreeFileNode
}

export interface IFileTreeFolderNodeInstance extends IFileTreeFolderNode {
  /**
   * Get the children instances.
   */
  readonly children: ReadonlyArray<IFileTreeNodeInstance>

  /**
   * The hash of this instance
   */
  readonly hash: string

  /**
   * Create a new node with the given new name.
   * @param newName
   */
  rename(newName: string): IFileTreeFolderNodeInstance

  /**
   * Get the plain object.
   */
  toJSON(): IFileTreeFolderNode
}

export interface IFileTreeRootNodeInstance {
  /**
   * The root filetree node.
   */
  readonly node: IFileTreeFolderNodeInstance

  /**
   * A method to compare the node name.
   */
  readonly cmp: INodeNameCompare

  /**
   * Use the given folder node as the new root node.
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
    | IFileTreeFolderNodeInstance // When succeed.

  /**
   * Draw the folder node and its descendants.
   * @param options
   */
  draw(options?: IFileTreeDrawOptions): string[]

  /**
   * Find the tree node by the given path.
   *
   * @param pathFromRoot
   */
  find(pathFromRoot: Iterable<string>):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node is not a folder.
    | IFileTreeNodeInstance // When succeed and the node is exist.
    | undefined // When succeed but the node is not exist.

  /**
   * Insert a new tree node.
   *
   * @param rawNode
   * @param overwrite
   */
  insert(
    rawNode: IRawFileTreeNode,
    overwrite: boolean,
  ):
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT // When the node existed but the type is different.
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node is not a folder.
    | FileTreeErrorCodeEnum.SRC_NODE_EXIST // When the node existed but overwrite set to false.
    | IFileTreeFolderNodeInstance // When succeed.

  /**
   * Return a new root node instance which based on the given folder as the root.
   *
   * @param folder
   */
  launch(folder: IFileTreeFolderNodeInstance): IFileTreeRootNodeInstance

  /**
   * Locate the path from the root to the target tree node by the given path.
   *
   * @param pathFromRoot
   */
  locate(pathFromRoot: Iterable<string>):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node is not a folder.
    | { idxList: number[]; node: IFileTreeNodeInstance | undefined } // When succeed.

  /**
   * Modify the content in the given path.
   *
   * @param pathFromRoot
   * @param ctime
   * @param mtime
   * @param size
   */
  modify(
    pathFromRoot: Iterable<string>,
    ctime: number,
    mtime: number,
    size: number,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node is not a folder.
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT // When the path is not exist.
    | FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FILE // When the path is not a file.
    | IFileTreeFolderNodeInstance // When succeed.

  /**
   * Move the srcPathFromRoot to dstPathFromRoot.
   *
   * @param srcPathFromRoot
   * @param dstPathFromRoot
   * @param overwrite
   * @param recursive
   */
  move(
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
    | IFileTreeFolderNodeInstance // When succeed.

  /**
   * Remove the node located by the given path, and return the new FileTreeRootNodeInstance.
   * If the path is not valid, return the current instance.
   *
   * @param pathFromRoot
   * @param recursive
   */
  remove(
    pathFromRoot: Iterable<string>,
    recursive: boolean,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When any ancestor node is not a folder.
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT // When the node does not exist.
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY // When the node is a folder with at least one child and the recursive is not set.
    | IFileTreeFolderNodeInstance // When succeed.

  /**
   * Get the plain object.
   */
  toJSON(): IFileTreeFolderNode
}

export type IFileTreeNodeInstance = IFileTreeFileNodeInstance | IFileTreeFolderNodeInstance
