import type { IByteEncoding } from '../types'
import { bytes2HexText, hexText2bytes } from './hex'
import { bytes2Utf8Text, utf8Text2bytes } from './utf8'

/**
 * Encode the string to Uint8Array with the given encoding.
 * @param data
 * @param encoding
 * @returns
 */
export function text2bytes(text: string, encoding: IByteEncoding): Uint8Array {
  switch (encoding) {
    case 'utf8':
    case 'utf-8':
      return utf8Text2bytes(text)
    case 'hex':
      return hexText2bytes(text)
    default:
      throw new TypeError(`[text2bytes] Unsupported encoding: ${encoding}.`)
  }
}

export function bytes2text(bytes: Readonly<Uint8Array>, encoding: IByteEncoding): string {
  switch (encoding) {
    case 'utf8':
    case 'utf-8':
      return bytes2Utf8Text(bytes)
    case 'hex':
      return bytes2HexText(bytes)
    default:
      throw new TypeError(`[bytes2text] Unsupported encoding: ${encoding}.`)
  }
}
