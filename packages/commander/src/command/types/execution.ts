import type { IReporter } from '@guanghechen/reporter'
import type { ICommand } from './command'
import type { ICommandPresetSourceMeta, ICommandPresetSourceState } from './token'

/** Execution context */
export interface ICommandContext {
  /** Current command node */
  cmd: ICommand
  /** Command chain from root to leaf */
  chain: ICommand[]
  /** Effective environment variables */
  envs: Record<string, string | undefined>
  /** Built-in control hit status */
  controls: ICommandControls
  /** Input source snapshots */
  sources: ICommandInputSources
  /** Reporter instance */
  reporter: IReporter
}

/** Action callback parameters */
export interface ICommandActionParams {
  /** Execution context */
  ctx: ICommandContext
  /** Effective built-in options for current leaf command */
  builtin: ICommandBuiltinParsedOptions
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

/** Input source snapshots for debugging/tracing */
export interface ICommandInputSources {
  preset: {
    state: ICommandPresetSourceState
    argv: string[]
    envs: Record<string, string>
    meta?: ICommandPresetSourceMeta
  }
  user: {
    /** Routed command tokens (name/alias as entered by user) */
    cmds: string[]
    /** Clean user tail argv after removing command chain/control/preset directives */
    argv: string[]
    /** Raw env snapshot from run/parse params */
    envs: Record<string, string | undefined>
  }
}

/** Built-in run controls */
export interface ICommandControls {
  help: boolean
  version: boolean
}

/** Built-in option resolution result (internal) */
export interface ICommandBuiltinOptionResolved {
  version: boolean
  color: boolean
  devmode: boolean
  logLevel: boolean
  silent: boolean
  logDate: boolean
  logColorful: boolean
}

/** Built-in config resolution result (internal) */
export interface ICommandBuiltinResolved {
  option: ICommandBuiltinOptionResolved
}

/** Effective built-in options exposed to action/parse result */
export interface ICommandBuiltinParsedOptions {
  devmode: boolean
  color?: boolean
  logLevel?: string
  silent?: boolean
  logDate?: boolean
  logColorful?: boolean
}
