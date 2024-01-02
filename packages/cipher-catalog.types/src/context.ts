import type { IWorkspacePathResolver } from '@guanghechen/path.types'

export type IHashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512'

export interface ICatalogItemForNonce {
  readonly nonce: Readonly<Uint8Array> | undefined
  readonly plainPath: string
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
   * Generate a nonce for the given item.
   * @param item
   */
  genNonce(item: ICatalogItemForNonce): Promise<Uint8Array | undefined>

  /**
   * Check if the content in the given relativePlainFilepath should be kept integrity.
   * @param plainPath
   */
  isKeepIntegrity(plainPath: string): boolean

  /**
   * Check if the plain file should be kept plain.
   * @param plainPath
   */
  isKeepPlain(plainPath: string): boolean

  /**
   * Check if the given plainPath exist.
   * @param plainPath
   * @returns
   */
  isPlainPathExist(plainPath: string): boolean
}
