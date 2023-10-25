import type { IByteEncoding } from '../types'
import { base64Text2bytes, bytes2base64Text } from './base64'
import { bytes2hexText, hexText2bytes } from './hex'
import { bytes2utf8Text, utf8Text2bytes } from './utf8'

type IText2BytesResolver = (text: string) => Uint8Array
type IBytes2TextResolver = (bytes: Uint8Array) => string

const text2bytesResolverMap: Record<IByteEncoding, IText2BytesResolver> = {
  base64: base64Text2bytes,
  hex: hexText2bytes,
  utf8: utf8Text2bytes,
  'utf-8': utf8Text2bytes,
}

const bytes2textResolverMap: Record<IByteEncoding, IBytes2TextResolver> = {
  base64: bytes2base64Text,
  hex: bytes2hexText,
  utf8: bytes2utf8Text,
  'utf-8': bytes2utf8Text,
}

/**
 * Encode the string to Uint8Array with the given encoding.
 * @param data
 * @param encoding
 * @returns
 */
export function text2bytes(text: string, encoding: IByteEncoding): Uint8Array {
  const resolver: IText2BytesResolver | undefined = text2bytesResolverMap[encoding]
  if (resolver === undefined) throw new TypeError(`[text2bytes] Unsupported encoding: ${encoding}.`)
  return resolver(text)
}

export function bytes2text(bytes: Readonly<Uint8Array>, encoding: IByteEncoding): string {
  const resolver: IBytes2TextResolver | undefined = bytes2textResolverMap[encoding]
  if (resolver === undefined) throw new TypeError(`[bytes2text] Unsupported encoding: ${encoding}.`)
  return resolver(bytes)
}
