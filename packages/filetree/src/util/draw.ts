import { FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import type {
  IFileTreeDrawOptions,
  IFileTreeFolderNode,
  IFileTreeNode,
  INodeNameCompare,
} from '@guanghechen/filetree.types'
import { compareTreeNode } from './compare'

type IDrawOptions = Required<IFileTreeDrawOptions>

export function drawFileTree(
  root: IFileTreeFolderNode,
  options: IDrawOptions,
  cmp: INodeNameCompare,
): string[] {
  const INITIAL_IDENT: string = options.ident
  const MAX_DEPTH: number = options.depth
  const SHOULD_COLLAPSE: boolean = options.collapse
  const SHOULD_SHOW_TAIL_SLASH: boolean = options.tailSlash

  const lines: string[] = []
  const printLine = (line: string): void => void lines.push(line)
  internalPrintFilepathTree(root, INITIAL_IDENT, '', true, true, 0)
  return lines

  function internalPrintFilepathTree(
    tree: IFileTreeNode,
    parentIdent: string,
    pathPrefix: string,
    isLastChild: boolean,
    isRootNode: boolean,
    depth: number,
  ): void {
    if (depth > MAX_DEPTH) return

    // Try to collapse the empty paths.
    if (
      SHOULD_COLLAPSE &&
      tree.type === FileTreeNodeTypeEnum.FOLDER &&
      tree.children.length === 1
    ) {
      const nextPathPrefix: string = pathPrefix ? pathPrefix + '/' + tree.name : tree.name
      internalPrintFilepathTree(
        tree.children[0],
        parentIdent,
        nextPathPrefix,
        isLastChild,
        isRootNode,
        depth + 1,
      )
      return
    }

    // Print current path.
    const ident: string = isRootNode ? '' : isLastChild ? '└── ' : '├── '
    let currentPath: string = pathPrefix ? pathPrefix + '/' + tree.name : tree.name
    if (SHOULD_SHOW_TAIL_SLASH && tree.type === FileTreeNodeTypeEnum.FOLDER) currentPath += '/'

    printLine(parentIdent + ident + currentPath)

    switch (tree.type) {
      case FileTreeNodeTypeEnum.FOLDER:
        {
          const nextParentIdent: string =
            parentIdent + (isRootNode ? '' : isLastChild ? '    ' : '│   ')
          const children: IFileTreeNode[] = tree.children
            .slice()
            .sort((u, v) => compareTreeNode(u, v, cmp))
          for (let i = 0; i < children.length; ++i) {
            const node = children[i]
            const isLastGrandchild: boolean = i + 1 === children.length
            internalPrintFilepathTree(node, nextParentIdent, '', isLastGrandchild, false, depth + 1)
          }
        }
        break
      case FileTreeNodeTypeEnum.FILE:
        break
      /* c8 ignore start */
      default:
        throw new TypeError(`[drawFileTree] unknown filetree node type: ${(tree as any).type}.`)
      /* c8 ignore stop */
    }
  }
}
