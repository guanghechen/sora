/**
 * A minimal, type-safe command-line interface builder with fluent API
 *
 * @module @guanghechen/commander
 */

export { Command } from './command'
export { BashCompletion, CompletionCommand, FishCompletion, PwshCompletion } from './completion'
export { logLevelOption, silentOption } from './options'
export type {
  ICommand,
  ICommandAction,
  ICommandActionParams,
  ICommandArgumentConfig,
  ICommandArgumentKind,
  ICommandArgumentType,
  ICommandConfig,
  ICommandContext,
  ICommandOptionArgs,
  ICommandOptionConfig,
  ICommandOptionType,
  ICommandParsedArgs,
  ICommandParsedOpts,
  ICommandParseResult,
  ICommandResolveResult,
  ICommandRouteResult,
  ICommandRunParams,
  ICommandShiftResult,
  ICommandToken,
  ICommandTokenizeResult,
  ICommandTokenType,
  ICommanderErrorKind,
  ICompletionCommandConfig,
  ICompletionMeta,
  ICompletionOptionMeta,
  ICompletionPaths,
  ICompletionShellType,
} from './types'
export { CommanderError } from './types'
