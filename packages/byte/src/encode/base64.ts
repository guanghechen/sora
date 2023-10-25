const CODES: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const CODE_PADDING: string = '='

const CODE_LIST: string[] = CODES.split('')
const CODE_REFLECT = Object.fromEntries(
  CODE_LIST.map((v, idx) => [v, idx]).concat([[CODE_PADDING, 0]]),
)

const sanitizeRegex = /([*^$\\])/g
const validateRegex = new RegExp(
  `^[${CODES.replace(sanitizeRegex, '\\$1')}]+${CODE_PADDING.replace(sanitizeRegex, '\\$1')}{0,2}$`,
)

export function base64Text2bytes(base64Text: string): Uint8Array | never {
  if (base64Text.length <= 0 || !validateBase64Text(base64Text)) {
    throw new TypeError('[base64Text2bytes] Invalid base64 string.')
  }

  let countOfPadding = 0
  for (let i = base64Text.length - 1; i >= 0 && base64Text[i] === CODE_PADDING; --i)
    countOfPadding += 1
  const _size: number = (base64Text.length >> 2) * 3 - countOfPadding
  const result: Uint8Array = new Uint8Array(_size)

  const _end: number = ((base64Text.length - countOfPadding) >> 2) << 2
  let i = 0
  let j = 0
  for (; i < _end; i += 4, j += 3) {
    const v: number = _decodeUint(base64Text, i)
    result[j] = v >> 16
    result[j + 1] = (v >> 8) & 0xff
    result[j + 2] = v & 0xff
  }

  if (countOfPadding > 0) {
    const v: number = _decodeUint(base64Text, i)
    switch (countOfPadding) {
      case 1: {
        result[j] = v >> 16
        result[j + 1] = (v >> 8) & 0xff
        break
      }
      case 2: {
        result[j] = v >> 16
        break
      }
    }
  }
  return result
}

export function bytes2base64Text(bytes: Uint8Array): string {
  let result = ''
  const _end: number = Math.floor(bytes.length / 3) * 3
  for (let i = 0; i < _end; i += 3) {
    result += _encodeUnit((bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2])
  }

  switch (bytes.length - _end) {
    case 1: {
      const tail: string = _encodeUnit(bytes[_end] << 16)
      result += tail.slice(0, 2) + CODE_PADDING + CODE_PADDING
      break
    }
    case 2: {
      const tail: string = _encodeUnit((bytes[_end] << 16) | (bytes[_end + 1] << 8))
      result += tail.slice(0, 3) + CODE_PADDING
    }
  }
  return result
}

export function validateBase64Text(text: string): boolean {
  // The length of a Base64 encoded string should be a multiple of 4.
  if (text.length & 3) return false
  return validateRegex.test(text)
}

function _encodeUnit(v: number): string {
  return (
    CODE_LIST[(v >> 18) & 0x3f] +
    CODE_LIST[(v >> 12) & 0x3f] +
    CODE_LIST[(v >> 6) & 0x3f] +
    CODE_LIST[v & 0x3f]
  )
}

function _decodeUint(text: string, startIdx: number): number {
  const v: number =
    (CODE_REFLECT[text.charAt(startIdx)] << 18) |
    (CODE_REFLECT[text.charAt(startIdx | 1)] << 12) |
    (CODE_REFLECT[text.charAt(startIdx | 2)] << 6) |
    CODE_REFLECT[text.charAt(startIdx | 3)]
  return v
}
