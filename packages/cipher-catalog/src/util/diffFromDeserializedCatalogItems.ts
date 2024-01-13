import type {
  IDeserializedCatalogDiffItem,
  IDeserializedCatalogItem,
} from '@guanghechen/cipher-catalog.types'
import { FileChangeTypeEnum } from '@guanghechen/cipher-catalog.types'
import { iterable2map } from '@guanghechen/internal'
import { areSameDeserializedCatalogItem } from './is'

/**
 * Calculate diff items with the new catalog items.
 * @param oldItems
 * @param newItems
 */
export function diffFromDeserializedCatalogItems(
  oldItems: ReadonlyArray<IDeserializedCatalogItem>,
  newItems: ReadonlyArray<IDeserializedCatalogItem>,
): IDeserializedCatalogDiffItem[] {
  if (oldItems.length < 1) {
    return newItems.map(newItem => ({ changeType: FileChangeTypeEnum.ADDED, newItem }))
  }

  if (newItems.length < 1) {
    return oldItems.map(oldItem => ({ changeType: FileChangeTypeEnum.REMOVED, oldItem }))
  }

  const addedItems: IDeserializedCatalogDiffItem[] = []
  const modifiedItems: IDeserializedCatalogDiffItem[] = []
  const removedItems: IDeserializedCatalogDiffItem[] = []

  const newItemMap: Map<string, IDeserializedCatalogItem> = iterable2map(
    newItems,
    item => item.plainPath,
  )

  // Collect removed and modified items.
  for (const oldItem of oldItems) {
    const newItem = newItemMap.get(oldItem.plainPath)
    if (newItem === undefined) {
      removedItems.push({
        changeType: FileChangeTypeEnum.REMOVED,
        oldItem,
      })
    } else {
      if (!areSameDeserializedCatalogItem(oldItem, newItem)) {
        modifiedItems.push({
          changeType: FileChangeTypeEnum.MODIFIED,
          oldItem,
          newItem,
        })
      }
    }
  }

  // Collect added items.
  const oldItemSet: Set<string> = new Set(oldItems.map(item => item.plainPath))
  for (const newItem of newItems) {
    if (!oldItemSet.has(newItem.plainPath)) {
      addedItems.push({
        changeType: FileChangeTypeEnum.ADDED,
        newItem,
      })
    }
  }

  return [...removedItems, ...addedItems, ...modifiedItems]
}
