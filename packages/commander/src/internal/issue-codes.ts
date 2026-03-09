import type {
  ICommandErrorIssueCode,
  ICommandHintIssueCode,
  ICommandIssueCode,
} from '../command/types'

export const COMMAND_ERROR_ISSUE_CODES: ReadonlyArray<ICommandErrorIssueCode> = [
  'invalid_option_format',
  'invalid_negative_option',
  'negative_option_with_value',
  'negative_option_type',
  'unknown_option',
  'unknown_subcommand',
  'unexpected_argument',
  'missing_value',
  'invalid_type',
  'unsupported_short_syntax',
  'option_conflict',
  'missing_required',
  'invalid_choice',
  'invalid_boolean_value',
  'missing_required_argument',
  'too_many_arguments',
  'configuration_error',
  'action_failed',
]

export const COMMAND_HINT_ISSUE_CODES: ReadonlyArray<ICommandHintIssueCode> = [
  'preset_token_injected',
  'mixed_source_conflict',
  'did_you_mean_subcommand',
  'command_does_not_accept_positional_arguments',
]

const ERROR_ISSUE_CODE_SET = new Set<ICommandErrorIssueCode>(COMMAND_ERROR_ISSUE_CODES)
const HINT_ISSUE_CODE_SET = new Set<ICommandHintIssueCode>(COMMAND_HINT_ISSUE_CODES)

export function isErrorIssueCode(code: ICommandIssueCode): code is ICommandErrorIssueCode {
  return ERROR_ISSUE_CODE_SET.has(code as ICommandErrorIssueCode)
}

export function isHintIssueCode(code: ICommandIssueCode): code is ICommandHintIssueCode {
  return HINT_ISSUE_CODE_SET.has(code as ICommandHintIssueCode)
}
