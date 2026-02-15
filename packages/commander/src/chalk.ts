/**
 * Terminal style utilities for help rendering.
 */

export const TERMINAL_STYLE = {
  bold: '\x1b[1m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
} as const

export type ITerminalStyle = (typeof TERMINAL_STYLE)[keyof typeof TERMINAL_STYLE]

export function styleText(text: string, ...styles: ITerminalStyle[]): string {
  return `${styles.join('')}${text}${TERMINAL_STYLE.reset}`
}
