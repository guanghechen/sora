/**
 * A minimal, level-based logging utility with colored output and breadcrumb prefix support.
 *
 * @module @guanghechen/reporter
 */

import type { IReporter, IReporterLevel } from '@guanghechen/types'
export type { IReporter, IReporterLevel } from '@guanghechen/types'

export type IReporterOutput = (level: IReporterLevel, parts: string[], args: unknown[]) => void

export interface IReporterFlight {
  /** Include ISO timestamp in output (default: true) */
  date?: boolean
  /** Use ANSI color codes (default: true) */
  color?: boolean
}

export interface IReporterProps {
  /** Initial prefix, cannot contain ':' (e.g., 'app') */
  prefix?: string
  /** Minimum log level (default: 'info') */
  level?: IReporterLevel
  /** Output control options */
  flight?: IReporterFlight
  /** Custom output function (default: console) */
  output?: IReporterOutput
}

export interface IReporterEntry {
  level: IReporterLevel
  prefixes: string[]
  args: unknown[]
  date: Date
}

const LEVELS: Record<IReporterLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const ANSI = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  dim: '\x1b[90m',
  reset: '\x1b[0m',
}

const defaultOutput: IReporterOutput = (level, parts, args) => {
  const c = globalThis.console
  switch (level) {
    case 'debug':
      c.debug(...parts, ...args)
      break
    case 'info':
      c.log(...parts, ...args)
      break
    case 'warn':
      c.warn(...parts, ...args)
      break
    case 'error':
      c.error(...parts, ...args)
      break
  }
}

function formatTag(level: IReporterLevel, prefixes: string[], color: boolean): string {
  if (!color) return `[${prefixes.join(':')}]`
  const c = ANSI[level]
  const d = ANSI.dim
  const r = ANSI.reset
  return `${d}[${r}${prefixes.map(p => `${c}${p}${r}`).join(`${d}:${r}`)}${d}]${r}`
}

function isLevel(s: string): s is IReporterLevel {
  return s === 'debug' || s === 'info' || s === 'warn' || s === 'error'
}

export class Reporter implements IReporter {
  #prefixes: string[] = []
  #threshold: number
  #level: IReporterLevel
  #date: boolean
  #color: boolean
  #output: IReporterOutput
  #entries: IReporterEntry[] | null = null

  constructor(props: IReporterProps = {}) {
    const { prefix, level = 'info', flight = {}, output = defaultOutput } = props
    if (prefix !== undefined) {
      if (prefix.includes(':')) throw new Error('Prefix cannot contain ":"')
      this.#prefixes.push(prefix)
    }
    this.#level = isLevel(level) ? level : 'info'
    this.#threshold = LEVELS[this.#level]
    this.#date = flight.date ?? true
    this.#color = flight.color ?? true
    this.#output = output
  }

  public attach(prefix: string): () => void {
    if (prefix.includes(':')) throw new Error('Prefix cannot contain ":"')
    const prevLen = this.#prefixes.length
    this.#prefixes.push(prefix)
    return () => {
      this.#prefixes.length = prevLen
    }
  }

  public mock(): this {
    this.#entries = []
    return this
  }

  public collect(): IReporterEntry[] {
    const entries = this.#entries ?? []
    this.#entries = null
    return entries
  }

  public log(level: IReporterLevel, ...args: unknown[]): void {
    const lv = isLevel(level) ? level : this.#level
    if (LEVELS[lv] < this.#threshold) return

    const resolved: unknown[] = []
    for (const a of args) {
      if (typeof a === 'function') {
        resolved.push(Reflect.apply(a, undefined, []))
      } else {
        resolved.push(a)
      }
    }
    const now = new Date()

    if (this.#entries !== null) {
      this.#entries.push({ level: lv, prefixes: [...this.#prefixes], args: resolved, date: now })
      return
    }

    const tags = this.#prefixes.length > 0 ? this.#prefixes : [lv]
    const parts: string[] = []
    if (this.#date) {
      const ts = now.toISOString()
      parts.push(this.#color ? `${ANSI.dim}${ts}${ANSI.reset}` : ts)
    }
    parts.push(formatTag(lv, tags, this.#color))
    this.#output(lv, parts, resolved)
  }

  public debug(...args: unknown[]): this {
    this.log('debug', ...args)
    return this
  }

  public info(...args: unknown[]): this {
    this.log('info', ...args)
    return this
  }

  public warn(...args: unknown[]): this {
    this.log('warn', ...args)
    return this
  }

  public error(...args: unknown[]): this {
    this.log('error', ...args)
    return this
  }
}
