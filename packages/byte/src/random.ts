/**
 * Generate a random bytes with the given size.
 * @param size
 * @returns
 */
export function randomBytes(size: number): Uint8Array {
  const bytes: Uint8Array = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    const v: number = Math.random() * 256
    bytes[i] = v >>> 0
  }
  return bytes
}
