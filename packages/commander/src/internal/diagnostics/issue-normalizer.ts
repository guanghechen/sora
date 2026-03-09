import { CommanderError } from '../../types'
import type {
  ICommandErrorIssue,
  ICommandErrorIssueCode,
  ICommandErrorMeta,
  ICommandHintIssue,
  ICommandIssueCode,
  ICommandIssueScope,
  ICommandPresetIssueMeta,
} from '../../types'
import { isErrorIssueCode, isHintIssueCode } from '../issue-codes'
import type { INormalizeCommanderErrorOptions, IWithErrorIssueParams } from './contracts'

function errorKindToIssueCode(kind: CommanderError['kind']): ICommandErrorIssueCode {
  switch (kind) {
    case 'InvalidOptionFormat':
      return 'invalid_option_format'
    case 'InvalidNegativeOption':
      return 'invalid_negative_option'
    case 'NegativeOptionWithValue':
      return 'negative_option_with_value'
    case 'NegativeOptionType':
      return 'negative_option_type'
    case 'UnknownOption':
      return 'unknown_option'
    case 'UnknownSubcommand':
      return 'unknown_subcommand'
    case 'UnexpectedArgument':
      return 'unexpected_argument'
    case 'MissingValue':
      return 'missing_value'
    case 'InvalidType':
      return 'invalid_type'
    case 'UnsupportedShortSyntax':
      return 'unsupported_short_syntax'
    case 'OptionConflict':
      return 'option_conflict'
    case 'MissingRequired':
      return 'missing_required'
    case 'InvalidChoice':
      return 'invalid_choice'
    case 'InvalidBooleanValue':
      return 'invalid_boolean_value'
    case 'MissingRequiredArgument':
      return 'missing_required_argument'
    case 'TooManyArguments':
      return 'too_many_arguments'
    case 'ActionFailed':
      return 'action_failed'
    case 'ConfigurationError':
      return 'configuration_error'
    default:
      return 'configuration_error'
  }
}

export class CommandIssueNormalizer {
  public withErrorIssue(error: CommanderError, params: IWithErrorIssueParams): CommanderError {
    if (error.meta?.issues.some(existing => existing.kind === 'error')) {
      return error
    }

    return error.withIssue(this.#buildErrorIssue(error, params))
  }

  public normalizeCommanderError(
    error: CommanderError,
    options: INormalizeCommanderErrorOptions,
  ): CommanderError {
    const issues = error.meta?.issues ?? []
    const normalizedIssues = this.#normalizeIssues(issues, {
      error,
      fallbackStage: options.fallbackStage,
      fallbackScope: options.fallbackScope,
    })

    const nextMeta: ICommandErrorMeta = {
      commandPath: error.meta?.commandPath ?? error.commandPath,
      token: error.meta?.token,
      option: error.meta?.option,
      argument: error.meta?.argument,
      issues: normalizedIssues,
    }

    return new CommanderError(error.kind, error.message, error.commandPath, nextMeta)
  }

  #buildErrorIssue(error: CommanderError, params: IWithErrorIssueParams): ICommandErrorIssue {
    const { stage, scope, token, source, preset, originStage, details } = params
    const tokenSource: ICommandErrorIssue['source'] =
      token === undefined
        ? undefined
        : {
            primary: token.source,
          }
    const defaultSource: ICommandErrorIssue['source'] =
      error.kind === 'MissingRequiredArgument' || error.kind === 'UnknownSubcommand'
        ? { primary: 'user' as const }
        : undefined
    const issueSource = source ?? tokenSource ?? defaultSource
    const issuePreset = preset ?? token?.preset
    const presetSource =
      issueSource?.primary === 'preset' || issueSource?.related?.includes('preset')
    const resolvedOriginStage =
      originStage ?? (presetSource && stage !== 'preset' ? 'preset' : undefined)

    return {
      kind: 'error',
      stage,
      originStage: resolvedOriginStage,
      source: issueSource,
      scope,
      reason: {
        code: errorKindToIssueCode(error.kind),
        message: error.message,
        details,
      },
      preset: issuePreset,
    }
  }

  #normalizeIssues(
    issues: Array<ICommandErrorIssue | ICommandHintIssue>,
    options: {
      error: CommanderError
      fallbackStage: IWithErrorIssueParams['stage']
      fallbackScope: ICommandIssueScope
    },
  ): ICommandErrorMeta['issues'] {
    const normalized = issues
      .map(issue => this.#normalizeIssue(issue))
      .filter((issue): issue is ICommandErrorIssue | ICommandHintIssue => issue !== undefined)
    const primaryError = normalized.find(issue => issue.kind === 'error') as
      | ICommandErrorIssue
      | undefined
    const hints = normalized.filter(issue => issue.kind === 'hint')

    if (primaryError === undefined) {
      const fallbackError = this.#buildErrorIssue(options.error, {
        stage: options.fallbackStage,
        scope: options.fallbackScope,
      })
      return [fallbackError, ...hints]
    }

    return [primaryError, ...hints]
  }

  #normalizeIssue(
    issue: ICommandErrorIssue | ICommandHintIssue,
  ): ICommandErrorIssue | ICommandHintIssue | undefined {
    let source = this.#normalizeIssueSource(issue.source)
    let preset = this.#normalizePresetIssueMeta(issue.preset)
    const reasonCode = issue.reason.code as ICommandIssueCode

    if (!this.#hasPresetSource(source)) {
      preset = undefined
    }

    if (source?.primary === 'preset' && !this.#hasPresetLocator(preset)) {
      source = this.#dropPresetPrimarySource(source)
      if (!this.#hasPresetSource(source)) {
        preset = undefined
      }
    }

    if (issue.kind === 'error') {
      const normalizedCode: ICommandErrorIssueCode = isErrorIssueCode(reasonCode)
        ? reasonCode
        : 'configuration_error'
      const normalizedReason =
        normalizedCode === reasonCode
          ? issue.reason
          : {
              code: normalizedCode,
              message: `invalid error issue code "${reasonCode}"`,
              details: {
                ...(issue.reason.details ?? {}),
                invalidIssueCode: reasonCode,
              },
            }

      return {
        ...issue,
        source,
        preset,
        reason: normalizedReason,
      }
    }

    if (!isHintIssueCode(reasonCode)) {
      return undefined
    }

    return {
      ...issue,
      source,
      preset,
    }
  }

  #normalizeIssueSource(
    source: ICommandErrorIssue['source'] | undefined,
  ): ICommandErrorIssue['source'] | undefined {
    if (source === undefined) {
      return undefined
    }

    const related = source.related === undefined ? undefined : Array.from(new Set(source.related))
    const primary = source.primary

    if (primary !== undefined && related !== undefined && !related.includes(primary)) {
      related.push(primary)
    }

    if (primary === undefined && (related === undefined || related.length === 0)) {
      return undefined
    }

    return {
      primary,
      related,
    }
  }

  #dropPresetPrimarySource(
    source: NonNullable<ICommandErrorIssue['source']>,
  ): ICommandErrorIssue['source'] | undefined {
    const related = source.related?.filter(item => item !== 'preset')
    if (related === undefined || related.length === 0) {
      return undefined
    }

    return {
      related,
    }
  }

  #normalizePresetIssueMeta(
    preset: ICommandPresetIssueMeta | undefined,
  ): ICommandPresetIssueMeta | undefined {
    if (preset === undefined) {
      return undefined
    }

    const nextPreset: ICommandPresetIssueMeta = {
      file: preset.file,
      profile: preset.profile,
      variant: preset.variant,
      optionKey: preset.optionKey,
    }

    const hasAnyValue =
      nextPreset.file !== undefined ||
      nextPreset.profile !== undefined ||
      nextPreset.variant !== undefined ||
      nextPreset.optionKey !== undefined

    return hasAnyValue ? nextPreset : undefined
  }

  #hasPresetLocator(preset: ICommandPresetIssueMeta | undefined): boolean {
    return (
      preset?.file !== undefined || preset?.profile !== undefined || preset?.variant !== undefined
    )
  }

  #hasPresetSource(source: ICommandErrorIssue['source'] | undefined): boolean {
    return source?.primary === 'preset' || source?.related?.includes('preset') === true
  }
}
