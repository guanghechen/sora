export function mergeBytes(bytesList: ReadonlyArray<Uint8Array>): Uint8Array {
  const bytesSize: number = bytesList.reduce((acc, cur) => acc + cur.length, 0)
  const result: Uint8Array = new Uint8Array(bytesSize)
  let k = 0
  for (const bytes of bytesList) {
    for (let i = 0; i < bytes.length; ++i, ++k) {
      result[k] = bytes[i]
    }
  }
  return result
}
