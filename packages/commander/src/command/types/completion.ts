import type { ICommandArgumentKind, ICommandArgumentType } from './argument'
import type { ICommandOptionArgs, ICommandOptionType } from './option'

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
  /** Option type */
  type: ICommandOptionType
  /** Option args mode */
  args: ICommandOptionArgs
  /** Allowed values */
  choices?: string[]
}

/** Argument metadata for completion */
export interface ICompletionArgumentMeta {
  /** Argument name */
  name: string
  /** Argument kind */
  kind: ICommandArgumentKind
  /** Argument type */
  type: ICommandArgumentType
  /** Allowed values (only for type='choice') */
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
  /** Positional arguments */
  arguments: ICompletionArgumentMeta[]
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
  paths?: Partial<ICompletionPaths>
}
