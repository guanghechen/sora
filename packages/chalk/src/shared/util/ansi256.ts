export function ansi256ToAnsi(code: number): number {
  if (code < 8) return 30 + code
  if (code < 16) return 90 + (code - 8)

  let r: number
  let g: number
  let b: number

  if (code >= 232) {
    r = ((code - 232) * 10 + 8) / 255
    g = r
    b = r
  } else {
    // eslint-disable-next-line no-param-reassign
    code -= 16
    const remainder = code % 36

    r = Math.floor(code / 36) / 5
    g = Math.floor(remainder / 6) / 5
    b = (remainder % 6) / 5
  }

  const value = Math.max(r, g, b) * 2
  if (value === 0) return 30

  // eslint-disable-next-line no-bitwise
  let result = 30 + ((Math.round(b) << 2) | (Math.round(g) << 1) | Math.round(r))
  if (value === 2) result += 60
  return result
}
