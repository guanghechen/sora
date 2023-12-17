import { FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import type { IFileTreeNode, INodeNameCompare } from '@guanghechen/filetree.types'

const rank: Record<FileTreeNodeTypeEnum, number> = {
  [FileTreeNodeTypeEnum.FOLDER]: 1,
  [FileTreeNodeTypeEnum.FILE]: 2,
}

export const caseSensitiveCmp: INodeNameCompare = (x, y) => x.localeCompare(y)

export function compareTreeNode(
  u: Readonly<IFileTreeNode>,
  v: Readonly<IFileTreeNode>,
  cmp: INodeNameCompare,
): number {
  const ru: number = rank[u.type]
  const rv: number = rank[v.type]
  return ru === rv ? cmp(u.name, v.name) : ru < rv ? -1 : 1
}

export function comparePathFromRoot(
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
  return u.length === v.length ? 0 : u.length < v.length ? -1 : 1
}
