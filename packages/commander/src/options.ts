/**
 * Pre-defined common options for @guanghechen/commander
 *
 * @module @guanghechen/commander/options
 */

import type { ILogLevel } from '@guanghechen/reporter'
import { LOG_LEVELS, resolveLogLevel } from '@guanghechen/reporter'
import type { ICommandOptionConfig } from './types'

/**
 * Pre-defined --log-level option for setting log verbosity.
 *
 * Supports: debug | info | hint | warn | error (case-insensitive)
 *
 * | Property  | Value                              |
 * | --------- | ---------------------------------- |
 * | long      | 'logLevel'                         |
 * | type      | 'string'                           |
 * | args      | 'required'                         |
 * | default   | 'info'                             |
 * | choices   | LOG_LEVELS                         |
 * | coerce    | resolveLogLevel (case-insensitive) |
 * | apply     | ctx.reporter.setLevel(value)       |
 *
 * @example
 * ```typescript
 * import { logLevelOption } from '@guanghechen/commander'
 *
 * const cmd = new Command('app')
 *   .option(logLevelOption)
 *   .action(({ opts }) => {
 *     console.log(opts.logLevel) // 'debug' | 'info' | 'hint' | 'warn' | 'error'
 *   })
 *
 * // Override with spread syntax
 * .option({ ...logLevelOption, default: 'warn' })
 * ```
 */
export const logLevelOption: ICommandOptionConfig<string> = {
  long: 'logLevel',
  type: 'string',
  args: 'required',
  desc: 'Set log level',
  default: 'info',
  choices: LOG_LEVELS as ILogLevel[],
  coerce: (raw: string): string => {
    const level = resolveLogLevel(raw)
    if (level === undefined) {
      throw new Error(`Invalid log level: ${raw}`)
    }
    return level
  },
  apply: (value, ctx): void => {
    ctx.reporter.setLevel(value as ILogLevel)
  },
}

/**
 * Pre-defined --log-date option for controlling timestamp output.
 *
 * | Property  | Value     |
 * | --------- | --------- |
 * | long      | 'logDate' |
 * | type      | 'boolean' |
 * | args      | 'none'    |
 * | default   | true      |
 */
export const logDateOption: ICommandOptionConfig<boolean> = {
  long: 'logDate',
  type: 'boolean',
  args: 'none',
  desc: 'Enable log timestamp',
  default: true,
  apply: (value, ctx): void => {
    ctx.reporter.setFlight({ date: Boolean(value) })
  },
}

/**
 * Pre-defined --log-colorful option for controlling colorful output.
 *
 * | Property  | Value         |
 * | --------- | ------------- |
 * | long      | 'logColorful' |
 * | type      | 'boolean'     |
 * | args      | 'none'        |
 * | default   | true          |
 */
export const logColorfulOption: ICommandOptionConfig<boolean> = {
  long: 'logColorful',
  type: 'boolean',
  args: 'none',
  desc: 'Enable colorful log output',
  default: true,
  apply: (value, ctx): void => {
    ctx.reporter.setFlight({ color: Boolean(value) })
  },
}

/**
 * Pre-defined --silent option for suppressing non-error output.
 *
 * | Property  | Value     |
 * | --------- | --------- |
 * | long      | 'silent'  |
 * | type      | 'boolean' |
 * | args      | 'none'    |
 * | default   | false     |
 *
 * @example
 * ```typescript
 * import { silentOption } from '@guanghechen/commander'
 *
 * const cmd = new Command('app')
 *   .option(silentOption)
 *   .action(({ opts }) => {
 *     if (!opts.silent) {
 *       console.log('Processing...')
 *     }
 *   })
 * ```
 */
export const silentOption: ICommandOptionConfig<boolean> = {
  long: 'silent',
  type: 'boolean',
  args: 'none',
  desc: 'Suppress non-error output',
  default: false,
  apply: (value, ctx): void => {
    if (value) {
      ctx.reporter.setLevel('error')
    }
  },
}
