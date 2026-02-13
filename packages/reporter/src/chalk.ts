/**
 * Terminal output formatting utilities
 */

import type { ILogLevel } from './level'

/** ANSI escape codes for terminal output */
export const ANSI = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  hint: '\x1b[35m', // magenta
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  dim: '\x1b[90m', // gray
  reset: '\x1b[0m',
} as const

/**
 * Format a tag with optional ANSI colors
 */
export function formatTag(level: ILogLevel, prefixes: string[], color: boolean): string {
  if (!color) return `[${prefixes.join(':')}]`
  const c = ANSI[level]
  const d = ANSI.dim
  const r = ANSI.reset
  return `${d}[${r}${prefixes.map(p => `${c}${p}${r}`).join(`${d}:${r}`)}${d}]${r}`
}
