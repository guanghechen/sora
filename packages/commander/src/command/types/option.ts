import type { ICommandContext } from './execution'

/** Option value type */
export type ICommandOptionType = 'boolean' | 'number' | 'string'

/** Option argument mode */
export type ICommandOptionArgs = 'none' | 'required' | 'optional' | 'variadic'

/**
 * Option configuration.
 *
 * `type` and `args` must be specified together. Valid combinations:
 * - boolean + none -> boolean
 * - string + required -> string
 * - string + optional -> string | undefined
 * - number + required -> number
 * - string + variadic -> string[]
 * - number + variadic -> number[]
 *
 * @template T - The type of the option value
 */
export interface ICommandOptionConfig<T = unknown> {
  /** Long option name (camelCase, required) */
  long: string
  /** Short option (single character) */
  short?: string
  /** Value type (required) */
  type: ICommandOptionType
  /** Argument mode (required) */
  args: ICommandOptionArgs
  /** Description for help text */
  desc: string
  /** Whether this option is required (mutually exclusive with default) */
  required?: boolean
  /** Default value when not provided */
  default?: T
  /** Allowed values for validation and completion */
  choices?: T extends Array<infer U> ? U[] : T[]
  /** Single value transformation (called for each value, before choices validation) */
  coerce?: (rawValue: string) => T extends Array<infer U> ? U : T
  /** Callback after parsing, applies value to context */
  apply?: (value: T, ctx: ICommandContext) => void
}
