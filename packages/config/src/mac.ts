import { createHash } from 'node:crypto'

export type IHashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512'

/**
 * Calc Message Authentication Code.
 *
 * @param pieces
 */
export function calcMac(
  chunks: ReadonlyArray<Readonly<Uint8Array>>,
  algorithm: IHashAlgorithm,
): Uint8Array {
  const hash = createHash(algorithm)
  for (const chunk of chunks) hash.update(chunk)
  const mac: Uint8Array = hash.digest()
  return Uint8Array.from(mac)
}
