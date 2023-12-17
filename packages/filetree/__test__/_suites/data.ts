import type { IRawFileTreeNode } from '@guanghechen/filetree.types'
import { FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import { splitPathFromRoot } from '../../src/util/path'

export const getRawFileTreeNodes1 = (): {
  files: IRawFileTreeNode[]
  folders: IRawFileTreeNode[]
} => {
  const files: IRawFileTreeNode[] = [
    {
      type: FileTreeNodeTypeEnum.FILE,
      pathFromRoot: splitPathFromRoot('a/b/c/a.txt'),
      ctime: 80,
      mtime: 80,
      size: 100,
    },
    {
      type: FileTreeNodeTypeEnum.FILE,
      pathFromRoot: splitPathFromRoot('a/b/c/d/e.md'),
      ctime: 90,
      mtime: 92,
      size: 120,
    },
    {
      type: FileTreeNodeTypeEnum.FILE,
      pathFromRoot: splitPathFromRoot('a/b/c/d/a.md'),
      ctime: 70,
      mtime: 82,
      size: 110,
    },
    {
      type: FileTreeNodeTypeEnum.FILE,
      pathFromRoot: splitPathFromRoot('a/b/d/c.md'),
      ctime: 170,
      mtime: 170,
      size: 200,
    },
    {
      type: FileTreeNodeTypeEnum.FILE,
      pathFromRoot: splitPathFromRoot('a/d/c/b.md'),
      ctime: 270,
      mtime: 370,
      size: 480,
    },
  ]

  const folders: IRawFileTreeNode[] = [
    {
      type: FileTreeNodeTypeEnum.FOLDER,
      pathFromRoot: splitPathFromRoot('a/b/b/c/d/f'),
    },
    {
      type: FileTreeNodeTypeEnum.FOLDER,
      pathFromRoot: splitPathFromRoot('a/b/b/c/e'),
    },
    {
      type: FileTreeNodeTypeEnum.FOLDER,
      pathFromRoot: splitPathFromRoot('a/b/b/c/d'),
    },
    {
      type: FileTreeNodeTypeEnum.FOLDER,
      pathFromRoot: splitPathFromRoot('d/c/a'),
    },
  ]

  return { files, folders }
}
