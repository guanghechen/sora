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
  ICompletionCommandConfig,
  ICompletionMeta,
  ICompletionOptionMeta,
  IOption,
  IOptionType,
  IParseResult,
  IReporter,
  IRunParams,
  IShellType,
} from './types'
export { CommanderError } from './types'
