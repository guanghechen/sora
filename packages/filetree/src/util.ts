import { FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import type {
  IFileTreeNode,
  INodeNameCompare,
  IReadonlyFileTreeNode,
} from '@guanghechen/filetree.types'

const rank: Record<FileTreeNodeTypeEnum, number> = {
  [FileTreeNodeTypeEnum.FOLDER]: 1,
  [FileTreeNodeTypeEnum.FILE]: 2,
}

export function compareTreeNode(
  u: Readonly<IFileTreeNode>,
  v: Readonly<IFileTreeNode>,
  cmp: INodeNameCompare,
): number {
  const ru: number = rank[u.type] ?? -1
  const rv: number = rank[v.type] ?? -1
  if (ru !== rv) return ru - rv
  return cmp(u.name, v.name)
}

export function comparePaths(
  u: ReadonlyArray<string>,
  v: ReadonlyArray<string>,
  cmp: INodeNameCompare,
): number {
  const L: number = u.length < v.length ? u.length : v.length
  for (let i = 0; i < L; ++i) {
    const x: string = u[i]
    const y: string = v[i]
    const d: number = cmp(x, y)
    if (d !== 0) return d
  }
  return u.length - v.length
}

/**
 * Clone recursive util the depth is zero. so a negative number means the deepest.
 * @param node
 * @param depth
 * @param cmp
 * @returns
 */
export function cloneRecursive(
  node: IReadonlyFileTreeNode,
  depth: number,
  cmp?: INodeNameCompare,
): IFileTreeNode {
  if (depth === 0) return cloneZeroDepth(node)

  switch (node.type) {
    case FileTreeNodeTypeEnum.FILE:
      return {
        type: FileTreeNodeTypeEnum.FILE,
        name: node.name,
      }
    case FileTreeNodeTypeEnum.FOLDER: {
      const children: IFileTreeNode[] = node.children.map(o => cloneRecursive(o, depth - 1, cmp))
      if (cmp) children.sort((u, v) => compareTreeNode(u, v, cmp))
      return {
        type: FileTreeNodeTypeEnum.FOLDER,
        name: node.name,
        children,
      }
    }
    /* c8 ignore start */
    default:
      throw new TypeError(`[cloneRecursive] bad node type ${(node as any).type}.`)
    /* c8 ignore end */
  }
}

export function cloneZeroDepth(node: IReadonlyFileTreeNode): IFileTreeNode {
  switch (node.type) {
    case FileTreeNodeTypeEnum.FILE:
      return {
        type: FileTreeNodeTypeEnum.FILE,
        name: node.name,
      }
    case FileTreeNodeTypeEnum.FOLDER: {
      return {
        type: FileTreeNodeTypeEnum.FOLDER,
        name: node.name,
        children: [],
      }
    }
    /* c8 ignore start */
    default:
      throw new TypeError(`[cloneOneDepth] bad node type ${(node as any).type}.`)
    /* c8 ignore end */
  }
}
