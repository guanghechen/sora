import type { ICipherCatalogContext } from './context'
import type { ICatalogItem, IDeserializedCatalogItem, IDraftCatalogItem } from './item'

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
   * Calc the iv of the given item.
   * @param item
   */
  calcIv(item: IDeserializedCatalogItem | IDraftCatalogItem): Promise<Uint8Array | undefined>

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
   * Find a catalog item which matched the given filter.
   * @param filter
   */
  find(filter: (item: ICatalogItem) => boolean): ICatalogItem | undefined

  /**
   * Flat the deserialized catalog item.
   * @param item
   */
  flatItem(item: IDeserializedCatalogItem): Promise<ICatalogItem>

  /**
   * Get the catalog item by plain filepath.
   * @param plainFilepath
   */
  get(plainFilepath: string): ICatalogItem | undefined

  /**
   * Check if the given plain filepath is existed in the catalog.
   * @param plainFilepath
   */
  has(plainFilepath: string): boolean

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
