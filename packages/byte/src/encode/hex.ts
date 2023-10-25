const hexCodeMap = {
  0: 0x00,
  1: 0x01,
  2: 0x02,
  3: 0x03,
  4: 0x04,
  5: 0x05,
  6: 0x06,
  7: 0x07,
  8: 0x08,
  9: 0x09,
  a: 0x0a,
  b: 0x0b,
  c: 0x0c,
  d: 0x0d,
  e: 0x0e,
  f: 0x0f,
  A: 0x0a,
  B: 0x0b,
  C: 0x0c,
  D: 0x0d,
  E: 0x0e,
  F: 0x0f,
}

const invHexCodeMap = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
]

type IHexKey = keyof typeof hexCodeMap

export function hexText2bytes(hexText: string): Uint8Array {
  if (hexText.length % 2 !== 0) {
    throw new Error('[hexText2bytes] Hex string length must be even.')
  }

  const bytesSize = hexText.length / 2
  const bytes = new Uint8Array(bytesSize)

  for (let i = 0, j = 0; i < bytesSize; ++i, j += 2) {
    const high: number | undefined = hexCodeMap[hexText[j] as IHexKey]
    const low: number | undefined = hexCodeMap[hexText[j + 1] as IHexKey]
    if (high === undefined) {
      throw new Error(`[hexText2bytes] bad hex string, unknown char (${hexText[j]}).`)
    }
    if (low === undefined) {
      throw new Error(`[hexText2bytes] bad hex string, unknown char (${hexText[j + 1]}).`)
    }
    bytes[i] = (high << 4) | low
  }
  return bytes
}

export function bytes2hexText(bytes: Readonly<Uint8Array>): string {
  const hexText = new Array(bytes.length * 2)
  for (let i = 0, j = 0; i < bytes.length; ++i, j += 2) {
    const high = bytes[i] >>> 4
    const low = bytes[i] & 0x0f
    hexText[j] = invHexCodeMap[high]
    hexText[j + 1] = invHexCodeMap[low]
  }
  return hexText.join('')
}
