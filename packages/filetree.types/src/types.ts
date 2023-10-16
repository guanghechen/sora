import type { FileNodeStatusEnum, FileTreeNodeTypeEnum } from './constant'

export interface IFileTreeFileNode {
  type: FileTreeNodeTypeEnum.FILE
  name: string
}
export interface IFileTreeFolderNode {
  type: FileTreeNodeTypeEnum.FOLDER
  name: string
  children: IFileTreeNode[]
}
export type IFileTreeNode = IFileTreeFileNode | IFileTreeFolderNode

export interface IReadonlyFileTreeFileNode {
  readonly type: FileTreeNodeTypeEnum.FILE
  readonly name: string
}
export interface IReadonlyFileTreeFolderNode {
  readonly type: FileTreeNodeTypeEnum.FOLDER
  readonly name: string
  readonly children: ReadonlyArray<IReadonlyFileTreeNode>
}
export type IReadonlyFileTreeNode = IReadonlyFileTreeFileNode | IReadonlyFileTreeFolderNode

export interface IRawFileTreeNode {
  type: FileTreeNodeTypeEnum
  paths: ReadonlyArray<string>
}

export type INodeNameCompare = (u: string, v: string) => number

export interface IFileTreePrintOptions {
  /**
   * @default ''
   */
  ident?: string
  /**
   * Collapse empty paths.
   * @default false
   */
  collapse?: boolean
  /**
   * @param line
   * @returns
   * @default (line: string): void => void console.log(line)
   */
  printLine?: (line: string) => void
}

export interface IFileTree {
  /**
   * Draw the file tree.
   * @param options
   */
  draw(options?: Omit<IFileTreePrintOptions, 'printLine'>): string[]
  /**
   * Insert a new tree node.
   * @param paths
   * @param type
   */
  insert(paths: ReadonlyArray<string>, type: FileTreeNodeTypeEnum): FileNodeStatusEnum
  /**
   * Print the file tree to device.
   * @param options
   */
  print(options?: IFileTreePrintOptions): void
  /**
   * Remove a tree node by path.
   * @param paths
   * @param type
   * @returns the status of the path before insert.
   */
  remove(paths: ReadonlyArray<string>, type?: FileTreeNodeTypeEnum): FileNodeStatusEnum
  /**
   * Get the snapshot of the file tree (deep cloned).
   * @param depth
   */
  snapshot(depth: number): IFileTreeNode[]
  /**
   * Get the path type.
   * @param paths
   */
  stat(paths: ReadonlyArray<string>): FileTreeNodeTypeEnum | null
  /**
   * Get the node by the given path.
   * @param paths
   * @param depth
   */
  touch(paths: ReadonlyArray<string>, depth: number): IFileTreeNode | null
}
