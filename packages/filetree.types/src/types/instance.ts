import type { IFileTreeFileNode, IFileTreeFolderNode } from './node'

export interface IFileTreeFileNodeInstance extends IFileTreeFileNode {
  /**
   * The hash of this instance
   */
  readonly hash: string

  /**
   * Modify the content at the given path.
   * @param ctime
   * @param mtime
   * @param size
   */
  modify(ctime: number, mtime: number, size: number): IFileTreeFileNodeInstance

  /**
   * Create a new node with the given new name.
   * @param newName
   */
  rename(newName: string): IFileTreeFileNodeInstance

  /**
   * Get the plain object.
   */
  toJSON(): IFileTreeFileNode
}

export interface IFileTreeFolderNodeInstance extends IFileTreeFolderNode {
  /**
   * Get the children instances.
   */
  readonly children: ReadonlyArray<IFileTreeNodeInstance>

  /**
   * The hash of this instance
   */
  readonly hash: string

  /**
   * Create a new node with the given new name.
   * @param newName
   */
  rename(newName: string): IFileTreeFolderNodeInstance

  /**
   * Get the plain object.
   */
  toJSON(): IFileTreeFolderNode
}

export type IFileTreeNodeInstance = IFileTreeFileNodeInstance | IFileTreeFolderNodeInstance
