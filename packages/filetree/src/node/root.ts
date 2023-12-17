import type {
  IFileTreeDrawOptions,
  IFileTreeFileNodeInstance,
  IFileTreeFolderNode,
  IFileTreeFolderNodeInstance,
  IFileTreeNodeInstance,
  IFileTreeRootNodeInstance,
  INodeNameCompare,
  IRawFileTreeNode,
} from '@guanghechen/filetree.types'
import { FileTreeErrorCodeEnum, FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import { comparePathFromRoot } from '../util/compare'
import { drawFileTree } from '../util/draw'
import { isFileTreeOperationFailed } from '../util/is'
import { immutableInsert, immutableRemove, immutableReplace } from '../util/list'
import { makeFileTreeLeafNode } from '../util/make'
import { FileTreeFolderNode } from './folder'

export class FileTreeRootNode implements IFileTreeRootNodeInstance {
  readonly #cmp: INodeNameCompare
  #root: IFileTreeFolderNodeInstance

  private constructor(children: ReadonlyArray<IFileTreeNodeInstance>, cmp: INodeNameCompare) {
    this.#root = FileTreeFolderNode.create('.', children)
    this.#cmp = cmp
  }

  public static fromRawNodes(
    rawNodes: Iterable<IRawFileTreeNode>,
    cmp: INodeNameCompare,
  ):
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | IFileTreeRootNodeInstance {
    const items: IRawFileTreeNode[] = []
    for (const rawNode of rawNodes) {
      if (rawNode.pathFromRoot.length > 0) items.push(rawNode)
    }
    if (items.length <= 0) return new FileTreeRootNode([], cmp)

    items.sort((u, v) => comparePathFromRoot(u.pathFromRoot, v.pathFromRoot, cmp))

    const errorCodeOrNodes = buildChildren(0, items.length, 0)
    if (isFileTreeOperationFailed(errorCodeOrNodes)) return errorCodeOrNodes
    return new FileTreeRootNode(errorCodeOrNodes, cmp)

    function buildChildren(
      lft: number,
      rht: number,
      cur: number,
    ):
      | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
      | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
      | IFileTreeNodeInstance[] {
      if (lft >= rht) return []

      const nodes: IFileTreeNodeInstance[] = []
      for (let i = lft, j: number; i < rht; i = j) {
        const x: string = items[i].pathFromRoot[cur]
        for (j = i + 1; j < rht; ++j) {
          const y: string = items[j].pathFromRoot[cur]
          if (cmp(x, y) !== 0) break
        }

        const errorCodeOrNode = buildNode(i, j, cur)
        if (isFileTreeOperationFailed(errorCodeOrNode)) return errorCodeOrNode
        nodes.push(errorCodeOrNode)
      }
      return nodes
    }

    function buildNode(
      lft: number,
      rht: number,
      cur: number,
    ):
      | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
      | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
      | IFileTreeNodeInstance {
      const type: FileTreeNodeTypeEnum = items[lft].type
      const name: string = items[lft].pathFromRoot[cur]

      if (lft + 1 === rht) {
        // Leaf node.
        if (cur + 1 === items[lft].pathFromRoot.length)
          return makeFileTreeLeafNode(name, items[lft])

        // Folder node with a single child.
        {
          const child = buildNode(lft, rht, cur + 1)
          if (isFileTreeOperationFailed(child)) return child
          return FileTreeFolderNode.create(name, [child])
        }
      }

      let t: number = lft

      // Collect leaf nodes and ensure they have same type since they are same path.
      for (; t < rht && items[t].pathFromRoot.length === cur + 1; ++t) {
        if (items[t].type !== type) return FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
      }

      // There is at least one leaf node at this path.
      if (t > lft) {
        if (type !== FileTreeNodeTypeEnum.FOLDER) {
          return FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
        }
      }

      // Folder node with multiple children.
      {
        const errorCodeOrChildren = buildChildren(t, rht, cur + 1)
        if (isFileTreeOperationFailed(errorCodeOrChildren)) return errorCodeOrChildren
        return FileTreeFolderNode.create(name, errorCodeOrChildren)
      }
    }
  }

  public get node(): IFileTreeFolderNodeInstance {
    return this.#root
  }

  public get cmp(): INodeNameCompare {
    return this.#cmp
  }

  public attach(folder: IFileTreeFolderNodeInstance): void {
    this.#root = folder
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
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY
    | IFileTreeFolderNodeInstance {
    const cmp: INodeNameCompare = this.#cmp
    if (comparePathFromRoot(srcPathFromRoot, dstPathFromRoot, cmp) === 0) return this.#root

    const srcLocateResult = this.locate(srcPathFromRoot)
    if (srcLocateResult === FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER) {
      return FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    }

    const { idxList: srcIdxList, node: srcNode } = srcLocateResult
    if (srcNode === undefined) return FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT

    if (!recursive && srcNode.type === FileTreeNodeTypeEnum.FOLDER && srcNode.children.length > 0) {
      return FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY
    }

    const dstLocateResult = this.locate(dstPathFromRoot)
    if (dstLocateResult === FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER) {
      return FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER
    }

    const { idxList: dstIdxList, node: dstNode } = dstLocateResult
    if (dstNode !== undefined) {
      if (!overwrite) return FileTreeErrorCodeEnum.DST_NODE_EXIST
      if (srcNode.type !== dstNode.type) return FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
      if (dstNode.type === FileTreeNodeTypeEnum.FOLDER) {
        return FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER
      }
    }

    let cIdx: number = -1
    let cNode: IFileTreeFolderNodeInstance = this.#root
    for (let i = 0; i < srcIdxList.length && i < dstIdxList.length; ++i) {
      const idx: number = srcIdxList[i]
      if (idx !== dstIdxList[i]) break
      cIdx = i
      cNode = cNode.children[idx] as IFileTreeFolderNodeInstance
    }

    cNode = insert(cNode, cNode.name, cIdx + 1)
    return maintain(this.#root, 0)

    function insert(
      folder: IFileTreeFolderNodeInstance | undefined,
      folderName: string,
      dep: number,
    ): IFileTreeFolderNodeInstance {
      const childName: string = dstPathFromRoot[dep]
      const idx: number = folder?.children.findIndex(o => cmp(o.name, childName) >= 0) ?? -1
      const oldChild: IFileTreeNodeInstance | undefined =
        idx >= 0 && folder && cmp(folder.children[idx].name, childName) === 0
          ? folder.children[idx]
          : undefined

      const child: IFileTreeNodeInstance =
        dep + 1 === dstPathFromRoot.length
          ? srcNode!
          : insert(oldChild as IFileTreeFolderNodeInstance | undefined, childName, dep + 1)

      if (folder === undefined) return FileTreeFolderNode.create(folderName, [child])
      if (child === oldChild) return folder

      const children: ReadonlyArray<IFileTreeNodeInstance> =
        oldChild === undefined
          ? immutableInsert(folder.children, idx < 0 ? folder.children.length : idx, child)
          : immutableReplace(folder.children, idx, child)
      return FileTreeFolderNode.create(folderName, children)
    }

    function maintain(
      folder: IFileTreeFolderNodeInstance,
      dep: number,
    ): IFileTreeFolderNodeInstance {
      const idx: number = srcIdxList[dep]
      const child: IFileTreeNodeInstance = folder.children[idx]
      const newChild: IFileTreeNodeInstance =
        dep === cIdx ? cNode : maintain(child as IFileTreeFolderNodeInstance, dep + 1)
      const newChildren: ReadonlyArray<IFileTreeNodeInstance> = immutableReplace(
        folder.children,
        idx,
        newChild,
      )
      return newChildren === folder.children
        ? folder
        : FileTreeFolderNode.create(folder.name, newChildren)
    }
  }

  public draw(options: IFileTreeDrawOptions = {}): string[] {
    const {
      ident = '',
      collapse = false,
      depth = Number.MAX_SAFE_INTEGER,
      tailSlash = false,
    } = options
    return drawFileTree(this.#root, { ident, collapse, depth, tailSlash }, this.#cmp)
  }

  public find(pathFromRoot: Iterable<string>):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER //
    | IFileTreeNodeInstance
    | undefined {
    const cmp: INodeNameCompare = this.#cmp

    let node: IFileTreeNodeInstance = this.#root
    for (const nodeName of pathFromRoot) {
      if (node.type !== FileTreeNodeTypeEnum.FOLDER) {
        return FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
      }

      const child: IFileTreeNodeInstance | undefined = node.children.find(
        o => cmp(o.name, nodeName) === 0,
      )
      if (child === undefined) return undefined
      node = child
    }
    return node
  }

  public insert(
    rawNode: IRawFileTreeNode,
    overwrite: boolean,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_NODE_EXIST
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
    | IFileTreeFolderNodeInstance {
    // If the path is empty, it's means insert at the root node which is not allowed.
    if (rawNode.pathFromRoot.length <= 0) return this.#root

    // If the last idx is a non-negative number, it's means the path is already exist.
    const locateResult = this.find(rawNode.pathFromRoot)
    if (isFileTreeOperationFailed(locateResult)) return locateResult

    const node: IFileTreeNodeInstance | undefined = locateResult
    if (node !== undefined) {
      if (!overwrite) return FileTreeErrorCodeEnum.SRC_NODE_EXIST
      if (node.type !== rawNode.type) return FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT

      // If the rawNode is a folder and the folder has been existed, then just return the current root.
      if (rawNode.type === FileTreeNodeTypeEnum.FOLDER) return this.#root
    }

    const cmp: INodeNameCompare = this.#cmp
    const N: number = rawNode.pathFromRoot.length
    return insert(this.#root, this.#root.name, 0)

    function insert(
      folder: IFileTreeFolderNodeInstance | undefined,
      folderName: string,
      dep: number,
    ): IFileTreeFolderNodeInstance {
      const childName: string = rawNode.pathFromRoot[dep]
      const idx: number = folder?.children.findIndex(o => cmp(o.name, childName) >= 0) ?? -1
      const oldChild: IFileTreeNodeInstance | undefined =
        idx >= 0 && folder && cmp(folder.children[idx].name, childName) === 0
          ? folder.children[idx]
          : undefined

      const child: IFileTreeNodeInstance =
        dep + 1 === N
          ? makeFileTreeLeafNode(childName, rawNode)
          : insert(oldChild as IFileTreeFolderNodeInstance | undefined, childName, dep + 1)

      if (folder === undefined) return FileTreeFolderNode.create(folderName, [child])
      if (child === oldChild) return folder

      const children: ReadonlyArray<IFileTreeNodeInstance> =
        oldChild === undefined
          ? immutableInsert(folder.children, idx < 0 ? folder.children.length : idx, child)
          : immutableReplace(folder.children, idx, child)
      return FileTreeFolderNode.create(folderName, children)
    }
  }

  public launch(folder: IFileTreeFolderNodeInstance): IFileTreeRootNodeInstance {
    const cmp: INodeNameCompare = this.#cmp
    return new FileTreeRootNode(folder.children, cmp)
  }

  public locate(
    pathFromRoot: Iterable<string>,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | { idxList: number[]; node: IFileTreeNodeInstance | undefined } {
    const cmp: INodeNameCompare = this.#cmp
    const idxList: number[] = []

    let node: IFileTreeNodeInstance = this.#root
    for (const nodeName of pathFromRoot) {
      if (node.type !== FileTreeNodeTypeEnum.FOLDER) {
        return FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
      }

      const idx: number = node.children.findIndex(o => cmp(o.name, nodeName) === 0)
      idxList.push(idx)

      if (idx < 0) return { idxList, node: undefined }
      node = node.children[idx]
    }

    return { idxList, node }
  }

  public modify(
    pathFromRoot: Iterable<string>,
    ctime: number,
    mtime: number,
    size: number,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    | FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FILE
    | IFileTreeFolderNodeInstance {
    const locateResult = this.locate(pathFromRoot)
    if (isFileTreeOperationFailed(locateResult)) return locateResult

    const { idxList, node } = locateResult
    if (node === undefined) return FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT

    if (node.type !== FileTreeNodeTypeEnum.FILE) return FileTreeErrorCodeEnum.SRC_NODE_IS_NOT_FILE

    return modify(this.#root, 0)

    function modify(folder: IFileTreeFolderNodeInstance, dep: number): IFileTreeFolderNodeInstance {
      const idx: number = idxList[dep]
      const oldChild: IFileTreeNodeInstance = folder.children[idx]

      const child: IFileTreeNodeInstance =
        dep + 1 === idxList.length
          ? (oldChild as IFileTreeFileNodeInstance).modify(ctime, mtime, size)
          : modify(oldChild as IFileTreeFolderNodeInstance, dep + 1)

      const children: ReadonlyArray<IFileTreeNodeInstance> = immutableReplace(
        folder.children,
        idx,
        child,
      )
      return FileTreeFolderNode.create(folder.name, children)
    }
  }

  public move(
    srcPathFromRoot: ReadonlyArray<string>,
    dstPathFromRoot: ReadonlyArray<string>,
    overwrite: boolean,
    recursive: boolean,
  ):
    | FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.DST_NODE_EXIST
    | FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER
    | FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY
    | IFileTreeFolderNodeInstance {
    const cmp: INodeNameCompare = this.#cmp
    if (comparePathFromRoot(srcPathFromRoot, dstPathFromRoot, cmp) === 0) return this.#root

    const srcLocateResult = this.locate(srcPathFromRoot)
    if (srcLocateResult === FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER) {
      return FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    }

    const { idxList: srcIdxList, node: srcNode } = srcLocateResult
    if (srcNode === undefined) return FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT

    if (!recursive && srcNode.type === FileTreeNodeTypeEnum.FOLDER && srcNode.children.length > 0) {
      return FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY
    }

    const dstLocateResult = this.locate(dstPathFromRoot)
    if (dstLocateResult === FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER) {
      return FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER
    }

    const { idxList: dstIdxList, node: dstNode } = dstLocateResult
    if (dstNode !== undefined) {
      if (!overwrite) return FileTreeErrorCodeEnum.DST_NODE_EXIST
      if (srcNode.type !== dstNode.type) return FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT
      if (dstNode.type === FileTreeNodeTypeEnum.FOLDER) {
        return FileTreeErrorCodeEnum.DST_NODE_IS_FOLDER
      }
    }

    let cIdx: number = -1
    let cNode: IFileTreeFolderNodeInstance = this.#root
    for (let i = 0; i < srcIdxList.length && i < dstIdxList.length; ++i) {
      const idx: number = srcIdxList[i]
      if (idx !== dstIdxList[i]) break
      cIdx = i
      cNode = cNode.children[idx] as IFileTreeFolderNodeInstance
    }

    cNode = remove(cNode, cIdx + 1)
    cNode = insert(cNode, cNode.name, cIdx + 1)
    return maintain(this.#root, 0)

    function remove(folder: IFileTreeFolderNodeInstance, dep: number): IFileTreeFolderNodeInstance {
      const idx: number = srcIdxList[dep]
      const child: IFileTreeNodeInstance = folder.children[idx]
      let newChildren: ReadonlyArray<IFileTreeNodeInstance>

      if (dep + 1 === srcIdxList.length) newChildren = immutableRemove(folder.children, idx)
      else {
        const newChild = remove(child as IFileTreeFolderNodeInstance, dep + 1)
        newChildren = immutableReplace(folder.children, idx, newChild)
      }

      return newChildren === folder.children
        ? folder
        : FileTreeFolderNode.create(folder.name, newChildren)
    }

    function insert(
      folder: IFileTreeFolderNodeInstance | undefined,
      folderName: string,
      dep: number,
    ): IFileTreeFolderNodeInstance {
      const childName: string = dstPathFromRoot[dep]

      // We cannot reuse the dstIdxList result here because the children order maybe changed
      // after previous remove operation.
      const idx: number = folder?.children.findIndex(o => cmp(o.name, childName) >= 0) ?? -1

      const oldChild: IFileTreeNodeInstance | undefined =
        idx >= 0 && folder && cmp(folder.children[idx].name, childName) === 0
          ? folder.children[idx]
          : undefined

      const child: IFileTreeNodeInstance =
        dep + 1 === dstPathFromRoot.length
          ? srcNode!.rename(childName)
          : insert(oldChild as IFileTreeFolderNodeInstance | undefined, childName, dep + 1)

      if (folder === undefined) return FileTreeFolderNode.create(folderName, [child])
      if (child === oldChild) return folder

      const children: ReadonlyArray<IFileTreeNodeInstance> =
        oldChild === undefined
          ? immutableInsert(folder.children, idx < 0 ? folder.children.length : idx, child)
          : immutableReplace(folder.children, idx, child)
      return FileTreeFolderNode.create(folderName, children)
    }

    function maintain(
      folder: IFileTreeFolderNodeInstance,
      dep: number,
    ): IFileTreeFolderNodeInstance {
      const idx: number = srcIdxList[dep]
      const child: IFileTreeNodeInstance = folder.children[idx]
      const newChild: IFileTreeNodeInstance =
        dep === cIdx ? cNode : maintain(child as IFileTreeFolderNodeInstance, dep + 1)
      const newChildren: ReadonlyArray<IFileTreeNodeInstance> = immutableReplace(
        folder.children,
        idx,
        newChild,
      )
      return newChildren === folder.children
        ? folder
        : FileTreeFolderNode.create(folder.name, newChildren)
    }
  }

  public remove(
    pathFromRoot: Iterable<string>,
    recursive: boolean,
  ):
    | FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER
    | FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT
    | FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY
    | IFileTreeFolderNodeInstance {
    const trackResult = this.locate(pathFromRoot)
    if (isFileTreeOperationFailed(trackResult)) return trackResult
    const { idxList, node: targetNode } = trackResult

    // The target node is not exist.
    if (targetNode === undefined) return FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT

    // The target node is a folder type node with at least one child, but the recursive is not set.
    if (
      !recursive &&
      targetNode.type === FileTreeNodeTypeEnum.FOLDER &&
      targetNode.children.length > 0
    ) {
      return FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY
    }

    // If the path is empty, it's means remove the whole root node.
    if (idxList.length <= 0) return FileTreeFolderNode.create(this.#root.name, [])

    const N = idxList.length
    return remove(this.#root, 0)

    function remove(folder: IFileTreeFolderNodeInstance, dep: number): IFileTreeFolderNodeInstance {
      const idx: number = idxList[dep]
      const child: IFileTreeNodeInstance = folder.children[idx]
      let newChildren: ReadonlyArray<IFileTreeNodeInstance>

      if (dep + 1 === N) newChildren = immutableRemove(folder.children, idx)
      else {
        const newChild = remove(child as IFileTreeFolderNodeInstance, dep + 1)
        newChildren = immutableReplace(folder.children, idx, newChild)
      }

      return newChildren === folder.children
        ? folder
        : FileTreeFolderNode.create(folder.name, newChildren)
    }
  }

  public toJSON(): IFileTreeFolderNode {
    return this.#root.toJSON()
  }
}
