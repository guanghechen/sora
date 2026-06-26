import type { IFilePartItem } from '@guanghechen/filepart'
import { DEFAULT_FILEPART_CODE_PREFIX, calcFilePartNames } from '@guanghechen/filepart'
import { invariant } from '@guanghechen/invariant'
import { consumeStream } from '@guanghechen/stream'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import type { IFileSplitter } from './types'

interface IProps {
  /**
   * The suffix name of a file part.
   */
  readonly partCodePrefix?: string
}

/**
 * Inspired by https://github.com/tomvlk/node-split-file.
 */
export class FileSplitter implements IFileSplitter {
  public readonly partCodePrefix: string

  // !!! Don't try to override the encoding. The encoding should always be `undefined`,
  // !!! so node:fs will return raw bytes instead of any structured or pretreated data.
  readonly #encoding: BufferEncoding | undefined = undefined

  constructor(options: IProps = {}) {
    this.partCodePrefix = options.partCodePrefix ?? DEFAULT_FILEPART_CODE_PREFIX
  }

  public calcPartFilepaths(filepath: string, parts: IFilePartItem[]): string[] {
    if (parts.length <= 1) return [filepath]

    const partFilepaths: string[] = []
    for (const partName of calcFilePartNames(parts, this.partCodePrefix)) {
      const partFilepath: string = filepath + partName
      partFilepaths.push(partFilepath)
    }
    return partFilepaths
  }

  public async split(
    filepath: string,
    parts: IFilePartItem[],
    outputFilepath?: string,
  ): Promise<string[]> {
    if (parts.length <= 1) return [filepath]

    const tasks: Array<Promise<void>> = []
    const partFilepaths: string[] = this.calcPartFilepaths(outputFilepath ?? filepath, parts)

    for (let i = 0; i < partFilepaths.length; ++i) {
      const part = parts[i]
      const partFilepath = partFilepaths[i]

      // Create a range in the specified range of the file.
      const reader: NodeJS.ReadableStream = createReadStream(filepath, {
        encoding: this.#encoding,
        start: part.start,
        end: part.end - 1,
      })

      // Save part
      const writer: NodeJS.WritableStream = createWriteStream(partFilepath)
      const task = consumeStream(reader, writer)

      // The operation of splitting the source file can be processed in parallel.
      tasks.push(task)
    }

    await Promise.all(tasks)
    return partFilepaths
  }

  public async merge(inputFilepaths: string[], outputFilepath: string): Promise<void> {
    invariant(inputFilepaths.length > 0, 'Input file list is empty!')

    const encoding = this.#encoding
    const filepaths = [...inputFilepaths]

    // Open each part only when the merged stream reaches it. Creating every read stream up-front
    // lets later missing parts emit errors before a consumer is attached, which can crash Node as
    // an unhandled 'error' event.
    const readParts = async function* (): AsyncIterable<string | Buffer> {
      for (const filepath of filepaths) {
        const reader: NodeJS.ReadableStream = createReadStream(filepath, { encoding })
        for await (const chunk of reader) yield chunk
      }
    }

    await pipeline(
      readParts(),
      createWriteStream(outputFilepath, {
        encoding,
      }),
    )
  }
}

export const fileSplitter = new FileSplitter()
