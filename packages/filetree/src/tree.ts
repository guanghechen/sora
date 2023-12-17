import type {
  IFileTree,
  IFileTreeDrawOptions,
  IFileTreeFolderNode,
  IFileTreeFolderNodeInstance,
  IFileTreeNodeInstance,
  IFileTreeNodeStat,
  IFileTreeRootNodeInstance,
  INodeNameCompare,
  IRawFileTreeNode,
} from '@guanghechen/filetree.types'
import { FileTreeErrorCodeEnum, FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import { FileTreeRootNode } from './node'
import { isFileTreeOperationFailed } from './util/is'

export class FileTree implements IFileTree {
  #root: IFileTreeRootNodeInstance
  protected readonly _cmp: INodeNameCompare

  private constructor(root: IFileTreeRootNodeInstance, cmp: INodeNameCompare) {
    this.#root = root
    this._cmp = cmp
  }

  public static fromRawNodes(
    rawNodes: ReadonlyArray<IRawFileTreeNode>,
    cmp: INodeNameCompare,
  ):
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTree {
    const errorCodeOrRoot = FileTreeRootNode.fromRawNodes(rawNodes, cmp)
    if (isFileTreeOperationFailed(errorCodeOrRoot)) return errorCodeOrRoot
    return new FileTree(errorCodeOrRoot, cmp)
  }

  public get root(): IFileTreeRootNodeInstance {
    return this.#root
  }

  public attach(folder: IFileTreeFolderNodeInstance): void {
    const newRoot: IFileTreeRootNodeInstance = this.#root.attach(folder)
    this.#root = newRoot
  }

  public copy(
    srcPathFromRoot: ReadonlyArray<string>,
    dstPathFromRoot: ReadonlyArray<string>,
    overwrite: boolean,
    recursive: boolean,
  ):
    | FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.DST_NODE_EXIST
    | FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY
    | void {
    const copyResult = this.#root.copy(srcPathFromRoot, dstPathFromRoot, overwrite, recursive)
    if (isFileTreeOperationFailed(copyResult)) return copyResult

    const newRoot: IFileTreeRootNodeInstance = copyResult
    this.#root = newRoot
  }

  public draw(options?: IFileTreeDrawOptions | undefined): string[] {
    return this.#root.draw(options)
  }

  public insert(
    rawNode: IRawFileTreeNode,
    overwrite: boolean,
  ):
    | FileTreeErrorCodeEnum.SRC_NODE_EXIST // When the node existed but overwrite set to false.
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT // When the node existed but the type is different.
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER // When the parent node is not a directory.
    | void {
    const insertResult = this.#root.insert(rawNode, overwrite)
    if (isFileTreeOperationFailed(insertResult)) return insertResult

    const newRoot: IFileTreeRootNodeInstance = insertResult
    this.#root = newRoot
  }

  public readdir(
    pathFromRoot: ReadonlyArray<string>,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    | string[] {
    const findResult = this.#root.find(pathFromRoot)
    if (isFileTreeOperationFailed(findResult)) return findResult

    const node: IFileTreeNodeInstance | undefined = findResult
    if (node === undefined) return FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    if (node.type !== FileTreeNodeTypeEnum.FOLDER) {
      return FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FOLDER
    }
    return node.children.map(item => item.name)
  }

  public remove(
    pathFromRoot: ReadonlyArray<string>,
    recursive: boolean,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY
    | void {
    const removeResult = this.#root.remove(pathFromRoot, recursive)
    if (isFileTreeOperationFailed(removeResult)) return removeResult

    const newRoot: IFileTreeRootNodeInstance = removeResult
    this.#root = newRoot
  }

  public rename(
    srcPathFromRoot: ReadonlyArray<string>,
    dstPathFromRoot: ReadonlyArray<string>,
    overwrite: boolean,
    recursive: boolean,
  ):
    | FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.DST_NODE_EXIST
    | FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY
    | void {
    const moveResult = this.#root.move(srcPathFromRoot, dstPathFromRoot, overwrite, recursive)
    if (isFileTreeOperationFailed(moveResult)) return moveResult

    const newRoot: IFileTreeRootNodeInstance = moveResult
    this.#root = newRoot
  }

  public reset(
    rawNodes: ReadonlyArray<IRawFileTreeNode>,
  ):
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | void {
    const errorCodeOrRoot = FileTreeRootNode.fromRawNodes(rawNodes, this._cmp)
    if (isFileTreeOperationFailed(errorCodeOrRoot)) return errorCodeOrRoot
    this.#root = errorCodeOrRoot
  }

  public stat(
    pathFromRoot: ReadonlyArray<string>,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    | IFileTreeNodeStat {
    const findResult = this.#root.find(pathFromRoot)
    if (isFileTreeOperationFailed(findResult)) return findResult

    const node: IFileTreeNodeInstance | undefined = findResult
    if (node === undefined) return FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT

    const stat: IFileTreeNodeStat = {
      type: node.type,
      ctime: node.ctime,
      mtime: node.mtime,
      size: node.size,
    }
    return stat
  }

  public toJSON(): IFileTreeFolderNode {
    return this.#root.toJSON()
  }
}
