/**
 * Fill the bytes with random numbers.
 * @param bytes
 */
export function destroyBytes(bytes: Uint8Array): void {
  bytes.fill(0)
  bytes.fill(1)
  bytes.fill(Math.random() * 127)
}

/**
 * Destroy bytes lists.
 * @param bytesList
 */
export function destroyBytesList(bytesList: Uint8Array[]): void {
  for (const bytes of bytesList) destroyBytes(bytes)
}
