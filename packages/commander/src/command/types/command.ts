import type { IReporter } from '@guanghechen/reporter'
import type { ICommandArgumentConfig } from './argument'
import type { ICommandOptionConfig } from './option'

export interface ICommandBuiltinOptionConfig {
  /** Enable built-in --version option (requires configured version on target command) */
  version?: boolean
  /** Enable built-in --color/--no-color option for help rendering (defaults respect NO_COLOR) */
  color?: boolean
  /** Enable built-in --devmode option */
  devmode?: boolean
  /** Enable built-in --log-level option */
  logLevel?: boolean
  /** Enable built-in --silent option */
  silent?: boolean
  /** Enable built-in --log-date/--no-log-date option */
  logDate?: boolean
  /** Enable built-in --log-colorful/--no-log-colorful option */
  logColorful?: boolean
}

export interface ICommandBuiltinConfig {
  /** Built-in options configuration */
  option?: boolean | ICommandBuiltinOptionConfig
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

/** Command preset defaults */
export interface ICommandPresetConfig {
  /** Default preset profile file */
  file?: string
  /** Default preset profile selector: <profile> or <profile>:<variant> */
  profile?: string
}

/** Allowed inline profile option value */
export type ICommandPresetProfileOptionValue =
  | boolean
  | string
  | number
  | ReadonlyArray<string | number>

/** Variant item nested under a preset profile */
export interface ICommandPresetProfileVariantItem {
  /** Optional env file path to parse (relative to preset file directory when non-absolute) */
  envFile?: string
  /** Inline env overrides */
  envs?: Record<string, string>
  /** Inline option overrides */
  opts?: Record<string, ICommandPresetProfileOptionValue>
}

/** Profile item in preset manifest */
export interface ICommandPresetProfileItem {
  /** Optional env file path to parse (relative to preset file directory when non-absolute) */
  envFile?: string
  /** Inline env overrides */
  envs?: Record<string, string>
  /** Inline option overrides */
  opts?: Record<string, ICommandPresetProfileOptionValue>
  /** Default selected variant name */
  defaultVariant?: string
  /** Optional variants keyed by variant name */
  variants?: Record<string, ICommandPresetProfileVariantItem>
}

/** Profile manifest defaults */
export interface ICommandPresetProfileDefaults {
  /** Default selected profile selector: <profile> or <profile>:<variant> */
  profile?: string
}

/** Profile manifest structure loaded from --preset-file */
export interface ICommandPresetProfileManifest {
  /** Schema version */
  version: 1
  /** Optional defaults */
  defaults?: ICommandPresetProfileDefaults
  /** Profiles keyed by profile name */
  profiles: Record<string, ICommandPresetProfileItem>
}

/** Runtime file stats abstraction */
export interface ICommandRuntimeStats {
  isDirectory(): boolean
}

/** Runtime abstraction for environment-dependent operations */
export interface ICommandRuntime {
  /** Current working directory */
  cwd(): string
  /** Path absolute check */
  isAbsolute(filepath: string): boolean
  /** Resolve paths into an absolute path */
  resolve(...paths: string[]): string
  /** Read UTF-8 text file */
  readFile(filepath: string): Promise<string>
  /** Stat file system entry */
  stat(filepath: string): Promise<ICommandRuntimeStats>
}

/** Command configuration */
export interface ICommandConfig {
  /** Command name (only for root command) */
  name?: string
  /** Command description */
  desc: string
  /** Version (for built-in --version on this command) */
  version?: string
  /** Built-in features configuration */
  builtin?: boolean | ICommandBuiltinConfig
  /** Command-level preset defaults */
  preset?: ICommandPresetConfig
  /** Default reporter for this command */
  reporter?: IReporter
  /** Runtime adapter for environment-dependent operations */
  runtime?: ICommandRuntime
}

/** Command interface */
export interface ICommand {
  readonly name: string | undefined
  readonly description: string
  readonly version: string | undefined
  readonly builtin: ICommandConfig['builtin'] | undefined
  readonly preset: ICommandPresetConfig | undefined
  readonly parent: ICommand | undefined
  readonly options: ICommandOptionConfig[]
  readonly arguments: ICommandArgumentConfig[]
  readonly examples: ICommandExample[]
  readonly subcommands: Map<string, ICommand>
}
