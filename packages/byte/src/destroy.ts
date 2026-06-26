import { randomFillSync } from 'node:crypto'

/**
 * Overwrite the bytes in place with cryptographically strong random data.
 * @param bytes
 */
export function destroyBytes(bytes: Uint8Array): void {
  randomFillSync(bytes)
}

/**
 * Destroy bytes lists.
 * @param bytesList
 */
export function destroyBytesList(bytesList: Uint8Array[]): void {
  for (const bytes of bytesList) destroyBytes(bytes)
}
