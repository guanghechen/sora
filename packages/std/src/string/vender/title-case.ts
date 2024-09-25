/**
 * Copied from https://github.com/blakeembrey/change-case/blob/32d22ffec5b5a9e7ae6f336ac1823c14f6223703/packages/title-case/src/index.ts
 *
 * Reason: the original repo support esm only while we need to bundle CommonJS.
 */

const TOKENS = /\S+|./g
const IS_MANUAL_CASE = /\p{Ll}(?=[\p{Lu}])|\.\p{L}/u // iPhone, example.com, U.N., etc.
const ALPHANUMERIC_PATTERN = /[\p{L}\d]+/gu

const WORD_SEPARATORS = new Set(['—', '–', '-', '―', '/'])

const SMALL_WORDS = new Set([
  'an',
  'and',
  'as',
  'at',
  'because',
  'but',
  'by',
  'en',
  'for',
  'if',
  'in',
  'neither',
  'nor',
  'of',
  'on',
  'or',
  'only',
  'over',
  'per',
  'so',
  'some',
  'that',
  'than',
  'the',
  'to',
  'up',
  'upon',
  'v',
  'vs',
  'versus',
  'via',
  'when',
  'with',
  'without',
  'yet',
])

export interface Options {
  smallWords?: Set<string>
  locale?: string | string[]
}

export function titleCase(input: string, options: Options | string[] | string = {}): string {
  let result = ''
  let m: RegExpExecArray | null

  const { smallWords = SMALL_WORDS, locale } =
    typeof options === 'string' || Array.isArray(options) ? { locale: options } : options

  // tslint:disable-next-line
  // eslint-disable-next-line no-cond-assign
  while ((m = TOKENS.exec(input)) !== null) {
    const { 0: token, index } = m

    // Ignore already capitalized words.
    if (IS_MANUAL_CASE.test(token)) {
      result += token
    } else {
      result += token.replace(ALPHANUMERIC_PATTERN, (m, i) => {
        // Ignore small words except at beginning or end.
        if (index > 0 && index + token.length < input.length && smallWords.has(m)) {
          return m
        }

        // Only capitalize words after a valid word separator.
        if (i > 1 && !WORD_SEPARATORS.has(input.charAt(index + i - 1))) {
          return m
        }

        return m.charAt(0).toLocaleUpperCase(locale) + m.slice(1)
      })
    }
  }

  return result
}
