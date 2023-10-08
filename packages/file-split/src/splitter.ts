import { invariant } from '@guanghechen/internal'
import { consumeStream, consumeStreams } from '@guanghechen/stream'
import { createReadStream, createWriteStream } from 'node:fs'
import type { IFilePartItem } from './types'
import { calcFilePartNames } from './util'

interface IProps {
  /**
   * The suffix name of a file part.
   * @default '.ghc-part'
   */
  readonly partCodePrefix?: string
}

/**
 * Inspired by https://github.com/tomvlk/node-split-file.
 */
export class FileSplitter {
  public readonly partCodePrefix: string

  // !!! Don't try to override the encoding. The encoding should always be `undefined`,
  // !!! so node:fs will return raw buffer instead of any structured or pretreated data.
  readonly #encoding: BufferEncoding | undefined = undefined

  constructor(options: IProps = {}) {
    this.partCodePrefix = options.partCodePrefix ?? '.ghc-part'
  }

  /**
   * Calculate the name of parts of sourcefile respectively.
   *
   * @param filepath
   * @param parts
   * @returns
   */
  public calcPartFilepaths(filepath: string, parts: IFilePartItem[]): string[] {
    if (parts.length <= 1) return [filepath]

    const partNames = calcFilePartNames(parts, this.partCodePrefix)
    return partNames.map(partName => filepath + partName)
  }

  /**
   * Split file with part descriptions.
   */
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

  /**
   * Merge files
   *
   * @param inputFilepaths
   * @param outputFilepath
   */
  public async merge(inputFilepaths: string[], outputFilepath: string): Promise<void> {
    invariant(inputFilepaths.length > 0, 'Input file list is empty!')

    const readers: NodeJS.ReadableStream[] = inputFilepaths.map(filepath =>
      createReadStream(filepath, { encoding: this.#encoding }),
    )
    const writer: NodeJS.WritableStream = createWriteStream(outputFilepath, {
      encoding: this.#encoding,
    })

    // The operation of merging files could not be processed in parallel.
    await consumeStreams(readers, writer)
  }
}

export const fileSplitter = new FileSplitter()
