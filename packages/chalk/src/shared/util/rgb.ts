import { ansi256ToAnsi } from './ansi256'

export function rgb2ansi256(r: number, g: number, b: number): number {
  // We use the extended grayscale palette here, with the exception of
  // black and white. normal palette only has 4 grayscale shades.
  if (r === g && g === b) {
    if (r < 8) return 16
    if (r > 248) return 231
    return Math.round(((r - 8) / 247) * 24) + 232
  }

  return (
    16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5)
  )
}

export function rgb2ansi(r: number, g: number, b: number): number {
  const ansi256 = rgb2ansi256(r, g, b)
  return ansi256ToAnsi(ansi256)
}

export function rgb2hex(r: number, g: number, b: number): string {
  const R: string = r < 16 ? '0' + r.toString(16) : r.toString(16)
  const G: string = g < 16 ? '0' + g.toString(16) : g.toString(16)
  const B: string = b < 16 ? '0' + b.toString(16) : b.toString(16)
  return R + G + B
}
