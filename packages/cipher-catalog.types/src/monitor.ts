import type { ICatalogDiffItem } from './diff-item';

export interface ICipherCatalogMonitor {
  /**
   * On catalog item changed.
   * @param diffItems
   */
  onItemChanged(diffItems: ReadonlyArray<ICatalogDiffItem>): void
}

export type IUnMonitorCipherCatalog = () => void
