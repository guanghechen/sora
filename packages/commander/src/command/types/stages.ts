import type { ICommand } from './command'
import type {
  ICommandBuiltinParsedOptions,
  ICommandContext,
  ICommandControls,
  ICommandParsedArgs,
  ICommandParsedOpts,
} from './execution'
import type { ICommandArgvSegment, ICommandToken } from './token'

/** Route stage result */
export interface ICommandRouteResult<TCommand = ICommand> {
  /** Command chain from root to leaf */
  chain: TCommand[]
  /** Remaining argv after routing */
  remaining: string[]
  /** Routed command tokens from user argv (name/alias) */
  cmds: string[]
}

/** Control-scan stage result */
export interface ICommandControlScanResult {
  /** Built-in control hit status */
  controls: ICommandControls
  /** Remaining argv after stripping control tokens */
  remaining: string[]
  /** Optional target token from `help <child>` syntax */
  helpTarget?: string
}

/** Preset stage result */
export interface ICommandPresetResult {
  /** Effective tail argv after preset merge */
  tailArgv: string[]
  /** Effective envs after preset merge */
  envs: Record<string, string | undefined>
  /** Source-attributed argv segments consumed by tokenize */
  segments: ICommandArgvSegment[]
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

/** Subcommand registry entry (internal) */
export interface ISubcommandEntry<TCommand = ICommand> {
  name: string
  aliases: string[]
  command: TCommand
}

/** Help option line (internal) */
export interface IHelpOptionLine {
  sig: string
  desc: string
}

/** Help argument line (internal) */
export interface IHelpArgumentLine {
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
  arguments: IHelpArgumentLine[]
  options: IHelpOptionLine[]
  commands: IHelpCommandLine[]
  examples: IHelpExampleLine[]
}

/** Parse stage result */
export interface ICommandParseResult {
  /** Execution context */
  ctx: ICommandContext
  /** Effective built-in options for current leaf command */
  builtin: ICommandBuiltinParsedOptions
  /** Parsed options */
  opts: ICommandParsedOpts
  /** Parsed arguments */
  args: ICommandParsedArgs
  /** Raw argument strings */
  rawArgs: string[]
}
