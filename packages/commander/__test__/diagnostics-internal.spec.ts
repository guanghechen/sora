import { describe, expect, it } from 'vitest'
import { CommanderError } from '../src/command/types'
import { CommandHintAttributor } from '../src/internal/diagnostics/hint-attributor'
import { CommandIssueNormalizer } from '../src/internal/diagnostics/issue-normalizer'
import { Command } from '../src/runtime/node'

describe('diagnostics internals coverage', () => {
  it('should keep preset getter immutable and format camelCase option name in errors', async () => {
    const cmdForParse = new Command({
      name: 'cli',
      desc: 'cli',
    }).option({
      long: 'fooBar',
      type: 'boolean',
      args: 'none',
      desc: 'foo bar',
    })

    await expect(cmdForParse.parse({ argv: ['--foo-bar=auto'], envs: {} })).rejects.toThrow(
      'boolean option "--foo-bar"',
    )

    const cmdWithPreset = new Command({
      name: 'cli',
      desc: 'cli',
      preset: { file: './preset.json', profile: 'dev' },
    })

    const presetSnapshot = cmdWithPreset.preset
    expect(presetSnapshot).toEqual({ file: './preset.json', profile: 'dev' })
    if (presetSnapshot !== undefined) {
      presetSnapshot.file = './changed.json'
    }
    expect(cmdWithPreset.preset).toEqual({ file: './preset.json', profile: 'dev' })
  })

  it('should resolve option conflict preset by fallback source segment search', () => {
    const attributor = new CommandHintAttributor()
    const error = new CommanderError(
      'OptionConflict',
      'option "--x" conflicts with "--y"',
      'cli run',
    )

    const preset = attributor.resolveOptionConflictPresetAttribution(
      error,
      [
        {
          value: '--other',
          source: 'preset',
          preset: { file: './preset.json', profile: 'dev' },
        },
        {
          value: '--user-flag',
          source: 'user',
        },
      ],
      { related: ['user', 'preset'] },
    )

    expect(preset).toEqual({ file: './preset.json', profile: 'dev' })
  })

  it('should drop preset primary source when hint has no preset locator', () => {
    const normalizer = new CommandIssueNormalizer()
    const error = new CommanderError('UnknownOption', 'unknown option "--x"', 'cli').withIssue({
      kind: 'hint',
      stage: 'parse',
      scope: 'option',
      source: {
        primary: 'preset',
        related: ['preset', 'user'],
      },
      reason: {
        code: 'did_you_mean_subcommand',
        message: 'did you mean "build"',
      },
    })

    const normalized = normalizer.normalizeCommanderError(error, {
      fallbackStage: 'parse',
      fallbackScope: 'option',
    })

    const hint = normalized.meta?.issues.find(issue => issue.kind === 'hint')
    expect(hint?.source).toEqual({ related: ['user'] })
  })
})
