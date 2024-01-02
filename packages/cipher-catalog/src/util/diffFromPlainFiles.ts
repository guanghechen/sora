import type {
  ICatalogItem,
  IDraftCatalogDiffItem,
  IDraftCatalogItem,
  IReadonlyCipherCatalog,
} from '@guanghechen/cipher-catalog.types'
import { FileChangeTypeEnum } from '@guanghechen/cipher-catalog.types'
import { invariant } from '@guanghechen/internal'
import { areSameDraftCatalogItem } from './areSameDraftCatalogItem'

/**
 * Calculate diff items.
 *
 * @param catalog
 * @param oldItemMap
 * @param plainPaths
 * @param strickCheck     Wether if to check some edge cases that shouldn't affect the final result,
 *                        just for higher integrity check.
 */
export async function diffFromPlainFiles(
  catalog: IReadonlyCipherCatalog,
  oldItemMap: ReadonlyMap<string, ICatalogItem>,
  plainPaths: string[],
  strickCheck: boolean,
): Promise<IDraftCatalogDiffItem[]> {
  const title = `diffFromPlainFiles`
  const addedItems: IDraftCatalogDiffItem[] = []
  const modifiedItems: IDraftCatalogDiffItem[] = []
  const removedItems: IDraftCatalogDiffItem[] = []

  for (const plainPath of plainPaths) {
    const key: string = catalog.normalizePlainPath(plainPath)
    const oldItem: ICatalogItem | undefined = oldItemMap.get(key)
    const isPlainPathExist: boolean = await catalog.context.isPlainPathExist(plainPath)

    if (isPlainPathExist) {
      const newItem: IDraftCatalogItem = await catalog.calcCatalogItem(plainPath)
      if (oldItem) {
        if (!areSameDraftCatalogItem(oldItem, newItem)) {
          modifiedItems.push({ changeType: FileChangeTypeEnum.MODIFIED, oldItem, newItem })
        }
      } else {
        addedItems.push({ changeType: FileChangeTypeEnum.ADDED, newItem })
      }
    } else {
      if (oldItem) {
        removedItems.push({ changeType: FileChangeTypeEnum.REMOVED, oldItem })
      }

      if (strickCheck) {
        invariant(
          !!oldItem,
          `[${title}] plainFilepath(${plainPath}) is removed but it's not in the catalog before.`,
        )
      }
    }
  }
  return [...removedItems, ...addedItems, ...modifiedItems]
}
