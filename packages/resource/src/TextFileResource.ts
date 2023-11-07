import { invariant } from '@guanghechen/internal'
import type { ITextResource } from '@guanghechen/resource.types'
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface ITextFileResourceProps {
  strict: boolean
  filepath: string
  encoding: BufferEncoding
}

const clazz: string = 'TextFileResource'

export class TextFileResource implements ITextResource {
  public readonly strict: boolean
  public readonly filepath: string
  public readonly encoding: BufferEncoding

  constructor(props: ITextFileResourceProps) {
    this.strict = props.strict
    this.filepath = props.filepath
    this.encoding = props.encoding
  }

  public async exists(): Promise<boolean> {
    return existsSync(this.filepath)
  }

  public async load(): Promise<string | undefined> {
    if (!existsSync(this.filepath)) {
      invariant(!this.strict, `[${clazz}.load] Cannot find file. ${this.filepath}`)
      return undefined
    }

    invariant(statSync(this.filepath).isFile(), `[${clazz}.load] Not a file. ${this.filepath}`)

    const content: string = await readFile(this.filepath, this.encoding)
    return content
  }

  public async save(content: string): Promise<void> {
    if (existsSync(this.filepath)) {
      invariant(statSync(this.filepath).isFile(), `[${clazz}.save] Not a file. ${this.filepath}`)
    } else {
      const dir: string = path.dirname(this.filepath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      else {
        invariant(statSync(dir).isDirectory(), `[${clazz}.save] Parent path is not a dir. ${dir}`)
      }
    }

    await writeFile(this.filepath, content, this.encoding)
  }

  public async destroy(): Promise<void> {
    if (existsSync(this.filepath)) {
      invariant(statSync(this.filepath).isFile(), `[${clazz}.remove] Not a file.`)
      unlinkSync(this.filepath)
    }
  }
}
