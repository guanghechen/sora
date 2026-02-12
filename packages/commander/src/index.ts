/**
 * A minimal, type-safe command-line interface builder with fluent API
 *
 * @module @guanghechen/commander
 */

export { Command } from './command'
export { BashCompletion, CompletionCommand, FishCompletion, PwshCompletion } from './completion'
export type {
  IAction,
  IActionParams,
  IArgument,
  IArgumentKind,
  ICommand,
  ICommandConfig,
  ICommandContext,
  ICommanderErrorKind,
  ICommandToken,
  ICompletionCommandConfig,
  ICompletionMeta,
  ICompletionOptionMeta,
  ICompletionPaths,
  IOption,
  IOptionType,
  IParseResult,
  IReporter,
  IRunParams,
  IShellType,
  IShiftResult,
} from './types'
export { CommanderError } from './types'
