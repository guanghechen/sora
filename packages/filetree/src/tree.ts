import { FileNodeStatusEnum, FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import type {
  IFileTree,
  IFileTreeFolderNode,
  IFileTreeNode,
  IFileTreePrintOptions,
  INodeNameCompare,
  IRawFileTreeNode,
  IReadonlyFileTreeNode,
} from '@guanghechen/filetree.types'
import { cloneRecursive, comparePaths, compareTreeNode } from './util'

const clazz: string = 'FileTree'

export class FileTree implements IFileTree {
  protected readonly _nodes: IFileTreeNode[]
  protected readonly _cmp: INodeNameCompare

  private constructor(nodes: IFileTreeNode[], cmp: INodeNameCompare) {
    this._nodes = nodes
    this._cmp = cmp
  }

  protected static buildNode(type: FileTreeNodeTypeEnum, name: string): IFileTreeNode {
    switch (type) {
      case FileTreeNodeTypeEnum.FILE:
        return { type, name }
      case FileTreeNodeTypeEnum.FOLDER:
        return { type, name, children: [] }
      default:
        throw new Error(`[${clazz}.buildNode] type(${type}), name(${name}).`)
    }
  }

  public static build(rawNodes: IRawFileTreeNode[], cmp: INodeNameCompare): FileTree {
    const items: IRawFileTreeNode[] = rawNodes
      .filter(x => x.paths.length > 0)
      .sort((u, v) => comparePaths(u.paths, v.paths, cmp))

    const buildChildren = (lft: number, rht: number, cur: number): IFileTreeNode[] => {
      if (lft >= rht) return []

      const nodes: IFileTreeNode[] = []
      for (let i = lft, j: number; i < rht; i = j) {
        const x: string = items[i].paths[cur]
        for (j = i + 1; j < rht; ++j) {
          const y: string = items[j].paths[cur]
          if (cmp(x, y) !== 0) break
        }
        const node: IFileTreeNode = buildNode(i, j, cur)
        nodes.push(node)
      }
      return nodes.sort((u, v) => compareTreeNode(u, v, cmp))
    }

    const buildNode = (lft: number, rht: number, cur: number): IFileTreeNode => {
      const type: FileTreeNodeTypeEnum = items[lft].type
      const name: string = items[lft].paths[cur]

      if (lft + 1 === rht) {
        if (cur + 1 === items[lft].paths.length) return this.buildNode(type, name)

        const node: IFileTreeNode = {
          type: FileTreeNodeTypeEnum.FOLDER,
          name,
          children: [buildNode(lft, rht, cur + 1)],
        }
        return node
      }

      let t: number = lft
      for (; t < rht && items[t].paths.length === cur + 1; ++t) {
        if (items[t].type !== type) {
          const details: string = JSON.stringify(
            items.slice(lft, rht).map(item => ({
              type: item.type,
              path: item.paths.join('/'),
            })),
          )
          throw new TypeError(
            `[${clazz}.buildTree] received same paths but with different type. ${details}`,
          )
        }
      }

      if (t > lft) {
        if (type !== FileTreeNodeTypeEnum.FOLDER) {
          const details: string = JSON.stringify({
            type: items[lft].type,
            path: items[lft].paths.join('/'),
          })
          throw new TypeError(`[${clazz}.buildTree] bad item, expected an folder. ${details}`)
        }
      }

      const node: IFileTreeFolderNode = {
        type: FileTreeNodeTypeEnum.FOLDER,
        name,
        children: buildChildren(t, rht, cur + 1),
      }
      return node
    }

    const results: IFileTreeNode[] = buildChildren(0, items.length, 0)
    return new FileTree(results, cmp)
  }

  public static from(
    nodes_: ReadonlyArray<IReadonlyFileTreeNode>,
    cmp: INodeNameCompare,
  ): FileTree {
    const nodes: IFileTreeNode[] = nodes_.map(o => cloneRecursive(o, -1, cmp))
    return new FileTree(nodes, cmp)
  }

  public draw(options: Omit<IFileTreePrintOptions, 'printLine'> = {}): string[] {
    const lines: string[] = []
    const printLine = (line: string): void => void lines.push(line)
    this.print({ ...options, printLine })
    return lines
  }

  public insert(paths: ReadonlyArray<string>, type: FileTreeNodeTypeEnum): FileNodeStatusEnum {
    if (paths.length <= 0) return FileNodeStatusEnum.EXIST

    const fileType: FileTreeNodeTypeEnum | null = this.stat(paths)
    if (fileType === type) return FileNodeStatusEnum.EXIST
    if (fileType !== null) return FileNodeStatusEnum.CONFLICT

    let nodes: IFileTreeNode[] = this._nodes
    for (let i = 0; i + 1 < paths.length; ++i) {
      const name: string = paths[i]
      let node: IFileTreeNode | undefined = nodes.find(o => o.name === name)
      if (node === undefined) {
        node = FileTree.buildNode(FileTreeNodeTypeEnum.FOLDER, name)
        const idx: number = nodes.findIndex(o => this._compare(o, node!) > 0)
        if (idx < 0) nodes.push(node)
        else nodes.splice(idx, 0, node)
      }
      nodes = (node as IFileTreeFolderNode).children
    }

    {
      const name: string = paths[paths.length - 1]
      const idx: number = nodes.findIndex(o => this._compare(o, node!) > 0)
      const node: IFileTreeNode = FileTree.buildNode(type, name)
      if (idx < 0) nodes.push(node)
      else nodes.splice(idx, 0, node)
    }
    return FileNodeStatusEnum.NONEXISTENT
  }

  public print(options: IFileTreePrintOptions = {}): void {
    const {
      ident: initialIdent = '',
      collapse = false,
      printLine = (line: string): void => void console.log(line),
    } = options
    for (let i = 0; i < this._nodes.length; ++i) {
      const tree: IFileTreeNode = this._nodes[i]
      const isLastChild: boolean = i + 1 === this._nodes.length
      internalPrintFilepathTree(tree, initialIdent, '', isLastChild, true)
    }

    function internalPrintFilepathTree(
      tree: IFileTreeNode,
      parentIdent: string,
      pathPrefix: string,
      isLastChild: boolean,
      isRootNode: boolean,
    ): void {
      // Try to collapse the empty paths.
      if (collapse && tree.type === FileTreeNodeTypeEnum.FOLDER && tree.children.length === 1) {
        const nextPathPrefix: string = pathPrefix ? pathPrefix + '/' + tree.name : tree.name
        internalPrintFilepathTree(
          tree.children[0],
          parentIdent,
          nextPathPrefix,
          isLastChild,
          isRootNode,
        )
        return
      }

      // Print current path.
      {
        const ident: string = isRootNode ? '' : isLastChild ? '└── ' : '├── '
        const currentPath: string = pathPrefix ? pathPrefix + '/' + tree.name : tree.name
        printLine(parentIdent + ident + currentPath)
      }

      switch (tree.type) {
        case FileTreeNodeTypeEnum.FOLDER:
          {
            const nextParentIdent: string =
              parentIdent + (isRootNode ? '' : isLastChild ? '    ' : '│   ')
            for (let i = 0; i < tree.children.length; ++i) {
              const node = tree.children[i]
              const isLastGrandchild: boolean = i + 1 === tree.children.length
              internalPrintFilepathTree(node, nextParentIdent, '', isLastGrandchild, false)
            }
          }
          break
        case FileTreeNodeTypeEnum.FILE:
          break
        default:
          throw new TypeError(`[${clazz}.print] unknown filetree node type: ${(tree as any).type}.`)
      }
    }
  }

  public remove(paths: ReadonlyArray<string>, type?: FileTreeNodeTypeEnum): FileNodeStatusEnum {
    if (paths.length <= 0) return FileNodeStatusEnum.EXIST

    let nodes: IFileTreeNode[] = this._nodes
    for (let i = 0; i + 1 < paths.length; ++i) {
      const name: string = paths[i]
      const node: IFileTreeNode | undefined = nodes.find(o => o.name === name)
      if (node === undefined) return FileNodeStatusEnum.NONEXISTENT
      if (node.type !== FileTreeNodeTypeEnum.FOLDER) return FileNodeStatusEnum.CONFLICT
      nodes = node.children
    }

    {
      const name: string = paths[paths.length - 1]
      const idx: number = nodes.findIndex(o => o.name === name)
      const node: IFileTreeNode | undefined = idx >= 0 ? nodes[idx] : undefined
      if (node === undefined) return FileNodeStatusEnum.NONEXISTENT
      if (type !== undefined && node.type !== type) return FileNodeStatusEnum.CONFLICT

      nodes.splice(idx, 1)
      return FileNodeStatusEnum.EXIST
    }
  }

  public snapshot(depth: number): IFileTreeNode[] {
    return this._nodes.map(o => cloneRecursive(o, depth))
  }

  public stat(paths: ReadonlyArray<string>): FileTreeNodeTypeEnum | null {
    if (paths.length <= 0) return null

    let nodes: IFileTreeNode[] = this._nodes
    for (let i = 0; i + 1 < paths.length; ++i) {
      const name: string = paths[i]
      const node: IFileTreeNode | undefined = nodes.find(o => o.name === name)
      if (node === undefined) return null

      if (node.type !== FileTreeNodeTypeEnum.FOLDER) {
        /* c8 ignore start */
        const details: string = JSON.stringify({
          type: node.type,
          path: paths.slice(0, i + 1).join('/'),
        })
        throw new TypeError(`[${clazz}.stat] expected a folder, but got ${details}.`)
        /* c8 ignore end */
      }

      nodes = node.children
    }

    {
      const name: string = paths[paths.length - 1]
      const node: IFileTreeNode | undefined = nodes.find(o => o.name === name)
      if (node === undefined) return null
      return node.type
    }
  }

  public touch(paths: ReadonlyArray<string>, depth: number): IFileTreeNode | null {
    if (paths.length <= 0) return null

    let nodes: IFileTreeNode[] = this._nodes
    for (let i = 0; i + 1 < paths.length; ++i) {
      const name: string = paths[i]
      const node: IFileTreeNode | undefined = nodes.find(o => o.name === name)
      if (node === undefined) return null

      if (node.type !== FileTreeNodeTypeEnum.FOLDER) {
        /* c8 ignore start */
        const details: string = JSON.stringify({
          type: node.type,
          path: paths.slice(0, i + 1).join('/'),
        })
        throw new TypeError(`[${clazz}.touch] expected a folder, but got ${details}.`)
        /* c8 ignore end */
      }

      nodes = node.children
    }

    {
      const name: string = paths[paths.length - 1]
      const node: IFileTreeNode | undefined = nodes.find(o => o.name === name)
      if (node === undefined) return null
      return cloneRecursive(node, depth)
    }
  }

  protected _compare(u: Readonly<IFileTreeNode>, v: Readonly<IFileTreeNode>): number {
    return compareTreeNode(u, v, this._cmp)
  }
}
