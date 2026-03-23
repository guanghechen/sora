import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CommandPresetProfileParser,
  PRESET_PROFILE_FLAG,
} from '../src/internal/preset/preset-profile-parser'

function createPresetProfileParser(
  files: Record<string, string | undefined>,
): CommandPresetProfileParser {
  return new CommandPresetProfileParser({
    resolvePresetFileAbsolutePath: (filepath, baseDirectory) =>
      path.resolve(baseDirectory ?? '/workspace', filepath),
    resolvePath: (...paths) => path.resolve(...paths),
    readPresetFile: async file => files[file.absolutePath],
  })
}

describe('CommandPresetProfileParser', () => {
  it('should return undefined when preset file cannot be read', async () => {
    const parser = createPresetProfileParser({})

    const result = await parser.resolvePresetProfile({
      presetFile: './missing.json',
      presetProfile: 'dev',
      presetProfileSourceName: PRESET_PROFILE_FLAG,
      commandPath: 'cli run',
    })

    expect(result).toBeUndefined()
  })

  it('should resolve defaults.profile + defaultVariant and merge opts/env fields', async () => {
    const presetFilePath = path.resolve('/workspace', 'preset.json')
    const parser = createPresetProfileParser({
      [presetFilePath]: JSON.stringify({
        version: 1,
        defaults: { profile: 'dev' },
        profiles: {
          dev: {
            envFile: 'profile.env',
            envs: { PROFILE_ENV: '1' },
            opts: {
              logLevel: 'debug',
              retries: 3,
              devmode: true,
              list: ['a', 2],
            },
            defaultVariant: 'local',
            variants: {
              local: {
                envFile: 'variant.env',
                envs: { VARIANT_ENV: '1' },
                opts: {
                  logLevel: 'trace',
                  silent: false,
                },
              },
            },
          },
        },
      }),
    })

    const result = await parser.resolvePresetProfile({
      presetFile: './preset.json',
      presetProfile: undefined,
      presetProfileSourceName: undefined,
      commandPath: 'cli run',
    })

    expect(result).toBeDefined()
    expect(result).toMatchObject({
      profileName: 'dev',
      variantName: 'local',
      issueMeta: {
        file: './preset.json',
        profile: 'dev',
        variant: 'local',
      },
      profileInlineEnvs: { PROFILE_ENV: '1' },
      variantInlineEnvs: { VARIANT_ENV: '1' },
      profileEnvFileSource: { displayPath: 'profile.env' },
      variantEnvFileSource: { displayPath: 'variant.env' },
    })
    expect(result?.optsArgv).toEqual([
      '--log-level',
      'trace',
      '--retries',
      '3',
      '--devmode',
      '--list',
      'a',
      '2',
      '--no-silent',
    ])
  })

  it('should prefer explicit preset selector over command-path suffix and defaults.profile', async () => {
    const presetFilePath = path.resolve('/workspace', 'preset.json')
    const parser = createPresetProfileParser({
      [presetFilePath]: JSON.stringify({
        version: 1,
        defaults: { profile: 'dev' },
        profiles: {
          'cli.run': { opts: { mode: 'suffix' } },
          dev: { opts: { mode: 'dev' } },
          prod: {
            variants: {
              ci: { opts: { mode: 'prod-ci' } },
            },
          },
        },
      }),
    })

    const result = await parser.resolvePresetProfile({
      presetFile: './preset.json',
      presetProfile: 'prod:ci',
      presetProfileSourceName: PRESET_PROFILE_FLAG,
      commandPath: 'cli run',
    })

    expect(result).toBeDefined()
    expect(result).toMatchObject({
      profileName: 'prod',
      variantName: 'ci',
      optsSourceLabel: './preset.json#prod:ci.opts',
    })
    expect(result?.optsArgv).toEqual(['--mode', 'prod-ci'])
  })

  it('should resolve profile by command-path suffix when selector is not provided', async () => {
    const presetFilePath = path.resolve('/workspace', 'preset.json')
    const parser = createPresetProfileParser({
      [presetFilePath]: JSON.stringify({
        version: 1,
        defaults: { profile: 'dev' },
        profiles: {
          'cli.run': { opts: { mode: 'full' } },
          run: { opts: { mode: 'leaf' } },
          dev: { opts: { mode: 'defaults' } },
          default: { opts: { mode: 'fallback' } },
        },
      }),
    })

    const result = await parser.resolvePresetProfile({
      presetFile: './preset.json',
      presetProfile: undefined,
      presetProfileSourceName: undefined,
      commandPath: 'cli run',
    })

    expect(result).toBeDefined()
    expect(result?.profileName).toBe('cli.run')
    expect(result?.optsArgv).toEqual(['--mode', 'full'])
  })

  it('should fallback to profile "default" when no selector/defaults/suffix profile is matched', async () => {
    const presetFilePath = path.resolve('/workspace', 'preset.json')
    const parser = createPresetProfileParser({
      [presetFilePath]: JSON.stringify({
        version: 1,
        profiles: {
          default: { opts: { mode: 'fallback' } },
        },
      }),
    })

    const result = await parser.resolvePresetProfile({
      presetFile: './preset.json',
      presetProfile: undefined,
      presetProfileSourceName: undefined,
      commandPath: 'cli run',
    })

    expect(result).toBeDefined()
    expect(result?.profileName).toBe('default')
    expect(result?.optsArgv).toEqual(['--mode', 'fallback'])
  })

  it('should fail when defaults.profile points to an unknown profile', async () => {
    const presetFilePath = path.resolve('/workspace', 'preset.json')
    const parser = createPresetProfileParser({
      [presetFilePath]: JSON.stringify({
        version: 1,
        defaults: { profile: 'ops' },
        profiles: {
          default: { opts: { mode: 'fallback' } },
        },
      }),
    })

    await expect(
      parser.resolvePresetProfile({
        presetFile: './preset.json',
        presetProfile: undefined,
        presetProfileSourceName: undefined,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('unknown preset profile "ops"')
  })

  it('should reject using preset profile without preset file', async () => {
    const parser = createPresetProfileParser({})

    await expect(
      parser.resolvePresetProfile({
        presetFile: undefined,
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('cannot use "--preset-profile" without "--preset-file"')
  })

  it('should reject invalid preset manifest version', async () => {
    const presetFilePath = path.resolve('/workspace', 'preset.json')
    const parser = createPresetProfileParser({
      [presetFilePath]: JSON.stringify({
        version: 2,
        profiles: {},
      }),
    })

    await expect(
      parser.resolvePresetProfile({
        presetFile: './preset.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('"version" must be 1')
  })

  it('should reject malformed preset manifest structures', async () => {
    const fileA = path.resolve('/workspace', 'a.json')
    const fileB = path.resolve('/workspace', 'b.json')
    const fileC = path.resolve('/workspace', 'c.json')
    const fileD = path.resolve('/workspace', 'd.json')
    const parser = createPresetProfileParser({
      [fileA]: '[]',
      [fileB]: JSON.stringify({ version: 1, defaults: 'bad', profiles: {} }),
      [fileC]: JSON.stringify({ version: 1, defaults: { profile: 1 }, profiles: {} }),
      [fileD]: JSON.stringify({ version: 1, profiles: [] }),
    })

    await expect(
      parser.resolvePresetProfile({
        presetFile: './a.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('root must be an object')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './b.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('"defaults" must be an object')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './c.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('"defaults.profile" must be a string')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './d.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('"profiles" must be an object')
  })

  it('should reject malformed profile and variant items', async () => {
    const filePath = path.resolve('/workspace', 'preset.json')
    const parser = createPresetProfileParser({
      [filePath]: JSON.stringify({
        version: 1,
        profiles: {
          dev: {
            envFile: 1,
            envs: { OK: '1', BAD: 2 },
            opts: { bad: { nested: true } },
            defaultVariant: 'not-found',
            variants: {
              local: {
                envFile: 1,
                envs: { OK: '1', BAD: 2 },
                opts: { bad: { nested: true } },
              },
            },
          },
        },
      }),
    })

    await expect(
      parser.resolvePresetProfile({
        presetFile: './preset.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('profile "dev".envFile must be a string')
  })

  it('should reject invalid profile definitions across independent manifests', async () => {
    const fileA = path.resolve('/workspace', 'a.json')
    const fileB = path.resolve('/workspace', 'b.json')
    const fileC = path.resolve('/workspace', 'c.json')
    const fileD = path.resolve('/workspace', 'd.json')
    const fileE = path.resolve('/workspace', 'e.json')
    const fileF = path.resolve('/workspace', 'f.json')
    const parser = createPresetProfileParser({
      [fileA]: JSON.stringify({ version: 1, profiles: { dev: [] } }),
      [fileB]: JSON.stringify({ version: 1, profiles: { dev: { envs: [] } } }),
      [fileC]: JSON.stringify({ version: 1, profiles: { dev: { opts: [] } } }),
      [fileD]: JSON.stringify({ version: 1, profiles: { dev: { defaultVariant: '*' } } }),
      [fileE]: JSON.stringify({ version: 1, profiles: { dev: { variants: [] } } }),
      [fileF]: JSON.stringify({ version: 1, profiles: { dev: { defaultVariant: 'x' } } }),
    })

    await expect(
      parser.resolvePresetProfile({
        presetFile: './a.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('profile "dev" must be an object')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './b.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('profile "dev".envs must be an object')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './c.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('profile "dev".opts must be an object')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './d.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('defaultVariant')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './e.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('profile "dev".variants must be an object')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './f.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('defaultVariant "x" is not found in variants')
  })

  it('should reject malformed variant details and option value types', async () => {
    const fileA = path.resolve('/workspace', 'a.json')
    const fileB = path.resolve('/workspace', 'b.json')
    const fileC = path.resolve('/workspace', 'c.json')
    const fileD = path.resolve('/workspace', 'd.json')
    const fileE = path.resolve('/workspace', 'e.json')
    const parser = createPresetProfileParser({
      [fileA]: JSON.stringify({
        version: 1,
        profiles: { dev: { variants: { local: [] } } },
      }),
      [fileB]: JSON.stringify({
        version: 1,
        profiles: { dev: { variants: { local: { envFile: 1 } } } },
      }),
      [fileC]: JSON.stringify({
        version: 1,
        profiles: { dev: { variants: { local: { envs: [] } } } },
      }),
      [fileD]: JSON.stringify({
        version: 1,
        profiles: { dev: { variants: { local: { opts: [] } } } },
      }),
      [fileE]: JSON.stringify({
        version: 1,
        profiles: {
          dev: {
            opts: {
              badArray: ['ok', { bad: true }],
            },
          },
        },
      }),
      [path.resolve('/workspace', 'f.json')]:
        '{"version":1,"profiles":{"dev":{"opts":{"nan":1e309}}}}',
    })

    await expect(
      parser.resolvePresetProfile({
        presetFile: './a.json',
        presetProfile: 'dev:local',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('variants["local"] must be an object')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './b.json',
        presetProfile: 'dev:local',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('variants["local"].envFile must be a string')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './c.json',
        presetProfile: 'dev:local',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('variants["local"].envs must be an object')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './d.json',
        presetProfile: 'dev:local',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('variants["local"].opts must be an object')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './e.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('must be a string or finite number')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './f.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('must be a finite number')
  })

  it('should reject invalid selector value and invalid profile/variant names', () => {
    const parser = createPresetProfileParser({})

    expect(() =>
      parser.assertPresetProfileSelectorValue('dev:', PRESET_PROFILE_FLAG, 'cli run'),
    ).toThrow('must be "<profile>" or "<profile>:<variant>"')

    expect(() =>
      parser.assertPresetProfileSelectorValue('*', PRESET_PROFILE_FLAG, 'cli run'),
    ).toThrow('invalid profile name')

    expect(() =>
      parser.assertPresetProfileSelectorValue('dev:*', PRESET_PROFILE_FLAG, 'cli run'),
    ).toThrow('invalid variant name')
  })

  it('should validate preset profile selector format', () => {
    const parser = createPresetProfileParser({})

    expect(() =>
      parser.assertPresetProfileSelectorValue('dev', PRESET_PROFILE_FLAG, 'cli run'),
    ).not.toThrow()
    expect(() =>
      parser.assertPresetProfileSelectorValue('dev:ci', PRESET_PROFILE_FLAG, 'cli run'),
    ).not.toThrow()
    expect(() =>
      parser.assertPresetProfileSelectorValue('dev:ci:extra', PRESET_PROFILE_FLAG, 'cli run'),
    ).toThrow('must be "<profile>" or "<profile>:<variant>"')
  })

  it('should reject illegal preset option tokens', () => {
    const parser = createPresetProfileParser({})

    expect(() =>
      parser.validatePresetOptionTokens(['help'], '/tmp/preset.json', 'cli run'),
    ).toThrow('cannot appear before any option token')

    expect(() =>
      parser.validatePresetOptionTokens(['--help'], '/tmp/preset.json', 'cli run'),
    ).toThrow('control token')

    expect(() =>
      parser.validatePresetOptionTokens(['--preset-file=./a.json'], '/tmp/preset.json', 'cli run'),
    ).toThrow('preset directive')

    expect(() => parser.validatePresetOptionTokens(['--'], '/tmp/preset.json', 'cli run')).toThrow(
      '"--" is not allowed',
    )
  })

  it('should reject missing defaults profile and unknown profile/variant', async () => {
    const fileA = path.resolve('/workspace', 'a.json')
    const fileB = path.resolve('/workspace', 'b.json')
    const fileC = path.resolve('/workspace', 'c.json')
    const parser = createPresetProfileParser({
      [fileA]: JSON.stringify({ version: 1, profiles: { dev: {} } }),
      [fileB]: JSON.stringify({ version: 1, profiles: { dev: {} } }),
      [fileC]: JSON.stringify({ version: 1, profiles: { dev: { variants: {} } } }),
    })

    await expect(
      parser.resolvePresetProfile({
        presetFile: './a.json',
        presetProfile: undefined,
        presetProfileSourceName: undefined,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('missing profile for preset file')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './b.json',
        presetProfile: 'prod',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('unknown preset profile')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './c.json',
        presetProfile: 'dev:local',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('unknown preset variant "local"')
  })

  it('should reject invalid preset option names and non-finite array item', async () => {
    const fileA = path.resolve('/workspace', 'a.json')
    const fileB = path.resolve('/workspace', 'b.json')
    const fileC = path.resolve('/workspace', 'c.json')
    const parser = createPresetProfileParser({
      [fileA]: JSON.stringify({
        version: 1,
        profiles: { dev: { opts: { '--': 'x' } } },
      }),
      [fileB]: JSON.stringify({
        version: 1,
        profiles: { dev: { opts: { bad_name: 'x' } } },
      }),
      [fileC]: JSON.stringify({
        version: 1,
        profiles: {
          dev: {
            opts: {
              arr: [1, Number.POSITIVE_INFINITY],
            },
          },
        },
      }),
    })

    await expect(
      parser.resolvePresetProfile({
        presetFile: './a.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('invalid option name "--"')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './b.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('invalid option name "bad_name"')

    await expect(
      parser.resolvePresetProfile({
        presetFile: './c.json',
        presetProfile: 'dev',
        presetProfileSourceName: PRESET_PROFILE_FLAG,
        commandPath: 'cli run',
      }),
    ).rejects.toThrow('must be a string or finite number')
  })

  it('should allow empty preset option list generated from empty array', async () => {
    const filePath = path.resolve('/workspace', 'preset.json')
    const parser = createPresetProfileParser({
      [filePath]: JSON.stringify({
        version: 1,
        defaults: { profile: 'dev' },
        profiles: {
          dev: {
            opts: {
              list: [],
            },
          },
        },
      }),
    })

    const result = await parser.resolvePresetProfile({
      presetFile: './preset.json',
      presetProfile: undefined,
      presetProfileSourceName: undefined,
      commandPath: 'cli run',
    })

    expect(result?.optsArgv).toEqual([])
  })

  it('should normalize kebab option names from preset opts into camel-aware tokens', async () => {
    const filePath = path.resolve('/workspace', 'preset-kebab.json')
    const parser = createPresetProfileParser({
      [filePath]: JSON.stringify({
        version: 1,
        defaults: { profile: 'dev' },
        profiles: {
          dev: {
            opts: {
              'log-level': 'debug',
            },
          },
        },
      }),
    })

    const result = await parser.resolvePresetProfile({
      presetFile: './preset-kebab.json',
      presetProfile: undefined,
      presetProfileSourceName: undefined,
      commandPath: 'cli run',
    })

    expect(result?.optsArgv).toEqual(['--log-level', 'debug'])
  })
})
