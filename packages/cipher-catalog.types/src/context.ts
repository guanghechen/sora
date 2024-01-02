import type { IWorkspacePathResolver } from '@guanghechen/path.types'

export type IHashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512'

export interface ICipherCatalogStat {
  /**
   * File create time.
   */
  ctime: number

  /**
   * File modify time.
   */
  mtime: number

  /**
   * File size.
   */
  size: number
}

export interface ICipherCatalogContext {
  readonly CONTENT_HASH_ALGORITHM: IHashAlgorithm
  readonly MAX_CRYPT_FILE_SIZE: number
  readonly NONCE_SIZE: number
  readonly PART_CODE_PREFIX: string
  readonly PATH_HASH_ALGORITHM: IHashAlgorithm
  readonly cryptFilesDir: string
  readonly cryptPathSalt: string
  readonly cryptPathResolver: IWorkspacePathResolver
  readonly plainPathResolver: IWorkspacePathResolver

  /**
   * Calculate fingerprint for the given plain file.
   * @param plainPath
   */
  calcFingerprint(plainPath: string): Promise<string>

  /**
   * Generate a nonce with the given size.
   */
  genNonce(): Promise<Uint8Array>

  /**
   * Check if the content in the given relativePlainFilepath should be kept integrity.
   * @param plainPath
   */
  isKeepIntegrity(plainPath: string): Promise<boolean>

  /**
   * Check if the plain file should be kept plain.
   * @param plainPath
   */
  isKeepPlain(plainPath: string): Promise<boolean>

  /**
   * Check if the given plainPath exist.
   * @param plainPath
   */
  isPlainPathExist(plainPath: string): Promise<boolean>

  /**
   * Normalize the given plainFilepath to get a stable string across platforms.
   * @param plainPath
   */
  normalizePlainPath(plainPath: string): string

  /**
   * Get the plain file stat.
   * @param plainPath
   */
  statPlainFile(plainPath: string): Promise<ICipherCatalogStat | undefined>
}
