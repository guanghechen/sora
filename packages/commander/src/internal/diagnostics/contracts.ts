import type {
  CommanderError,
  ICommandArgvSegment,
  ICommandErrorIssue,
  ICommandIssueScope,
  ICommandPresetIssueMeta,
  ICommandStage,
  ICommandToken,
} from '../../types'

export interface IWithErrorIssueParams {
  stage: ICommandErrorIssue['stage']
  scope: ICommandIssueScope
  token?: ICommandToken
  source?: ICommandErrorIssue['source']
  preset?: ICommandPresetIssueMeta
  originStage?: ICommandErrorIssue['originStage']
  details?: Record<string, unknown>
}

export interface INormalizeCommanderErrorOptions {
  fallbackStage: ICommandStage
  fallbackScope: ICommandIssueScope
}

export interface ICommandDiagnosticsEngine {
  withErrorIssue(error: CommanderError, params: IWithErrorIssueParams): CommanderError
  withPresetInjectedHint(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
  ): CommanderError
  normalizeCommanderError(
    error: CommanderError,
    options: INormalizeCommanderErrorOptions,
  ): CommanderError
  resolveOptionConflictSourceAttribution(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
  ): ICommandErrorIssue['source'] | undefined
  resolveOptionConflictPresetAttribution(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
    source: ICommandErrorIssue['source'],
  ): ICommandPresetIssueMeta | undefined
}
