/**
 * Type definitions for @guanghechen/commander
 *
 * @module @guanghechen/commander
 */

// ==================== Reporter Interface ====================

/**
 * Reporter interface for logging.
 * Users should provide their own implementation.
 */
export interface IReporter {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

// ==================== Option Types ====================

/** Supported option value types */
export type IOptionType = 'boolean' | 'string' | 'number' | 'string[]' | 'number[]'

/**
 * Option definition.
 * @template T - The type of the option value
 */
export interface IOption<T = unknown> {
  /** Long option (e.g., 'verbose' for --verbose), also used as merge key */
  long: string
  /** Short option (single character, e.g., 'v' for -v) */
  short?: string
  /** Value type, defaults to 'string' */
  type?: IOptionType
  /** Description for help text */
  description: string
  /** Whether this option is required (cannot be used with default or boolean type) */
  required?: boolean
  /** Default value when not provided */
  default?: T
  /** Allowed values for validation and completion */
  choices?: T extends Array<infer U> ? U[] : T[]
  /** Single value transformation (ignored when resolver is present) */
  coerce?: (rawValue: string) => T extends Array<infer U> ? U : T
  /** Custom resolver that fully replaces builtin parsing (ignores type/coerce) */
  resolver?: (argv: string[]) => { value: T; remaining: string[] }
  /** Callback after parsing, applies value to context */
  apply?: (value: T, ctx: ICommandContext) => void
}

// ==================== Argument Types ====================

/** Argument kind */
export type IArgumentKind = 'required' | 'optional' | 'variadic'

/** Positional argument definition */
export interface IArgument {
  /** Argument name */
  name: string
  /** Argument description */
  description: string
  /** Argument kind: required / optional / variadic */
  kind: IArgumentKind
}

// ==================== Command Types ====================

/** Command configuration */
export interface ICommandConfig {
  /** Command name (used for routing) */
  name: string
  /** Command aliases */
  aliases?: string[]
  /** Command description */
  description: string
  /** Version (only effective for root command) */
  version?: string
}

/** Forward declaration for Command class */
export interface ICommand {
  readonly name: string
  readonly aliases: string[]
  readonly description: string
  readonly version: string | undefined
  readonly parent: ICommand | undefined
  readonly options: IOption[]
  readonly arguments: IArgument[]
}

/** Execution context */
export interface ICommandContext {
  /** Current command node */
  cmd: ICommand
  /** Environment variables passed in */
  envs: Record<string, string | undefined>
  /** Reporter instance */
  reporter: IReporter
  /** Original argv */
  argv: string[]
}

/** Action parameters */
export interface IActionParams {
  /** Execution context */
  ctx: ICommandContext
  /** Parsed options */
  opts: Record<string, unknown>
  /** Parsed positional arguments */
  args: string[]
}

/** Action handler function */
export type IAction = (params: IActionParams) => void | Promise<void>

/** run() method parameters */
export interface IRunParams {
  /** Command line arguments (usually process.argv.slice(2)) */
  argv: string[]
  /** Environment variables (usually process.env) */
  envs: Record<string, string | undefined>
  /** Optional reporter for logging (defaults to console reporter) */
  reporter?: IReporter
}

/** parse() method result */
export interface IParseResult {
  /** Parsed options */
  opts: Record<string, unknown>
  /** Parsed positional arguments */
  args: string[]
}

// ==================== Error Types ====================

/** Error kinds for command parsing */
export type ICommanderErrorKind =
  | 'UnknownOption'
  | 'MissingValue'
  | 'InvalidType'
  | 'UnsupportedShortSyntax'
  | 'OptionConflict'
  | 'MissingRequired'
  | 'InvalidChoice'
  | 'InvalidBooleanValue'
  | 'MissingRequiredArgument'
  | 'ConfigurationError'

/** Commander error with structured information */
export class CommanderError extends Error {
  public readonly kind: ICommanderErrorKind
  public readonly commandPath: string

  constructor(kind: ICommanderErrorKind, message: string, commandPath: string) {
    super(message)
    this.name = 'CommanderError'
    this.kind = kind
    this.commandPath = commandPath
  }

  /** Format error with help hint */
  public format(): string {
    return `Error: ${this.message}\nRun "${this.commandPath} --help" for usage.`
  }
}

// ==================== Completion Types ====================

/** Shell type for completion */
export type IShellType = 'bash' | 'fish' | 'pwsh'

/** Option metadata for completion */
export interface ICompletionOptionMeta {
  long: string
  short?: string
  description: string
  takesValue: boolean
  choices?: string[]
}

/** Command metadata for completion */
export interface ICompletionMeta {
  name: string
  description: string
  aliases: string[]
  options: ICompletionOptionMeta[]
  subcommands: ICompletionMeta[]
}

/** CompletionCommand configuration */
export interface ICompletionCommandConfig {
  /** Subcommand name, defaults to 'completion' */
  name?: string
}
