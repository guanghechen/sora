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
 * @param oldItemMap
 * @param plainFilepaths
 * @param strickCheck     Wether if to check some edge cases that shouldn't affect the final result,
 *                        just for higher integrity check.
 */
export async function diffFromPlainFiles(
  catalog: IReadonlyCipherCatalog,
  oldItemMap: ReadonlyMap<string, ICatalogItem>,
  plainFilepaths: string[],
  strickCheck: boolean,
  isPlainPathExist: (plainPath: string) => boolean,
): Promise<IDraftCatalogDiffItem[]> {
  const title = `diffFromPlainFiles`

  const addedItems: IDraftCatalogDiffItem[] = []
  const modifiedItems: IDraftCatalogDiffItem[] = []
  const removedItems: IDraftCatalogDiffItem[] = []

  for (const plainFilepath of plainFilepaths) {
    const key = catalog.normalizePlainFilepath(plainFilepath)
    const oldItem = oldItemMap.get(key)
    const isSrcFileExists = isPlainPathExist(plainFilepath)

    if (isSrcFileExists) {
      const newItem: IDraftCatalogItem = await catalog.calcCatalogItem(plainFilepath)
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
          `[${title}] plainFilepath(${plainFilepath}) is removed but it's not in the catalog before.`,
        )
      }
    }
  }
  return [...removedItems, ...addedItems, ...modifiedItems]
}
