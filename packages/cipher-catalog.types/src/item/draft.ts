export interface IDraftCatalogItem {
  /**
   * The path of the encrypted file (relative path of the encrypted root directory).
   */
  cryptPath: string

  /**
   * Parts path of the encrypted file.
   *
   * An non-empty array, if there is more than one element, it means that the target file is split
   * into multiple parts, where each element of the array is a part of the crypt file (suffix of the
   * cryptFilepath).
   */
  cryptPathParts: string[]

  /**
   * Fingerprint of contents of the plain file. (hex string)
   */
  fingerprint: string

  /**
   * Whether if keep the source file integrity.
   */
  keepIntegrity: boolean

  /**
   * Whether if keep the source file plain.
   */
  keepPlain: boolean

  /**
   * The path of the plain source file.
   * - relative path of the plain root directory
   */
  plainPath: string

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
