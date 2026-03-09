/** Argument kind */
export type ICommandArgumentKind = 'required' | 'optional' | 'variadic' | 'some'

/** Argument value type */
export type ICommandArgumentType = 'string' | 'choice'

/**
 * Positional argument configuration.
 *
 * Constraints:
 * - required arguments must come before optional
 * - variadic can only appear once, and must be last
 * - required cannot have default
 *
 * @template T - The type of the argument value
 */
export interface ICommandArgumentConfig<T = unknown> {
  /** Argument name */
  name: string
  /** Argument description */
  desc: string
  /** Argument kind: required / optional / variadic */
  kind: ICommandArgumentKind
  /** Value type */
  type: ICommandArgumentType
  /** Allowed values for choice type */
  choices?: ReadonlyArray<string>
  /** Default value when not provided (only for optional arguments) */
  default?: T
  /** Custom value transformation (takes precedence over type conversion) */
  coerce?: (rawValue: string) => T
}
