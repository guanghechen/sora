import { FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import type {
  IFileTreeFolderNode,
  IFileTreeFolderNodeInstance,
  IFileTreeNodeInstance,
} from '@guanghechen/filetree.types'
import { v5 as uuid } from 'uuid'

const namespace: string = '887656e7-190a-4ced-aad8-abb6d7d78faf'

export class FileTreeFolderNode implements IFileTreeFolderNodeInstance {
  readonly #type: FileTreeNodeTypeEnum.FOLDER
  readonly #name: string
  readonly #ctime: number
  readonly #mtime: number
  readonly #size: number
  readonly #children: ReadonlyArray<IFileTreeNodeInstance>
  readonly #hash: string

  private constructor(name: string, children: ReadonlyArray<IFileTreeNodeInstance>, hash: string) {
    let ctime: number = 0
    let mtime: number = 0
    let size: number = 0
    for (const child of children) {
      if (mtime < child.mtime) mtime = child.mtime
      if (ctime === 0 || ctime > child.ctime) ctime = child.ctime
      size += child.size
    }

    this.#type = FileTreeNodeTypeEnum.FOLDER
    this.#children = children
    this.#name = name
    this.#ctime = ctime
    this.#mtime = mtime
    this.#size = size
    this.#hash = hash
  }

  static #instanceMap: Map<string, IFileTreeFolderNodeInstance> = new Map()
  public static create(
    name: string,
    children: ReadonlyArray<IFileTreeNodeInstance>,
  ): IFileTreeFolderNodeInstance {
    const message: string = children.map(child => child.hash).join(`#`) + '#' + name
    const hash: string = uuid(message, namespace)

    let node: IFileTreeFolderNodeInstance | undefined = this.#instanceMap.get(hash)
    if (node === undefined) {
      node = new FileTreeFolderNode(name, children, hash)
      this.#instanceMap.set(hash, node)
    }
    return node
  }

  public get type(): FileTreeNodeTypeEnum.FOLDER {
    return this.#type
  }

  public get name(): string {
    return this.#name
  }

  public get ctime(): number {
    return this.#ctime
  }

  public get mtime(): number {
    return this.#mtime
  }

  public get size(): number {
    return this.#size
  }

  public get children(): ReadonlyArray<IFileTreeNodeInstance> {
    return this.#children
  }

  public get hash(): string {
    return this.#hash
  }

  public rename(newName: string): IFileTreeFolderNodeInstance {
    return newName === this.#name ? this : FileTreeFolderNode.create(newName, this.#children)
  }

  public toJSON(): IFileTreeFolderNode {
    return {
      type: this.#type,
      name: this.#name,
      ctime: this.#ctime,
      mtime: this.#mtime,
      size: this.#size,
      children: this.#children.map(child => child.toJSON()),
    }
  }
}
