import type { ICipherCatalogContext } from './context'
import type { ICatalogItem, IDraftCatalogItem } from './item'

export interface IReadonlyCipherCatalog {
  /**
   * Get current catalog context.
   */
  readonly context: ICipherCatalogContext

  /**
   * Get current catalog items.
   */
  readonly items: Iterable<ICatalogItem>

  /**
   * Generate a catalog item.
   * @param plainFilepath
   */
  calcCatalogItem(plainFilepath: string): Promise<IDraftCatalogItem | never>

  /**
   * Calc crypt filepath.
   * @param plainFilepath
   */
  calcCryptFilepath(plainFilepath: string): string

  /**
   * Check crypt files for corruption.
   * @param cryptFilepaths
   */
  checkCryptIntegrity(cryptFilepaths: string[]): Promise<void | never>

  /**
   * Check plain files for corruption.
   * @param plainFilepaths
   */
  checkPlainIntegrity(plainFilepaths: string[]): Promise<void | never>

  /**
   * Check if the content in the given relativePlainFilepath should be kept plain.
   * @param relativePlainFilepath
   */
  isKeepPlain(relativePlainFilepath: string): boolean

  /**
   * Normalize the given plainFilepath to get a stable string across platforms.
   * @param plainFilepath
   */
  normalizePlainFilepath(plainFilepath: string): string
}
