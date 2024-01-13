import type { CatalogItemChangeType } from './constant'
import type { ICatalogItem } from './item'

export interface ICatalogEventInsert {
  type: CatalogItemChangeType.INSERT_OR_UPDATE
  item: ICatalogItem
}

export interface ICatalogEventRemove {
  type: CatalogItemChangeType.REMOVE
  plainPath: string
}

export interface ICatalogEventReset {
  type: CatalogItemChangeType.RESET
}

export type ICatalogEvent = ICatalogEventInsert | ICatalogEventRemove | ICatalogEventReset

export interface ICipherCatalogMonitor {
  /**
   * On catalog item changed.
   * @param diffItems
   */
  onItemChanged(event: ICatalogEvent): void
}

export type IUnMonitorCipherCatalog = () => void
