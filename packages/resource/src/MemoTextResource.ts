import type { ITextResource } from '@guanghechen/types'

export interface IMemoTextResourceProps {
  strict: boolean
  encoding: BufferEncoding
  content: string | undefined
}

const clazz = 'MemoTextResource'

export class MemoTextResource implements ITextResource {
  public readonly strict: boolean
  public readonly encoding: BufferEncoding
  protected _content: string | undefined
  protected _alive: boolean

  constructor(props: IMemoTextResourceProps) {
    this.strict = props.strict
    this.encoding = props.encoding
    this._content = props.content
    this._alive = true
  }

  public async destroy(): Promise<void> {
    this._alive = false
  }

  public async exists(): Promise<boolean> {
    return this._alive
  }

  public async load(): Promise<string | undefined> {
    if (this.strict && !this._alive) {
      throw new Error(`[${clazz}.load] the resource has been destroyed.`)
    }
    return this._content
  }

  public async save(content: string): Promise<void> {
    if (this.strict && !this._alive) {
      throw new Error(`[${clazz}.save] the resource has been destroyed.`)
    }
    this._content = content
  }
}
