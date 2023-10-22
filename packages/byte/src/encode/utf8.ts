const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf8', { fatal: true })

export function utf8Text2bytes(utf8Text: string): Uint8Array {
  return textEncoder.encode(utf8Text)
}

export function bytes2Utf8Text(bytes: Readonly<Uint8Array>): string {
  return textDecoder.decode(bytes)
}
