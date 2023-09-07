import { ansi256ToAnsi } from './ansi256'
import { rgb2ansi256 } from './rgb'

export function hex2rgb(hex: string): [r: number, g: number, b: number] {
  if (hex.length === 3) {
    const [R, G, B] = hex
    const r: number = Number.parseInt(R, 16)
    const g: number = Number.parseInt(G, 16)
    const b: number = Number.parseInt(B, 16)
    return [r * 16 + r, g * 16 + g, b * 16 + b]
  }

  if (hex.length === 6) {
    const [R1, R2, G1, G2, B1, B2] = hex
    const r1: number = Number.parseInt(R1, 16)
    const r2: number = Number.parseInt(R2, 16)
    const g1: number = Number.parseInt(G1, 16)
    const g2: number = Number.parseInt(G2, 16)
    const b1: number = Number.parseInt(B1, 16)
    const b2: number = Number.parseInt(B2, 16)
    return [r1 * 16 + r2, g1 * 16 + g2, b1 * 16 + b2]
  }

  return [0, 0, 0]
}

export function hex2ansi256(hex: string): number {
  const [r, g, b] = hex2rgb(hex)
  return rgb2ansi256(r, g, b)
}

export function hex2ansi(hex: string): number {
  const ansi256: number = hex2ansi256(hex)
  return ansi256ToAnsi(ansi256)
}
