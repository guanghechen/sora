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

// ==================== Token Types ====================

/**
 * Command token after preprocessing.
 * original: preserves raw input for error messages (e.g., --LOG-LEVEL)
 * resolved: normalized form for matching (e.g., --logLevel)
 */
export interface ICommandToken {
  /** Raw input, used for error display */
  original: string
  /** Normalized form, used for parsing/matching */
  resolved: string
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
  resolver?: (tokens: ICommandToken[]) => { value: T; remaining: ICommandToken[] }
  /** Callback after parsing, applies value to context */
  apply?: (value: T, ctx: ICommandContext) => void
}

// ==================== Argument Types ====================

/** Argument kind */
export type IArgumentKind = 'required' | 'optional' | 'variadic'

/** Argument value type */
export type IArgumentType = 'string' | 'number'

/**
 * Positional argument definition.
 * @template T - The type of the argument value
 */
export interface IArgument<T = unknown> {
  /** Argument name */
  name: string
  /** Argument description */
  description: string
  /** Argument kind: required / optional / variadic */
  kind: IArgumentKind
  /** Value type, defaults to 'string' */
  type?: IArgumentType
  /** Default value when not provided (only effective for optional arguments) */
  default?: T
  /** Custom value transformation (takes precedence over type conversion) */
  coerce?: (rawValue: string) => T
}

// ==================== Command Types ====================

/** Command configuration */
export interface ICommandConfig {
  /** Command name (only effective for root command) */
  name?: string
  /** Command description */
  description: string
  /** Version (only effective for built-in root --version) */
  version?: string
  /** Enable built-in "help" subcommand (only effective when command has subcommands) */
  help?: boolean
  /** Default reporter for this command (can be overridden by run params) */
  reporter?: IReporter
}

/** Forward declaration for Command class */
export interface ICommand {
  readonly name: string
  readonly description: string
  readonly version: string | undefined
  readonly parent?: ICommand
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

/** Subcommand registration entry (internal) */
export interface ISubcommandEntry {
  name: string
  aliases: string[]
  command: ICommand
}

/** Action parameters */
export interface IActionParams {
  /** Execution context */
  ctx: ICommandContext
  /** Parsed options */
  opts: Record<string, unknown>
  /** Parsed positional arguments (keyed by argument name) */
  args: Record<string, unknown>
  /** Raw positional argument strings (before type conversion) */
  rawArgs: string[]
}

/** Action handler function */
export type IAction = (params: IActionParams) => void | Promise<void>

/** run() method parameters */
export interface IRunParams {
  /** Command line arguments (usually process.argv.slice(2)) */
  argv: string[]
  /** Environment variables (usually process.env) */
  envs: Record<string, string | undefined>
  /** Optional reporter override (defaults to command's reporter or console reporter) */
  reporter?: IReporter
}

/** parse() method result */
export interface IParseResult {
  /** Parsed options */
  opts: Record<string, unknown>
  /** Parsed positional arguments (keyed by argument name) */
  args: Record<string, unknown>
  /** Raw positional argument strings (before type conversion) */
  rawArgs: string[]
}

/** shift() method result */
export interface IShiftResult {
  /** Options consumed by this command */
  opts: Record<string, unknown>
  /** Tokens not consumed, to be passed to parent */
  remaining: ICommandToken[]
}

// ==================== Error Types ====================

/** Error kinds for command parsing */
export type ICommanderErrorKind =
  | 'InvalidOptionFormat'
  | 'InvalidNegativeOption'
  | 'NegativeOptionWithValue'
  | 'NegativeOptionType'
  | 'UnknownOption'
  | 'UnexpectedArgument'
  | 'MissingValue'
  | 'InvalidType'
  | 'UnsupportedShortSyntax'
  | 'OptionConflict'
  | 'MissingRequired'
  | 'InvalidChoice'
  | 'InvalidBooleanValue'
  | 'MissingRequiredArgument'
  | 'TooManyArguments'
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

/** Shell completion paths configuration */
export interface ICompletionPaths {
  /** Bash completion file path (e.g., ~/.local/share/bash-completion/completions/{name}) */
  bash: string
  /** Fish completion file path (e.g., ~/.config/fish/completions/{name}.fish) */
  fish: string
  /** PowerShell completion file path (only ~ expansion supported, not $PROFILE) */
  pwsh: string
}

/** CompletionCommand configuration */
export interface ICompletionCommandConfig {
  /** Program name for completion scripts (defaults to root.name) */
  programName?: string
  /** Default completion file paths for each shell (required for --write support) */
  paths: ICompletionPaths
}
