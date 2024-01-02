/**
 * Check if two Uint8Array are same.
 * @param bytes1
 * @param bytes2
 * @returns
 */
export function areSameBytes(
  bytes1: Readonly<Uint8Array> | undefined,
  bytes2: Readonly<Uint8Array> | undefined,
): boolean {
  if (bytes1 === bytes2) return true
  if (bytes1 === undefined) return false
  if (bytes2 === undefined) return false
  if (bytes1.length !== bytes2.length) return false

  for (let i = 0; i < bytes1.length; ++i) {
    if (bytes1.at(i) !== bytes2.at(i)) return false
  }
  return true
}
