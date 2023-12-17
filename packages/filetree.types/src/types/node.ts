import type { FileTreeNodeTypeEnum } from '../constant'

export interface IFileTreeNodeStat {
  /**
   * The type of the file tree node.
   */
  readonly type: FileTreeNodeTypeEnum

  /**
   * The creation timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
   */
  readonly ctime: number

  /**
   * The modification timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
   *
   * *Note:* If the file changed, it is important to provide an updated `mtime` that advanced
   * from the previous value. Otherwise there may be optimizations in place that will not show
   * the updated file contents in an editor for example.
   */
  readonly mtime: number

  /**
   * The size in bytes.
   *
   * *Note:* If the file changed, it is important to provide an updated `size`. Otherwise there
   * may be optimizations in place that will not show the updated file contents in an editor for
   * example.
   */
  readonly size: number
}

export interface IFileTreeFileNode extends IFileTreeNodeStat {
  readonly type: FileTreeNodeTypeEnum.FILE
  /**
   * File name.
   */
  readonly name: string
}

export interface IFileTreeFolderNode extends IFileTreeNodeStat {
  readonly type: FileTreeNodeTypeEnum.FOLDER
  /**
   * Folder name.
   */
  readonly name: string
  /**
   * Children nodes.
   */
  readonly children: ReadonlyArray<IFileTreeNode>
}

export type IFileTreeNode = IFileTreeFolderNode | IFileTreeFileNode
