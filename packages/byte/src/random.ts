import { randomBytes as randomBytesFromCrypto } from 'crypto'

/**
 * Generate a random bytes with the given size.
 *
 * Use randomBytes from 'crypto' cause it returns true random numbers.
 *
 * @param size
 * @returns
 */
export function randomBytes(size: number): Uint8Array {
  const bytes: Uint8Array = randomBytesFromCrypto(size)
  return Uint8Array.from(bytes)
}
