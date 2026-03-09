import type { ICommandPresetIssueMeta, ICommandTokenSource } from './token'

export type ICommandStage =
  | 'route'
  | 'control-scan'
  | 'control-run'
  | 'preset'
  | 'tokenize'
  | 'builtin-resolve'
  | 'resolve'
  | 'parse'
  | 'run'

export type ICommandIssueKind = 'error' | 'hint'

export interface ICommandIssueSourceAttribution {
  primary?: ICommandTokenSource
  related?: ICommandTokenSource[]
}

export type ICommandIssueScope =
  | 'control'
  | 'preset'
  | 'option'
  | 'argument'
  | 'command'
  | 'runtime'
  | 'action'

export type ICommandErrorIssueCode =
  | 'invalid_option_format'
  | 'invalid_negative_option'
  | 'negative_option_with_value'
  | 'negative_option_type'
  | 'unknown_option'
  | 'unknown_subcommand'
  | 'unexpected_argument'
  | 'missing_value'
  | 'invalid_type'
  | 'unsupported_short_syntax'
  | 'option_conflict'
  | 'missing_required'
  | 'invalid_choice'
  | 'invalid_boolean_value'
  | 'missing_required_argument'
  | 'too_many_arguments'
  | 'configuration_error'
  | 'action_failed'

export type ICommandHintIssueCode =
  | 'preset_token_injected'
  | 'mixed_source_conflict'
  | 'did_you_mean_subcommand'
  | 'command_does_not_accept_positional_arguments'

export type ICommandIssueCode = ICommandErrorIssueCode | ICommandHintIssueCode

export interface ICommandIssueReason {
  code: ICommandIssueCode
  message: string
  details?: Record<string, unknown>
}

export interface ICommandIssueBase {
  kind: ICommandIssueKind
  stage: ICommandStage
  originStage?: ICommandStage
  source?: ICommandIssueSourceAttribution
  scope: ICommandIssueScope
  preset?: ICommandPresetIssueMeta
}

export interface ICommandErrorIssue extends ICommandIssueBase {
  kind: 'error'
  reason: Omit<ICommandIssueReason, 'code'> & { code: ICommandErrorIssueCode }
}

export interface ICommandHintIssue extends ICommandIssueBase {
  kind: 'hint'
  reason: Omit<ICommandIssueReason, 'code'> & { code: ICommandHintIssueCode }
}

export type ICommandIssue = ICommandErrorIssue | ICommandHintIssue

export interface ICommandErrorMeta {
  commandPath: string
  token?: string
  option?: string
  argument?: string
  issues: ICommandIssue[]
}

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
  | 'ActionFailed'

/** Commander error with structured information */
export class CommanderError extends Error {
  public readonly kind: ICommanderErrorKind
  public readonly commandPath: string
  public readonly meta: ICommandErrorMeta | undefined

  constructor(
    kind: ICommanderErrorKind,
    message: string,
    commandPath: string,
    meta?: ICommandErrorMeta,
  ) {
    super(message)
    this.name = 'CommanderError'
    this.kind = kind
    this.commandPath = commandPath
    this.meta = meta
  }

  public withIssue(issue: ICommandIssue): CommanderError {
    return this.withIssues([issue])
  }

  public withIssues(issues: ICommandIssue[]): CommanderError {
    if (issues.length === 0) {
      return this
    }

    const nextMeta: ICommandErrorMeta = {
      commandPath: this.meta?.commandPath ?? this.commandPath,
      token: this.meta?.token,
      option: this.meta?.option,
      argument: this.meta?.argument,
      issues: [...(this.meta?.issues ?? []), ...issues],
    }

    return new CommanderError(this.kind, this.message, this.commandPath, nextMeta)
  }

  /** Format error with help hint */
  public format(): string {
    const issues = this.meta?.issues ?? []
    if (issues.length > 0) {
      const primary = issues.find(issue => issue.kind === 'error') ?? issues[0]
      const lines = [`Error: ${primary.reason.message}`]
      for (const issue of issues) {
        if (issue.kind !== 'hint') continue
        const message = issue.reason.message.startsWith('Hint:')
          ? issue.reason.message
          : `Hint: ${issue.reason.message}`
        lines.push(message)
      }
      lines.push(`Run "${this.commandPath} --help" for usage.`)
      return lines.join('\n')
    }

    return `Error: ${this.message}\nRun "${this.commandPath} --help" for usage.`
  }
}
