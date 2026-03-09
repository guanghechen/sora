import type {
  CommanderError,
  ICommandArgvSegment,
  ICommandErrorIssue,
  ICommandPresetIssueMeta,
} from '../types'
import type {
  ICommandDiagnosticsEngine,
  INormalizeCommanderErrorOptions,
  IWithErrorIssueParams,
} from './diagnostics/contracts'
import { CommandHintAttributor } from './diagnostics/hint-attributor'
import { CommandIssueNormalizer } from './diagnostics/issue-normalizer'

export type {
  ICommandDiagnosticsEngine,
  INormalizeCommanderErrorOptions,
  IWithErrorIssueParams,
} from './diagnostics/contracts'

export class CommandDiagnosticsEngine implements ICommandDiagnosticsEngine {
  readonly #issueNormalizer = new CommandIssueNormalizer()
  readonly #hintAttributor = new CommandHintAttributor()

  public withErrorIssue(error: CommanderError, params: IWithErrorIssueParams): CommanderError {
    return this.#issueNormalizer.withErrorIssue(error, params)
  }

  public withPresetInjectedHint(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
  ): CommanderError {
    return this.#hintAttributor.withPresetInjectedHint(error, sourceSegments)
  }

  public normalizeCommanderError(
    error: CommanderError,
    options: INormalizeCommanderErrorOptions,
  ): CommanderError {
    return this.#issueNormalizer.normalizeCommanderError(error, options)
  }

  public resolveOptionConflictSourceAttribution(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
  ): ICommandErrorIssue['source'] | undefined {
    return this.#hintAttributor.resolveOptionConflictSourceAttribution(error, sourceSegments)
  }

  public resolveOptionConflictPresetAttribution(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
    source: ICommandErrorIssue['source'],
  ): ICommandPresetIssueMeta | undefined {
    return this.#hintAttributor.resolveOptionConflictPresetAttribution(
      error,
      sourceSegments,
      source,
    )
  }
}
