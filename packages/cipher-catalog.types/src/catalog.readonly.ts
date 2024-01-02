import type { ICipherCatalogContext } from './context'
import type { ICatalogItem, IDeserializedCatalogItem, IDraftCatalogItem } from './item'
import type { ICipherCatalogMonitor, IUnMonitorCipherCatalog } from './monitor'

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
   * @param plainPath
   */
  calcCatalogItem(plainPath: string): Promise<IDraftCatalogItem | never>

  /**
   * Calc crypt filepath.
   * @param plainPath
   */
  calcCryptFilepath(plainPath: string): string

  /**
   * Check crypt files for corruption.
   * @param cryptPaths
   */
  checkCryptIntegrity(cryptPaths: string[]): Promise<void | never>

  /**
   * Check plain files for corruption.
   * @param plainPaths
   */
  checkPlainIntegrity(plainPaths: string[]): Promise<void | never>

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
   * Generate a nonce with the given size.
   */
  genNonce(): Promise<Uint8Array>

  /**
   * Get the catalog item by plain filepath.
   * @param plainPath
   */
  get(plainPath: string): ICatalogItem | undefined

  /**
   * Check if the given plain filepath is existed in the catalog.
   * @param plainPath
   */
  has(plainPath: string): boolean

  /**
   * Check if the content in the given relativePlainFilepath should be kept integrity.
   * @param plainPath
   */
  isKeepIntegrity(plainPath: string): boolean

  /**
   * Check if the content in the given relativePlainFilepath should be kept plain.
   * @param plainPath
   */
  isKeepPlain(plainPath: string): boolean

  /**
   * Check if the given plainPath exist.
   * @param plainPath
   * @returns
   */
  isPlainPathExist(plainPath: string): boolean

  /**
   * Monitor the catalog change.
   * @param monitor
   */
  monitor(monitor: Partial<ICipherCatalogMonitor>): IUnMonitorCipherCatalog

  /**
   * Normalize the given plainFilepath to get a stable string across platforms.
   * @param plainPath
   */
  normalizePlainPath(plainPath: string): string
}
