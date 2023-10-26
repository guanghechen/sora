import { createHash } from 'node:crypto'
import fs from 'node:fs'

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
  const mac: Buffer= hash.digest()
  return Uint8Array.from(mac)
}

/**
 * Calc Message Authentication Code from fle.
 *
 * @param filepath
 * @returns
 */
export async function calcMacFromFile(
  filepath: string,
  algorithm: IHashAlgorithm,
): Promise<Uint8Array | never> {
  if (!fs.existsSync(filepath)) {
    throw new Error(`[calcMacFromFile] filepath is not found. (${filepath})`)
  }

  if (!fs.statSync(filepath).isFile()) {
    throw new Error(`[calcMacFromFile] filepath is not a file. (${filepath})`)
  }

  const hash = createHash(algorithm)
  const stream = fs.createReadStream(filepath)
  for await (const chunk of stream) hash.update(chunk)
  const mac: Buffer = hash.digest()
  return Uint8Array.from(mac)
}
