import type {
  CommanderError,
  ICommandArgvSegment,
  ICommandErrorIssue,
  ICommandHintIssue,
  ICommandPresetIssueMeta,
} from '../../types'

export class CommandHintAttributor {
  public withPresetInjectedHint(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
  ): CommanderError {
    const presetSegments = sourceSegments.filter(segment => segment.source === 'preset')
    if (presetSegments.length === 0) {
      return error
    }
    if (error.kind === 'ConfigurationError') {
      return error
    }

    let nextError = error
    const primaryIssue = nextError.meta?.issues.find(issue => issue.kind === 'error')
    const conflictSources =
      primaryIssue?.reason.code === 'option_conflict'
        ? this.#inferOptionConflictSources(primaryIssue.reason.message, sourceSegments)
        : undefined
    const hasMixedConflictAttribution =
      primaryIssue?.source?.related?.includes('user') === true &&
      primaryIssue.source.related.includes('preset')
    const isMixedConflict =
      hasMixedConflictAttribution ||
      (conflictSources?.has('user') === true && conflictSources.has('preset'))

    if (
      isMixedConflict &&
      primaryIssue?.reason.code === 'option_conflict' &&
      !nextError.meta?.issues.some(
        issue => issue.kind === 'hint' && issue.reason.code === 'mixed_source_conflict',
      )
    ) {
      const mixedHint: ICommandHintIssue = {
        kind: 'hint',
        stage: primaryIssue.stage,
        originStage: primaryIssue.originStage,
        scope: 'option',
        source: {
          related: ['user', 'preset'],
        },
        reason: {
          code: 'mixed_source_conflict',
          message: 'option conflict involves both user input and preset-injected tokens',
        },
        preset: this.#resolveOptionConflictPresetByMessage(
          primaryIssue.reason.message,
          sourceSegments,
          { related: ['user', 'preset'] },
        ),
      }
      nextError = nextError.withIssue(mixedHint)
    }

    const shouldAttachPresetTokenHint =
      primaryIssue?.source?.primary === 'preset' || isMixedConflict

    if (!shouldAttachPresetTokenHint) {
      return nextError
    }

    if (
      nextError.meta?.issues.some(
        issue => issue.kind === 'hint' && issue.reason.code === 'preset_token_injected',
      )
    ) {
      return nextError
    }

    const firstSegment = presetSegments[0]
    const moreCount = presetSegments.length - 1
    const moreText = moreCount > 0 ? ` (+${moreCount} more)` : ''
    const currentPrimaryIssue = nextError.meta?.issues.find(issue => issue.kind === 'error')

    const hint: ICommandHintIssue = {
      kind: 'hint',
      stage: currentPrimaryIssue?.stage ?? 'parse',
      originStage: 'preset',
      scope: 'preset',
      source: { primary: 'preset' },
      reason: {
        code: 'preset_token_injected',
        message: `token ${JSON.stringify(firstSegment.value)} was injected from preset profile opts${moreText}`,
      },
      preset: firstSegment.preset,
    }

    return nextError.withIssue(hint)
  }

  public resolveOptionConflictSourceAttribution(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
  ): ICommandErrorIssue['source'] | undefined {
    if (error.kind !== 'OptionConflict') {
      return undefined
    }

    const sources = this.#inferOptionConflictSources(error.message, sourceSegments)
    if (sources.has('user') && sources.has('preset')) {
      return {
        related: ['user', 'preset'],
      }
    }
    if (sources.has('preset')) {
      return { primary: 'preset' }
    }
    if (sources.has('user')) {
      return { primary: 'user' }
    }
    return undefined
  }

  public resolveOptionConflictPresetAttribution(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
    source: ICommandErrorIssue['source'],
  ): ICommandPresetIssueMeta | undefined {
    if (error.kind !== 'OptionConflict') {
      return undefined
    }

    return this.#resolveOptionConflictPresetByMessage(error.message, sourceSegments, source)
  }

  #resolveOptionConflictPresetByMessage(
    message: string,
    sourceSegments: ICommandArgvSegment[],
    source: ICommandErrorIssue['source'],
  ): ICommandPresetIssueMeta | undefined {
    const relevantSegments = this.#collectOptionConflictSegments(message, sourceSegments)
    const relevantPresetSegment = relevantSegments.find(
      segment => segment.source === 'preset' && segment.preset !== undefined,
    )
    if (relevantPresetSegment?.preset !== undefined) {
      return { ...relevantPresetSegment.preset }
    }

    const hasPresetSource =
      source?.primary === 'preset' || source?.related?.includes('preset') === true
    if (!hasPresetSource) {
      return undefined
    }

    const fallbackPresetSegment = sourceSegments.find(
      segment => segment.source === 'preset' && segment.preset !== undefined,
    )
    return fallbackPresetSegment?.preset === undefined
      ? undefined
      : { ...fallbackPresetSegment.preset }
  }

  #inferOptionConflictSources(
    message: string,
    sourceSegments: ICommandArgvSegment[],
  ): Set<ICommandArgvSegment['source']> {
    const relevantSegments = this.#collectOptionConflictSegments(message, sourceSegments)

    const sources = new Set<ICommandArgvSegment['source']>()
    for (const segment of relevantSegments) {
      sources.add(segment.source)
    }

    return sources
  }

  #collectOptionConflictSegments(
    message: string,
    sourceSegments: ICommandArgvSegment[],
  ): ICommandArgvSegment[] {
    const matchedLongs = Array.from(
      message.matchAll(/"(--[a-z][a-z0-9]*(?:-[a-z0-9]+)*)"/g),
      match => match[1],
    )
    const matchedShorts = Array.from(message.matchAll(/"(-[A-Za-z0-9])"/g), match => match[1])
    const optionLiterals = new Set<string>([...matchedLongs, ...matchedShorts])

    const optionSegments = sourceSegments.filter(segment => segment.value.startsWith('-'))
    const relevantSegments =
      optionLiterals.size === 0
        ? optionSegments
        : optionSegments.filter(segment => {
            for (const literal of optionLiterals) {
              if (segment.value === literal || segment.value.startsWith(`${literal}=`)) {
                return true
              }
            }
            return false
          })

    return relevantSegments
  }
}
