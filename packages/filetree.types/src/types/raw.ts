import type { FileTreeNodeTypeEnum } from '../constant'
import type { IFileTreeNodeStat } from './node'

export interface IRawFileTreeFileNode extends Omit<IFileTreeNodeStat, 'type'> {
  readonly type: FileTreeNodeTypeEnum.FILE
  /**
   * The relative path where the node located.
   */
  readonly pathFromRoot: ReadonlyArray<string>
}

export interface IRawFileTreeFolderNode {
  readonly type: FileTreeNodeTypeEnum.FOLDER
  /**
   * The relative path where the node located.
   */
  readonly pathFromRoot: ReadonlyArray<string>
}

export type IRawFileTreeNode = IRawFileTreeFileNode | IRawFileTreeFolderNode
