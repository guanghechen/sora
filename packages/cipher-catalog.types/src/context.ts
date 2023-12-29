import type { IWorkspacePathResolver } from '@guanghechen/path.types'

export type IHashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512'

export interface ICatalogItemForIv {
  plainPath: string
}

export interface ICipherCatalogContext {
  readonly contentHashAlgorithm: IHashAlgorithm
  readonly cryptFilepathSalt: string
  readonly cryptFilesDir: string
  readonly cryptPathResolver: IWorkspacePathResolver
  readonly maxTargetFileSize: number
  readonly partCodePrefix: string
  readonly pathHashAlgorithm: IHashAlgorithm
  readonly plainPathResolver: IWorkspacePathResolver

  /**
   * Calc the iv of the given item.
   * @param item
   */
  calcIv(item: ICatalogItemForIv): Promise<Uint8Array | undefined>

  /**
   * Check if the content in the given relativePlainFilepath should be kept integrity.
   * @param relativePlainFilepath
   */
  isKeepIntegrity(relativePlainFilepath: string): boolean

  /**
   * Check if the plain file should be kept plain.
   * @param relativePlainFilepath
   */
  isKeepPlain(relativePlainFilepath: string): boolean
}
