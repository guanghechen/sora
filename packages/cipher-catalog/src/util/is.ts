import { areSameBytes } from '@guanghechen/byte'
import type {
  ICatalogItem,
  IDeserializedCatalogItem,
  IDraftCatalogItem,
} from '@guanghechen/cipher-catalog.types'

export function areSameCatalogItem(
  oldItem: Readonly<ICatalogItem>,
  newItem: Readonly<ICatalogItem>,
): boolean {
  if (oldItem === newItem) return true
  return areSameDraftCatalogItem(oldItem, newItem) && areSameBytes(oldItem.authTag, newItem.authTag)
}

export function areSameDraftCatalogItem(
  oldItem: Readonly<IDraftCatalogItem>,
  newItem: Readonly<IDraftCatalogItem>,
): boolean {
  if (oldItem === newItem) return true
  return (
    oldItem.plainPath === newItem.plainPath &&
    oldItem.fingerprint === newItem.fingerprint &&
    oldItem.size === newItem.size &&
    oldItem.ctime === newItem.ctime &&
    oldItem.mtime === newItem.mtime &&
    oldItem.cryptPath === newItem.cryptPath &&
    oldItem.keepIntegrity === newItem.keepIntegrity &&
    oldItem.keepPlain === newItem.keepPlain &&
    oldItem.cryptPathParts.length === newItem.cryptPathParts.length &&
    oldItem.cryptPathParts.every(part => newItem.cryptPathParts.includes(part)) &&
    areSameBytes(oldItem.nonce, newItem.nonce)
  )
}

export function areSameDeserializedCatalogItem(
  oldItem: Readonly<IDeserializedCatalogItem>,
  newItem: Readonly<IDeserializedCatalogItem>,
): boolean {
  if (oldItem === newItem) return true
  return (
    oldItem.plainPath === newItem.plainPath &&
    oldItem.fingerprint === newItem.fingerprint &&
    oldItem.size === newItem.size &&
    oldItem.ctime === newItem.ctime &&
    oldItem.mtime === newItem.mtime &&
    oldItem.keepIntegrity === newItem.keepIntegrity &&
    oldItem.keepPlain === newItem.keepPlain &&
    oldItem.cryptPathParts.length === newItem.cryptPathParts.length &&
    oldItem.cryptPathParts.every(part => newItem.cryptPathParts.includes(part)) &&
    areSameBytes(oldItem.nonce, newItem.nonce) &&
    areSameBytes(oldItem.authTag, newItem.authTag)
  )
}
