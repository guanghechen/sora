import type { IWorkspacePathResolver } from '@guanghechen/path.types'

export type IHashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512'

export interface ICipherCatalogContext {
  readonly CONTENT_HASH_ALGORITHM: IHashAlgorithm
  readonly MAX_CRYPT_FILE_SIZE: number
  readonly PART_CODE_PREFIX: string
  readonly PATH_HASH_ALGORITHM: IHashAlgorithm
  readonly cryptFilesDir: string
  readonly cryptPathSalt: string
  readonly cryptPathResolver: IWorkspacePathResolver
  readonly plainPathResolver: IWorkspacePathResolver

  /**
   * Generate a nonce with the given size.
   */
  genNonce(size: number): Promise<Uint8Array>

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
