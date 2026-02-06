/**
 * A minimal .env parser with variable interpolation.
 *
 * @module @guanghechen/env
 */

/** Record of environment variables (always string values) */
export type IEnvRecord = Record<string, string>

/** Options for stringify */
export interface IStringifyEnvOptions {
  /** Keys to exclude from output */
  exclude?: string[]
}

/** Key pattern: standard shell variable naming ([A-Za-z_][A-Za-z0-9_]*) */
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Parse .env content string into an object.
 * Supports comments, export prefix, quoted values, and variable interpolation.
 * @param content - .env file content
 * @returns Parsed environment record
 * @throws {SyntaxError} If unclosed quote is detected
 */
export function parse(content: string): IEnvRecord {
  const env: IEnvRecord = {}
  if (!content) return env

  const lines = content.replace(/\r\n?/g, '\n').split('\n')

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue

    // Remove optional export prefix
    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed

    // Find key and value separator (only =, no spaces allowed around it)
    const sepIndex = withoutExport.indexOf('=')
    if (sepIndex === -1) continue

    const key = withoutExport.slice(0, sepIndex)
    if (!key || !KEY_PATTERN.test(key)) continue

    let value = withoutExport.slice(sepIndex + 1)

    // Handle empty value
    if (!value) {
      env[key] = ''
      continue
    }

    const quoteChar = value[0]
    const isDoubleQuote = quoteChar === '"'
    const isSingleQuote = quoteChar === "'"

    if (isDoubleQuote || isSingleQuote) {
      // Find closing quote
      const closeIndex = findClosingQuote(value, quoteChar)
      if (closeIndex === -1) {
        throw new SyntaxError(`Unclosed quote at line ${lineNum + 1}: ${line}`)
      }

      value = value.slice(1, closeIndex)

      if (isDoubleQuote) {
        // Process escape sequences in double quotes (order matters: \\ first)
        value = processEscapeSequences(value)

        // Variable interpolation (only in double quotes)
        value = interpolate(value, env)
      }
      // Single quotes: no escape processing, no interpolation
    } else {
      // Unquoted value: handle inline comments
      const commentIndex = value.search(/\s+#/)
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex)
      }

      // Variable interpolation for unquoted values
      value = interpolate(value, env)
    }

    env[key] = value
  }

  return env
}

/**
 * Find the closing quote index, handling escaped quotes.
 */
function findClosingQuote(value: string, quoteChar: string): number {
  for (let i = 1; i < value.length; i += 1) {
    if (value[i] === '\\' && value[i + 1] === quoteChar) {
      i += 1
      continue
    }
    if (value[i] === quoteChar) {
      return i
    }
  }
  return -1
}

const BACKSLASH_PLACEHOLDER = '\uE000' // Private Use Area character

/**
 * Process escape sequences in double-quoted values.
 * Order matters: \\ must be handled first to avoid double processing.
 */
function processEscapeSequences(value: string): string {
  return value
    .replace(/\\\\/g, BACKSLASH_PLACEHOLDER)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(new RegExp(BACKSLASH_PLACEHOLDER, 'g'), '\\')
}

/**
 * Interpolate ${VAR} in value, supports \${VAR} escape.
 */
function interpolate(value: string, env: IEnvRecord): string {
  return value.replace(/\\?\$\{([^}]+)\}/g, (match, varName: string) => {
    if (match.startsWith('\\')) {
      return match.slice(1) // Return ${VAR} without backslash
    }
    return env[varName] ?? ''
  })
}

/**
 * Stringify a single value for .env format.
 */
function stringifyValue(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
  const needsQuote =
    escaped !== value || value.includes(' ') || value.includes("'") || value.includes('#')
  return needsQuote ? `"${escaped}"` : escaped
}

/**
 * Convert environment record to .env format string.
 * Values containing spaces, quotes, newlines, or # are double-quoted.
 * @param env - Environment record to stringify
 * @param options - Stringify options
 * @returns .env format string
 */
export function stringify(env: IEnvRecord, options?: IStringifyEnvOptions): string {
  const excludeSet = new Set(options?.exclude ?? [])
  const lines: string[] = []
  for (const [key, value] of Object.entries(env)) {
    if (excludeSet.has(key)) continue
    lines.push(`${key}=${stringifyValue(value)}`)
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}
