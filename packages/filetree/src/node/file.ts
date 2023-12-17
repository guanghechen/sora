import { FileTreeNodeTypeEnum } from '@guanghechen/filetree.types'
import type { IFileTreeFileNode, IFileTreeFileNodeInstance } from '@guanghechen/filetree.types'
import { v5 as uuid } from 'uuid'

const namespace: string = 'ad896e47-3976-4169-83e0-d6ea02cb520f'

export class FileTreeFileNode implements IFileTreeFileNodeInstance {
  readonly #type: FileTreeNodeTypeEnum.FILE
  readonly #name: string
  readonly #ctime: number
  readonly #mtime: number
  readonly #size: number
  readonly #hash: string

  private constructor(name: string, ctime: number, mtime: number, size: number, hash: string) {
    this.#type = FileTreeNodeTypeEnum.FILE
    this.#name = name
    this.#ctime = ctime
    this.#mtime = mtime
    this.#size = size
    this.#hash = hash
  }

  static #instanceMap: Map<string, IFileTreeFileNodeInstance> = new Map()
  public static create(
    name: string,
    ctime: number,
    mtime: number,
    size: number,
  ): IFileTreeFileNodeInstance {
    const message: string = `#${ctime}#${mtime}#${size}#${name}`
    const hash: string = uuid(message, namespace)

    let node: IFileTreeFileNodeInstance | undefined = this.#instanceMap.get(hash)
    if (node === undefined) {
      node = new FileTreeFileNode(name, ctime, mtime, size, hash)
      this.#instanceMap.set(hash, node)
    }
    return node
  }

  public get type(): FileTreeNodeTypeEnum.FILE {
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

  public get hash(): string {
    return this.#hash
  }

  public modify(ctime: number, mtime: number, size: number): IFileTreeFileNodeInstance {
    if (this.#ctime === ctime && this.#mtime === mtime && this.#size === size) return this
    return FileTreeFileNode.create(this.#name, ctime, mtime, size)
  }

  public rename(newName: string): IFileTreeFileNodeInstance {
    return newName === this.#name
      ? this
      : FileTreeFileNode.create(newName, this.#ctime, this.#mtime, this.#size)
  }

  public toJSON(): IFileTreeFileNode {
    return {
      type: this.#type,
      name: this.#name,
      ctime: this.#ctime,
      mtime: this.#mtime,
      size: this.#size,
    }
  }
}
