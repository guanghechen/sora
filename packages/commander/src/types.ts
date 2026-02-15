/**
 * Type definitions for @guanghechen/commander
 *
 * @module @guanghechen/commander
 */

import type { IReporter } from '@guanghechen/reporter'

// ==================== Token Types ====================

/** Token type: long option, short option, or positional */
export type ICommandTokenType = 'long' | 'short' | 'none'

/**
 * Command token after preprocessing.
 *
 * - original: raw input for error messages (e.g., --LOG-LEVEL=info, -v)
 * - resolved: normalized form (e.g., --logLevel=info, -v)
 * - name: option name for matching (e.g., logLevel, v, '')
 * - type: token type (long/short/none)
 */
export interface ICommandToken {
  /** Raw input, used for error display */
  original: string
  /** Normalized form, used for parsing */
  resolved: string
  /** Option name for matching: camelCase for long, single char for short, '' for positional */
  name: string
  /** Token type */
  type: ICommandTokenType
}

// ==================== Option Types ====================

/** Option value type */
export type ICommandOptionType = 'boolean' | 'number' | 'string'

/** Option argument mode */
export type ICommandOptionArgs = 'none' | 'required' | 'variadic'

/**
 * Option configuration.
 *
 * `type` and `args` must be specified together. Valid combinations:
 * - boolean + none → boolean
 * - string + required → string
 * - number + required → number
 * - string + variadic → string[]
 * - number + variadic → number[]
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

// ==================== Argument Types ====================

/** Argument kind */
export type ICommandArgumentKind = 'required' | 'optional' | 'variadic'

/** Argument value type */
export type ICommandArgumentType = 'string' | 'number'

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
  /** Value type, defaults to 'string' */
  type?: ICommandArgumentType
  /** Default value when not provided (only for optional arguments) */
  default?: T
  /** Custom value transformation (takes precedence over type conversion) */
  coerce?: (rawValue: string) => T
}

// ==================== Command Types ====================

export interface ICommandBuiltinOptionConfig {
  /** Enable built-in --color/--no-color option for help rendering (defaults respect NO_COLOR) */
  color?: boolean
  /** Enable built-in --log-level option */
  logLevel?: boolean
  /** Enable built-in --silent option */
  silent?: boolean
  /** Enable built-in --log-date/--no-log-date option */
  logDate?: boolean
  /** Enable built-in --log-colorful/--no-log-colorful option */
  logColorful?: boolean
}

export interface ICommandBuiltinCommandConfig {
  /** Enable built-in help subcommand */
  help?: boolean
}

export interface ICommandBuiltinConfig {
  /** Built-in options configuration */
  option?: boolean | ICommandBuiltinOptionConfig
  /** Built-in command configuration */
  command?: boolean | ICommandBuiltinCommandConfig
}

/** Command example configuration */
export interface ICommandExample {
  /** Example title */
  title: string
  /** Usage fragment relative to command path */
  usage: string
  /** Example description */
  desc: string
}

/** Command configuration */
export interface ICommandConfig {
  /** Command name (only for root command) */
  name?: string
  /** Command description */
  desc: string
  /** Version (for root --version) */
  version?: string
  /** Built-in features configuration */
  builtin?: boolean | ICommandBuiltinConfig
  /** Default reporter for this command */
  reporter?: IReporter
}

/** Command interface */
export interface ICommand {
  readonly name: string | undefined
  readonly description: string
  readonly version: string | undefined
  readonly parent: ICommand | undefined
  readonly options: ICommandOptionConfig[]
  readonly arguments: ICommandArgumentConfig[]
  readonly examples: ICommandExample[]
  readonly subcommands: Map<string, ICommand>
}

/** Execution context */
export interface ICommandContext {
  /** Current command node */
  cmd: ICommand
  /** Environment variables */
  envs: Record<string, string | undefined>
  /** Reporter instance */
  reporter: IReporter
  /** Original argv */
  argv: string[]
}

/** Action callback parameters */
export interface ICommandActionParams {
  /** Execution context */
  ctx: ICommandContext
  /** Parsed options (keyed by long name) */
  opts: ICommandParsedOpts
  /** Parsed positional arguments (keyed by argument name) */
  args: ICommandParsedArgs
  /** Raw positional argument strings (before type conversion) */
  rawArgs: string[]
}

/** Action handler function */
export type ICommandAction = (params: ICommandActionParams) => void | Promise<void>

/** run() / parse() method parameters */
export interface ICommandRunParams {
  /** Command line arguments (usually process.argv.slice(2)) */
  argv: string[]
  /** Environment variables (usually process.env) */
  envs: Record<string, string | undefined>
  /** Optional reporter override */
  reporter?: IReporter
}

/** Parsed options record */
export type ICommandParsedOpts = Record<string, unknown>

/** Parsed arguments record */
export type ICommandParsedArgs = Record<string, unknown>

// ==================== Stage Result Types (internal) ====================

/** Route stage result */
export interface ICommandRouteResult {
  /** Command chain from root to leaf */
  chain: ICommand[]
  /** Remaining argv after routing */
  remaining: string[]
}

/** Tokenize stage result */
export interface ICommandTokenizeResult {
  /** Option tokens (before --) */
  optionTokens: ICommandToken[]
  /** Arguments after -- */
  restArgs: string[]
}

/** Resolve stage result */
export interface ICommandResolveResult {
  /** Tokens consumed by each command */
  consumedTokens: Map<ICommand, ICommandToken[]>
  /** Argument tokens (non-option tokens) */
  argTokens: ICommandToken[]
}

/** shift() method result (internal) */
export interface ICommandShiftResult {
  /** Tokens consumed by this command */
  consumed: ICommandToken[]
  /** Remaining tokens to pass to parent */
  remaining: ICommandToken[]
}

/** Parse stage result */
export interface ICommandParseResult {
  /** Execution context */
  ctx: ICommandContext
  /** Parsed options */
  opts: ICommandParsedOpts
  /** Parsed arguments */
  args: ICommandParsedArgs
  /** Raw argument strings */
  rawArgs: string[]
}

/** Built-in option resolution result (internal) */
export interface ICommandBuiltinOptionResolved {
  color: boolean
  logLevel: boolean
  silent: boolean
  logDate: boolean
  logColorful: boolean
}

/** Built-in config resolution result (internal) */
export interface ICommandBuiltinResolved {
  option: ICommandBuiltinOptionResolved
  command: {
    help: boolean
  }
}

/** Subcommand registry entry (internal) */
export interface ISubcommandEntry<TCommand = ICommand> {
  name: string
  aliases: string[]
  command: TCommand
}

/** Internal route result */
export interface IInternalRouteResult<TCommand = ICommand> {
  chain: TCommand[]
  remaining: string[]
}

/** Help option line (internal) */
export interface IHelpOptionLine {
  sig: string
  desc: string
}

/** Help command line (internal) */
export interface IHelpCommandLine {
  name: string
  desc: string
}

/** Help example line (internal) */
export interface IHelpExampleLine {
  title: string
  usage: string
  desc: string
}

/** Structured help data for rendering (internal) */
export interface IHelpData {
  desc: string
  usage: string
  options: IHelpOptionLine[]
  commands: IHelpCommandLine[]
  examples: IHelpExampleLine[]
}

// ==================== Error Types ====================

/** Error kinds for command parsing */
export type ICommanderErrorKind =
  | 'InvalidOptionFormat'
  | 'InvalidNegativeOption'
  | 'NegativeOptionWithValue'
  | 'NegativeOptionType'
  | 'UnknownOption'
  | 'UnknownSubcommand'
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
export type ICompletionShellType = 'bash' | 'fish' | 'pwsh'

/** Option metadata for completion */
export interface ICompletionOptionMeta {
  /** Long option name (camelCase) */
  long: string
  /** Short option */
  short?: string
  /** Description */
  desc: string
  /** Whether option takes value (args !== 'none') */
  takesValue: boolean
  /** Allowed values */
  choices?: string[]
}

/** Command metadata for completion */
export interface ICompletionMeta {
  /** Command name */
  name: string
  /** Description */
  desc: string
  /** Command aliases */
  aliases: string[]
  /** Options */
  options: ICompletionOptionMeta[]
  /** Subcommands */
  subcommands: ICompletionMeta[]
}

/** Shell completion paths configuration */
export interface ICompletionPaths {
  /** Bash completion file path */
  bash: string
  /** Fish completion file path */
  fish: string
  /** PowerShell completion file path */
  pwsh: string
}

/** CompletionCommand configuration */
export interface ICompletionCommandConfig {
  /** Program name for completion scripts (defaults to root.name) */
  programName?: string
  /** Default completion file paths for each shell */
  paths: ICompletionPaths
}
