import type { IFilePartItem } from '@guanghechen/filepart'

export interface IFileSplitter {
  /**
   * File part code prefix.
   */
  readonly partCodePrefix: string

  /**
   * Calculate the name of parts of sourcefile respectively.
   *
   * @param filepath
   * @param parts
   * @returns
   */
  calcPartFilepaths(filepath: string, parts: IFilePartItem[]): string[]

  /**
   * Split file with part descriptions.
   */
  split(filepath: string, parts: IFilePartItem[], outputFilepath?: string): Promise<string[]>

  /**
   * Merge files
   *
   * @param inputFilepaths
   * @param outputFilepath
   */
  merge(inputFilepaths: string[], outputFilepath: string): Promise<void>
}
