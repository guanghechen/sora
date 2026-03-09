import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Command, CompletionCommand } from '../src/runtime/node'
import { CommanderError } from '../src/types'

afterEach(() => {
  vi.restoreAllMocks()
})

async function withTempDir(fn: (tmpDir: string) => Promise<void>): Promise<void> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'commander-spec-'))
  try {
    await fn(tmpDir)
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

function mockProcessExit(): void {
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
}

describe('Command (spec aligned)', () => {
  describe('basic parse contract', () => {
    it('should parse options and arguments', async () => {
      const cmd = new Command({ name: 'app', desc: 'app' })
        .option({ long: 'verbose', short: 'v', type: 'boolean', args: 'none', desc: 'verbose' })
        .option({ long: 'port', type: 'number', args: 'required', desc: 'port' })
        .argument({ name: 'input', kind: 'required', type: 'string', desc: 'input' })

      const result = await cmd.parse({ argv: ['-v', '--port', '8080', 'index.ts'], envs: {} })

      expect(result.opts).toEqual({ verbose: true, port: 8080 })
      expect(result.args).toEqual({ input: 'index.ts' })
      expect(result.rawArgs).toEqual(['index.ts'])
    })

    it('should parse inline boolean values true and false', async () => {
      const cmd = new Command({ name: 'app', desc: 'app' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        desc: 'verbose',
      })

      const enabled = await cmd.parse({ argv: ['--verbose=true'], envs: {} })
      const disabled = await cmd.parse({ argv: ['--verbose=false'], envs: {} })

      expect(enabled.opts).toEqual({ verbose: true })
      expect(disabled.opts).toEqual({ verbose: false })
    })

    it('should throw when unknown option exists', async () => {
      const cmd = new Command({ name: 'app', desc: 'app' })
      await expect(cmd.parse({ argv: ['--unknown'], envs: {} })).rejects.toThrow('unknown option')
    })

    it('should support variadic + coerce(element-wise)', async () => {
      const cmd = new Command({ name: 'app', desc: 'app' }).option({
        long: 'ports',
        type: 'number',
        args: 'variadic',
        desc: 'ports',
        coerce: raw => {
          const value = Number(raw)
          if (Number.isNaN(value)) {
            throw new Error('invalid port')
          }
          return value
        },
      })

      const result = await cmd.parse({ argv: ['--ports', '80', '443'], envs: {} })
      expect(result.opts).toEqual({ ports: [80, 443] })
    })
  })

  describe('route and inherited options', () => {
    it('should parse inherited options but only expose leaf local opts', async () => {
      let inheritedApplied = false
      const root = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        desc: 'verbose',
        apply: value => {
          inheritedApplied = Boolean(value)
        },
      })

      const sub = new Command({ desc: 'sub' }).option({
        long: 'target',
        type: 'string',
        args: 'required',
        desc: 'target',
      })

      root.subcommand('sub', sub)

      const result = await root.parse({
        argv: ['sub', '--verbose', '--target', 'prod'],
        envs: {},
      })

      expect(inheritedApplied).toBe(true)
      expect(result.opts).toEqual({ target: 'prod' })
      expect(result.ctx.sources.user.cmds).toEqual(['sub'])
    })

    it('should throw UnknownSubcommand with hint when leaf has subcommands and first tail token is bare', async () => {
      const root = new Command({ name: 'cli', desc: 'cli' })
      const build = new Command({ desc: 'build' })
      build.subcommand('watch', new Command({ desc: 'watch' }))
      root.subcommand('build', build)

      await expect(root.parse({ argv: ['build', 'watc'], envs: {} })).rejects.toMatchObject({
        name: 'CommanderError',
        kind: 'UnknownSubcommand',
        meta: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              kind: 'hint',
              reason: expect.objectContaining({ code: 'did_you_mean_subcommand' }),
            }),
            expect.objectContaining({
              kind: 'hint',
              reason: expect.objectContaining({
                code: 'command_does_not_accept_positional_arguments',
              }),
            }),
          ]),
        },
      })
    })

    it('should not throw UnknownSubcommand when first tail token matches known subcommand', async () => {
      const root = new Command({ name: 'cli', desc: 'cli' })
      const build = new Command({ desc: 'build' }).argument({
        name: 'target',
        kind: 'optional',
        type: 'string',
        desc: 'target',
      })
      build.subcommand('watch', new Command({ desc: 'watch' }))
      root.subcommand('build', build)

      const result = await root.parse({ argv: ['build', '--help', 'watch'], envs: {} })

      expect(result.ctx.controls.help).toBe(true)
      expect(result.args).toEqual({ target: 'watch' })
    })

    it('should not use alias as did-you-mean candidate', async () => {
      const root = new Command({ name: 'cli', desc: 'cli' })
      const build = new Command({ desc: 'build' })
      const watch = new Command({ desc: 'watch' })
      build.subcommand('watch', watch)
      build.subcommand('w', watch)
      root.subcommand('build', build)

      await expect(root.parse({ argv: ['build', 'ww'], envs: {} })).rejects.toMatchObject({
        name: 'CommanderError',
        kind: 'UnknownSubcommand',
      })
      await expect(root.parse({ argv: ['build', 'ww'], envs: {} })).rejects.toMatchObject({
        meta: {
          issues: expect.not.arrayContaining([
            expect.objectContaining({
              kind: 'hint',
              reason: expect.objectContaining({ code: 'did_you_mean_subcommand' }),
            }),
          ]),
        },
      })
    })

    it('should not show did-you-mean when nearest distance is tied', async () => {
      const root = new Command({ name: 'cli', desc: 'cli' })
      const build = new Command({ desc: 'build' })
      build.subcommand('cat', new Command({ desc: 'cat' }))
      build.subcommand('cut', new Command({ desc: 'cut' }))
      root.subcommand('build', build)

      await expect(root.parse({ argv: ['build', 'cot'], envs: {} })).rejects.toMatchObject({
        name: 'CommanderError',
        kind: 'UnknownSubcommand',
      })
      await expect(root.parse({ argv: ['build', 'cot'], envs: {} })).rejects.toMatchObject({
        meta: {
          issues: expect.not.arrayContaining([
            expect.objectContaining({
              kind: 'hint',
              reason: expect.objectContaining({ code: 'did_you_mean_subcommand' }),
            }),
          ]),
        },
      })
    })

    it('should prefer UnknownSubcommand over UnexpectedArgument', async () => {
      const root = new Command({ name: 'cli', desc: 'cli' })
      const build = new Command({ desc: 'build' })
      build.subcommand('watch', new Command({ desc: 'watch' }))
      root.subcommand('build', build)

      await expect(root.parse({ argv: ['build', 'foo'], envs: {} })).rejects.toMatchObject({
        name: 'CommanderError',
        kind: 'UnknownSubcommand',
      })
    })

    it('should throw UnexpectedArgument when command does not accept positional arguments', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })

      await expect(cmd.parse({ argv: ['foo'], envs: {} })).rejects.toMatchObject({
        name: 'CommanderError',
        kind: 'UnexpectedArgument',
      })
    })

    it('should throw UnexpectedArgument when first token is option and later has bare token', async () => {
      const root = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        desc: 'verbose',
      })
      root.subcommand('start', new Command({ desc: 'start' }))

      await expect(root.parse({ argv: ['--verbose', 'foo'], envs: {} })).rejects.toMatchObject({
        name: 'CommanderError',
        kind: 'UnexpectedArgument',
      })
    })
  })

  describe('control scan and run control', () => {
    it('parse should record --help in ctx.controls and never expose help in opts', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      const result = await cmd.parse({ argv: ['--help'], envs: {} })

      expect(result.ctx.controls).toEqual({ help: true, version: false })
      expect(result.opts['help']).toBeUndefined()
    })

    it('parse should keep validating after control hit (no short-circuit)', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).argument({
        name: 'input',
        kind: 'required',
        type: 'string',
        desc: 'input',
      })

      await expect(cmd.parse({ argv: ['--help'], envs: {} })).rejects.toThrow(
        'missing required argument',
      )
    })

    it('run should short-circuit by help before validation', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const cmd = new Command({ name: 'cli', desc: 'cli' }).argument({
        name: 'input',
        kind: 'required',
        type: 'string',
        desc: 'input',
      })

      await cmd.run({ argv: ['--help', '--unknown'], envs: {} })

      expect(logSpy).toHaveBeenCalledOnce()
      expect(errorSpy).not.toHaveBeenCalled()
      expect(process.exit).not.toHaveBeenCalled()
    })

    it('run should treat -h as normal short option (no built-in meaning)', async () => {
      mockProcessExit()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await cmd.run({ argv: ['-h'], envs: {} })

      expect(errorSpy).toHaveBeenCalledOnce()
      expect(process.exit).toHaveBeenCalledWith(2)
    })

    it('run should support leaf --version when enabled', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', desc: 'cli', version: '1.2.3' })
      await root.run({ argv: ['--version'], envs: {} })

      expect(logSpy).toHaveBeenCalledWith('1.2.3')
      expect(process.exit).not.toHaveBeenCalled()
    })

    it('subcommand --version should print subcommand version when configured', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', desc: 'cli', version: '1.0.0' })
      root.subcommand('sub', new Command({ desc: 'sub', version: '2.0.0' }))

      await root.run({ argv: ['sub', '--version'], envs: {} })

      expect(logSpy).toHaveBeenCalledWith('2.0.0')
      expect(process.exit).not.toHaveBeenCalled()
    })

    it('should support help and help <child> syntax in run', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', desc: 'cli root' })
      const sub = new Command({ desc: 'sub desc' })
      root.subcommand('sub', sub)

      await root.run({ argv: ['help', 'sub'], envs: {} })
      const output = String(logSpy.mock.calls[0]?.[0] ?? '')
      expect(output).toContain('sub desc')

      logSpy.mockClear()
      await root.run({ argv: ['help', 'unknown'], envs: {} })
      const fallbackOutput = String(logSpy.mock.calls[0]?.[0] ?? '')
      expect(fallbackOutput).toContain('cli root')
    })

    it('help should win over version when both are present', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const cmd = new Command({ name: 'cli', desc: 'cli', version: '1.0.0' })
      await cmd.run({ argv: ['--version', '--help'], envs: {} })

      const output = String(logSpy.mock.calls[0]?.[0] ?? '')
      expect(output).toContain('Usage: cli')
      expect(output).not.toBe('1.0.0')
    })
  })

  describe('preset phase', () => {
    it('should fallback to command preset file/profile when CLI directives are absent', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            profiles: {
              dev: {
                envs: {},
                opts: { mode: 'fast' },
              },
            },
          }),
        )

        const root = new Command({
          name: 'cli',
          desc: 'cli',
          preset: { file: presetFile, profile: 'dev' },
        })
        const run = new Command({ desc: 'run' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
          default: 'safe',
        })
        root.subcommand('run', run)

        const result = await root.parse({ argv: ['run'], envs: {} })
        expect(result.opts).toEqual({ mode: 'fast' })
        expect(result.ctx.sources.preset.state).toBe('applied')
        expect(result.ctx.sources.preset.meta).toMatchObject({
          applied: true,
          file: presetFile,
          profile: 'dev',
        })
      })
    })

    it('should expose preset state none when PRESET runs without selected profile', async () => {
      const root = new Command({ name: 'cli', desc: 'cli' })
      root.subcommand('run', new Command({ desc: 'run' }))

      const result = await root.parse({ argv: ['run'], envs: {} })
      expect(result.ctx.sources.preset.state).toBe('none')
      expect(result.ctx.sources.preset.meta).toBeUndefined()
    })

    it('should resolve command preset file/profile independently across command chain', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            profiles: {
              dev: {
                envs: {},
                opts: { mode: 'fast' },
              },
              prod: {
                envs: {},
                opts: { mode: 'safe' },
              },
            },
          }),
        )

        const root = new Command({
          name: 'cli',
          desc: 'cli',
          preset: { file: presetFile, profile: 'dev' },
        })
        const run = new Command({ desc: 'run', preset: { profile: 'prod' } }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })
        root.subcommand('run', run)

        const result = await root.parse({ argv: ['run'], envs: {} })
        expect(result.opts).toEqual({ mode: 'safe' })
      })
    })

    it('should let CLI --preset-file/--preset-profile override command preset defaults', async () => {
      await withTempDir(async tmpDir => {
        const commandPresetFile = path.join(tmpDir, 'command-preset.json')
        const cliPresetFile = path.join(tmpDir, 'cli-preset.json')
        await writeFile(
          commandPresetFile,
          JSON.stringify({
            version: 1,
            profiles: {
              dev: {
                envs: {},
                opts: { mode: 'fast' },
              },
            },
          }),
        )
        await writeFile(
          cliPresetFile,
          JSON.stringify({
            version: 1,
            profiles: {
              prod: {
                envs: {},
                opts: { mode: 'safe' },
              },
            },
          }),
        )

        const root = new Command({
          name: 'cli',
          desc: 'cli',
          preset: { file: commandPresetFile, profile: 'dev' },
        })
        const run = new Command({ desc: 'run' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })
        root.subcommand('run', run)

        const result = await root.parse({
          argv: ['run', `--preset-file=${cliPresetFile}`, '--preset-profile=prod'],
          envs: {},
        })
        expect(result.opts).toEqual({ mode: 'safe' })
      })
    })

    it('should not validate command preset file when CLI --preset-file overrides it', async () => {
      await withTempDir(async tmpDir => {
        const cliPresetFile = path.join(tmpDir, 'cli-preset.json')
        await writeFile(
          cliPresetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'prod' },
            profiles: {
              prod: {
                envs: {},
                opts: { mode: 'safe' },
              },
            },
          }),
        )

        const root = new Command({
          name: 'cli',
          desc: 'cli',
          preset: { file: '..invalid.preset.json' },
        })
        const run = new Command({ desc: 'run' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })
        root.subcommand('run', run)

        const result = await root.parse({
          argv: ['run', `--preset-file=${cliPresetFile}`],
          envs: {},
        })
        expect(result.opts).toEqual({ mode: 'safe' })
      })
    })

    it('should not validate command preset profile when CLI --preset-profile overrides it', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            profiles: {
              prod: {
                envs: {},
                opts: { mode: 'safe' },
              },
            },
          }),
        )

        const root = new Command({
          name: 'cli',
          desc: 'cli',
          preset: { file: presetFile, profile: '@invalid' },
        })
        const run = new Command({ desc: 'run' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })
        root.subcommand('run', run)

        const result = await root.parse({
          argv: ['run', '--preset-profile=prod'],
          envs: {},
        })
        expect(result.opts).toEqual({ mode: 'safe' })
      })
    })

    it('should reject command preset profile when no preset file can be resolved', async () => {
      const root = new Command({
        name: 'cli',
        desc: 'cli',
        preset: { profile: 'dev' },
      })
      root.subcommand('run', new Command({ desc: 'run' }))

      await expect(root.parse({ argv: ['run'], envs: {} })).rejects.toThrow(
        'cannot use "command.preset.profile" without "command.preset.file" or "--preset-file"',
      )
    })

    it('should fail when adopted command.preset.file is missing', async () => {
      const root = new Command({
        name: 'cli',
        desc: 'cli',
        preset: { file: './not-found.preset.json', profile: 'dev' },
      })
      root.subcommand('run', new Command({ desc: 'run' }))

      await expect(root.parse({ argv: ['run'], envs: {} })).rejects.toThrow(
        'failed to read preset file',
      )
    })

    it('should not validate unselected profile envFile', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(path.join(tmpDir, 'prod.env'), 'MODE=prod\n')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'prod' },
            profiles: {
              dev: {
                envFile: 'missing.env',
                envs: {},
                opts: {},
              },
              prod: {
                envFile: 'prod.env',
                envs: {},
                opts: {},
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        root.subcommand('run', new Command({ desc: 'run' }))
        const result = await root.parse({ argv: ['run', `--preset-file=${presetFile}`], envs: {} })
        expect(result.ctx.envs.MODE).toBe('prod')
      })
    })

    it('should apply profile defaults from --preset-file and merge envFile/envs/opts', async () => {
      await withTempDir(async tmpDir => {
        const envPath = path.join(tmpDir, 'dev.env')
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(envPath, 'NAME=from-file\nTOKEN=file-token\n')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envFile: 'dev.env',
                envs: { NAME: 'from-inline', NODE_ENV: 'development' },
                opts: { mode: 'fast', retry: 2 },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        const run = new Command({ desc: 'run' })
          .option({ long: 'mode', type: 'string', args: 'required', desc: 'mode', default: 'safe' })
          .option({ long: 'retry', type: 'number', args: 'required', desc: 'retry', default: 1 })
        root.subcommand('run', run)

        const result = await root.parse({
          argv: ['run', `--preset-file=${presetFile}`, '--retry', '5'],
          envs: { NAME: 'user' },
        })

        expect(result.opts).toEqual({ mode: 'fast', retry: 5 })
        expect(result.ctx.envs).toMatchObject({
          NAME: 'from-inline',
          TOKEN: 'file-token',
          NODE_ENV: 'development',
        })
      })
    })

    it('should support --preset-profile override and token style directives', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envs: {},
                opts: { mode: 'fast' },
              },
              prod: {
                envs: {},
                opts: { mode: 'safe' },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        const run = new Command({ desc: 'run' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })
        root.subcommand('run', run)

        const result = await root.parse({
          argv: ['run', '--preset-file', presetFile, '--preset-profile', 'prod'],
          envs: {},
        })
        expect(result.opts).toEqual({ mode: 'safe' })
      })
    })

    it('should support profile:variant selector and merge base/variant fields', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(path.join(tmpDir, 'base.env'), 'A=base-file\nB=base-file\n')
        await writeFile(
          path.join(tmpDir, 'staging.env'),
          'B=variant-file\nC=variant-file\nD=variant-file\n',
        )
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            profiles: {
              dev: {
                envFile: 'base.env',
                envs: { B: 'base-inline', C: 'base-inline' },
                opts: { mode: 'fast', retry: 2 },
                defaultVariant: 'local',
                variants: {
                  local: {
                    opts: { mode: 'local' },
                  },
                  staging: {
                    envFile: 'staging.env',
                    envs: { C: 'variant-inline', E: 'variant-inline' },
                    opts: { retry: 4, debug: true },
                  },
                },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        const run = new Command({ desc: 'run' })
          .option({ long: 'mode', type: 'string', args: 'required', desc: 'mode', default: 'safe' })
          .option({ long: 'retry', type: 'number', args: 'required', desc: 'retry', default: 1 })
          .option({ long: 'debug', type: 'boolean', args: 'none', desc: 'debug', default: false })
        root.subcommand('run', run)

        const result = await root.parse({
          argv: [
            'run',
            `--preset-file=${presetFile}`,
            '--preset-profile=dev:staging',
            '--retry',
            '8',
          ],
          envs: { A: 'user-a' },
        })

        expect(result.opts).toEqual({ mode: 'fast', retry: 8, debug: true })
        expect(result.ctx.envs).toMatchObject({
          A: 'base-file',
          B: 'variant-file',
          C: 'variant-inline',
          D: 'variant-file',
          E: 'variant-inline',
        })
      })
    })

    it('should apply defaultVariant when selector has no variant segment', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            profiles: {
              dev: {
                opts: { mode: 'base' },
                envs: {},
                defaultVariant: 'local',
                variants: {
                  local: {
                    opts: { mode: 'local' },
                  },
                },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        const run = new Command({ desc: 'run' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })
        root.subcommand('run', run)

        const result = await root.parse({
          argv: ['run', `--preset-file=${presetFile}`, '--preset-profile=dev'],
          envs: {},
        })
        expect(result.opts).toEqual({ mode: 'local' })
      })
    })

    it('should allow defaults.profile to select profile:variant', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev:ci' },
            profiles: {
              dev: {
                opts: { mode: 'base' },
                envs: {},
                variants: {
                  ci: {
                    opts: { mode: 'ci' },
                  },
                },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        const run = new Command({ desc: 'run' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })
        root.subcommand('run', run)

        const result = await root.parse({
          argv: ['run', `--preset-file=${presetFile}`],
          envs: {},
        })
        expect(result.opts).toEqual({ mode: 'ci' })
      })
    })

    it('should resolve envFile relative to preset file directory', async () => {
      await withTempDir(async tmpDir => {
        const profileDir = path.join(tmpDir, 'profiles')
        const envDir = path.join(profileDir, 'env')
        await mkdir(envDir, { recursive: true })

        const presetFile = path.join(profileDir, 'preset.json')
        await writeFile(path.join(envDir, 'dev.env'), 'API_URL=https://dev.example.com\n')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envFile: 'env/dev.env',
                envs: {},
                opts: {},
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        root.subcommand('run', new Command({ desc: 'run' }))
        const result = await root.parse({ argv: ['run', `--preset-file=${presetFile}`], envs: {} })

        expect(result.ctx.envs.API_URL).toBe('https://dev.example.com')
      })
    })

    it('should resolve dot envFile relative to absolute preset file path', async () => {
      await withTempDir(async tmpDir => {
        const configDir = path.join(tmpDir, 'home', 'alice', '.config', 'sora')
        await mkdir(configDir, { recursive: true })

        const presetFile = path.join(configDir, 'presets.json')
        await writeFile(path.join(configDir, '.env.local'), 'MODE=local\n')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envFile: '.env.local',
                envs: {},
                opts: {},
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        root.subcommand('run', new Command({ desc: 'run' }))
        const result = await root.parse({ argv: ['run', `--preset-file=${presetFile}`], envs: {} })

        expect(result.ctx.envs.MODE).toBe('local')
      })
    })

    it('should treat removed preset directives as unknown options', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(cmd.parse({ argv: ['--preset-opts=./x.opt'], envs: {} })).rejects.toThrow(
        'unknown option',
      )
      await expect(cmd.parse({ argv: ['--preset-envs=./x.env'], envs: {} })).rejects.toThrow(
        'unknown option',
      )
    })

    it('run short-circuit should not read preset files', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await cmd.run({
        argv: ['--help', '--preset-file=./not-found.preset.json'],
        envs: {},
      })

      expect(logSpy).toHaveBeenCalledOnce()
      expect(process.exit).not.toHaveBeenCalled()
    })

    it('should throw when preset directive misses value', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(cmd.parse({ argv: ['--preset-file'], envs: {} })).rejects.toThrow(
        'missing value for "--preset-file"',
      )
      await expect(cmd.parse({ argv: ['--preset-profile'], envs: {} })).rejects.toThrow(
        'missing value for "--preset-profile"',
      )
    })

    it('should require --preset-file when --preset-profile is provided', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(cmd.parse({ argv: ['--preset-profile=dev'], envs: {} })).rejects.toThrow(
        'cannot use "--preset-profile" without "--preset-file"',
      )
    })

    it('should validate preset file availability for CLI directives', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(
        cmd.parse({ argv: ['--preset-file=./not-found.preset.json'], envs: {} }),
      ).rejects.toThrow('failed to read preset file')

      await withTempDir(async tmpDir => {
        const cmdInDir = new Command({ name: 'cli', desc: 'cli' })
        await expect(
          cmdInDir.parse({ argv: [`--preset-file=${tmpDir}`], envs: {} }),
        ).rejects.toThrow('failed to read preset file')
      })
    })

    it('should reject unknown profile and allow any routed command', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envs: {},
                opts: {},
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        root.subcommand('build', new Command({ desc: 'build' }))

        const result = await root.parse({
          argv: ['build', `--preset-file=${presetFile}`],
          envs: {},
        })
        expect(result.ctx.cmd.description).toBe('build')

        await expect(
          root.parse({
            argv: ['build', `--preset-file=${presetFile}`, '--preset-profile=prod'],
            envs: {},
          }),
        ).rejects.toThrow('unknown preset profile')
      })
    })

    it('should reject unknown preset variant', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            profiles: {
              dev: {
                envs: {},
                opts: {},
                variants: {
                  local: {
                    opts: {},
                  },
                },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        root.subcommand('run', new Command({ desc: 'run' }))

        await expect(
          root.parse({
            argv: ['run', `--preset-file=${presetFile}`, '--preset-profile=dev:missing'],
            envs: {},
          }),
        ).rejects.toThrow('unknown preset variant')
      })
    })

    it('should reject invalid defaultVariant reference in profile manifest', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envs: {},
                opts: {},
                defaultVariant: 'local',
                variants: {
                  ci: {
                    opts: {},
                  },
                },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        root.subcommand('run', new Command({ desc: 'run' }))

        await expect(
          root.parse({
            argv: ['run', `--preset-file=${presetFile}`],
            envs: {},
          }),
        ).rejects.toThrow('defaultVariant "local" is not found in variants')
      })
    })

    it('should reject malformed preset profile selector', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(
        cmd.parse({ argv: ['--preset-file=./preset.json', '--preset-profile=dev:a:b'], envs: {} }),
      ).rejects.toThrow('must be "<profile>" or "<profile>:<variant>"')
    })

    it('should apply profile on alias route without suitability restriction', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'alias' },
            profiles: {
              alias: {
                envs: {},
                opts: { mode: 'fast' },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        const build = new Command({ desc: 'build' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })
        root.subcommand('build', build)
        root.subcommand('b', build)

        const result = await root.parse({ argv: ['b', `--preset-file=${presetFile}`], envs: {} })
        expect(result.opts).toEqual({ mode: 'fast' })
      })
    })

    it('should reject invalid preset file JSON', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'broken.preset.json')
        await writeFile(presetFile, '{invalid}')
        const cmd = new Command({ name: 'cli', desc: 'cli' })
        await expect(
          cmd.parse({ argv: [`--preset-file=${presetFile}`], envs: {} }),
        ).rejects.toThrow('failed to parse preset file')
      })
    })

    it('should wrap invalid profile envFile parse error as configuration error', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(path.join(tmpDir, 'broken.env'), 'BROKEN="unterminated\n')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envFile: 'broken.env',
                envs: {},
                opts: {},
              },
            },
          }),
        )

        const cmd = new Command({ name: 'cli', desc: 'cli' })
        await expect(
          cmd.parse({ argv: [`--preset-file=${presetFile}`], envs: {} }),
        ).rejects.toThrow('failed to parse preset env file')
      })
    })

    it('should forbid preset directives inside profile opts generated tokens', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                opts: { mode: '--preset-file=./x.json' },
                envs: {},
              },
            },
          }),
        )

        const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })

        await expect(
          cmd.parse({ argv: [`--preset-file=${presetFile}`], envs: {} }),
        ).rejects.toThrow('preset directive')
      })
    })

    it('should report parse-stage error for invalid preset option fragment payload', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                opts: { silent: ['orphan'] },
                envs: {},
              },
            },
          }),
        )

        const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
          long: 'silent',
          type: 'boolean',
          args: 'none',
          desc: 'silent',
        })

        await expect(
          cmd.parse({ argv: [`--preset-file=${presetFile}`], envs: {} }),
        ).rejects.toThrow('unexpected argument')
      })
    })

    it('should treat --preset-* after -- as plain args', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).argument({
        name: 'items',
        kind: 'variadic',
        type: 'string',
        desc: 'items',
      })

      const result = await cmd.parse({
        argv: ['--', '--preset-file=/x/preset.json', '--preset-profile=dev', '--preset-root=/x'],
        envs: {},
      })

      expect(result.args).toEqual({
        items: ['--preset-file=/x/preset.json', '--preset-profile=dev', '--preset-root=/x'],
      })
    })

    it('should treat --preset-root as unknown option', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(cmd.parse({ argv: ['--preset-root=/x'], envs: {} })).rejects.toThrow(
        'unknown option',
      )
    })
  })

  describe('reserved names', () => {
    it('should reject reserved option long names help/version/devmode', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      expect(() =>
        cmd.option({ long: 'help', type: 'boolean', args: 'none', desc: 'invalid' }),
      ).toThrow('reserved')
      expect(() =>
        cmd.option({ long: 'version', type: 'boolean', args: 'none', desc: 'invalid' }),
      ).toThrow('reserved')
      expect(() =>
        cmd.option({ long: 'devmode', type: 'boolean', args: 'none', desc: 'invalid' }),
      ).toThrow('reserved')
    })

    it('should reject reserved subcommand name help', () => {
      const root = new Command({ name: 'cli', desc: 'cli' })
      expect(() => root.subcommand('help', new Command({ desc: 'bad' }))).toThrow('reserved')
    })
  })

  describe('builtin version toggles', () => {
    it('should disable builtin version when builtin is false', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli', version: '1.0.0', builtin: false })
      await expect(cmd.parse({ argv: ['--version'], envs: {} })).rejects.toThrow('unknown option')
    })

    it('should disable builtin version when builtin.option.version is false', async () => {
      const cmd = new Command({
        name: 'cli',
        desc: 'cli',
        version: '1.0.0',
        builtin: { option: { version: false } },
      })
      await expect(cmd.parse({ argv: ['--version'], envs: {} })).rejects.toThrow('unknown option')
    })
  })

  describe('error type', () => {
    it('should throw CommanderError for command parse errors', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      try {
        await cmd.parse({ argv: ['--unknown'], envs: {} })
        throw new Error('expected parse to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(CommanderError)
      }
    })

    it('help formatting should include built-in controls', async () => {
      const root = new Command({ name: 'cli', desc: 'cli', version: '1.0.0' })
      const text = root.formatHelp()
      expect(text).toContain('--help')
      expect(text).toContain('--version')
      expect(text).not.toContain('--no-help')
      expect(text).not.toContain('--no-version')
    })

    it('should expose original builtin config', async () => {
      const root = new Command({
        name: 'cli',
        desc: 'cli',
        builtin: { option: { version: false, color: true } },
      })

      expect(root.builtin).toEqual({ option: { version: false, color: true } })
    })

    it('should apply NO_COLOR fallback when no explicit color token is provided', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      const result = await cmd.parse({ argv: [], envs: { NO_COLOR: '1' } })
      expect(result.ctx.envs.NO_COLOR).toBe('1')
    })

    it('should keep sources.user.cmds with alias token', async () => {
      const root = new Command({ name: 'cli', desc: 'cli' })
      const start = new Command({ desc: 'start' })
      root.subcommand('start', start)
      root.subcommand('s', start)

      const result = await root.parse({ argv: ['s'], envs: {} })
      expect(result.ctx.sources.user.cmds).toEqual(['s'])
    })

    it('should expose frozen source snapshots on parse result', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      const result = await cmd.parse({ argv: [], envs: { FOO: 'bar' } })

      expect(Object.isFrozen(result.ctx.sources)).toBe(true)
      expect(Object.isFrozen(result.ctx.sources.preset.argv)).toBe(true)
      expect(Object.isFrozen(result.ctx.sources.user.argv)).toBe(true)
      expect(Object.isFrozen(result.ctx.sources.user.envs)).toBe(true)
    })
  })

  describe('coverage: tokenize and parser edge cases', () => {
    it('should support kebab-case input for camelCase long option', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'dryRun',
        type: 'boolean',
        args: 'none',
        desc: 'dry run',
      })

      const result = await cmd.parse({ argv: ['--dry-run'], envs: {} })
      expect(result.opts).toEqual({ dryRun: true })
    })

    it('should reject long option containing underscore', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'dryRun',
        type: 'boolean',
        args: 'none',
        desc: 'dry run',
      })

      await expect(cmd.parse({ argv: ['--dry_run'], envs: {} })).rejects.toThrow(
        "use '-' instead of '_'",
      )
    })

    it('should reject invalid negative option syntax --no and --no-', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })

      await expect(cmd.parse({ argv: ['--no'], envs: {} })).rejects.toThrow(
        'invalid negative option syntax',
      )
      await expect(cmd.parse({ argv: ['--no-'], envs: {} })).rejects.toThrow(
        'invalid negative option syntax',
      )
    })

    it('should reject invalid negative option format', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        desc: 'verbose',
      })

      await expect(cmd.parse({ argv: ['--no--verbose'], envs: {} })).rejects.toThrow(
        'invalid option format',
      )
    })

    it('should reject negative option with inline value', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(cmd.parse({ argv: ['--no-color=true'], envs: {} })).rejects.toThrow(
        'does not accept a value',
      )
    })

    it('should reject invalid long option format', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(cmd.parse({ argv: ['--bad-'], envs: {} })).rejects.toThrow(
        'invalid option format',
      )
    })

    it('should reject unsupported short syntax with equals', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'output',
        short: 'o',
        type: 'string',
        args: 'required',
        desc: 'output',
      })

      await expect(cmd.parse({ argv: ['-o=file.txt'], envs: {} })).rejects.toThrow('not supported')
    })

    it('should reject --no-* for non-boolean option', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'output',
        type: 'string',
        args: 'required',
        desc: 'output',
      })

      await expect(cmd.parse({ argv: ['--no-output'], envs: {} })).rejects.toThrow(
        'can only be used with boolean options',
      )
    })

    it('should reject invalid boolean inline value', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        desc: 'verbose',
      })

      await expect(cmd.parse({ argv: ['--verbose=maybe'], envs: {} })).rejects.toThrow(
        'Use "true" or "false"',
      )
    })

    it('should reject missing required option value', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'output',
        type: 'string',
        args: 'required',
        desc: 'output',
      })

      await expect(cmd.parse({ argv: ['--output'], envs: {} })).rejects.toThrow('requires a value')
    })

    it('should parse optional option values and keep key presence semantics', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'write',
        short: 'w',
        type: 'string',
        args: 'optional',
        desc: 'write',
      })

      const absent = await cmd.parse({ argv: [], envs: {} })
      expect(Object.prototype.hasOwnProperty.call(absent.opts, 'write')).toBe(false)
      expect(absent.opts['write']).toBeUndefined()

      const bareLong = await cmd.parse({ argv: ['--write'], envs: {} })
      expect(Object.prototype.hasOwnProperty.call(bareLong.opts, 'write')).toBe(true)
      expect(bareLong.opts['write']).toBeUndefined()

      const emptyEq = await cmd.parse({ argv: ['--write='], envs: {} })
      expect(Object.prototype.hasOwnProperty.call(emptyEq.opts, 'write')).toBe(true)
      expect(emptyEq.opts['write']).toBe('')

      const withValue = await cmd.parse({ argv: ['--write', 'out.fish'], envs: {} })
      expect(withValue.opts['write']).toBe('out.fish')

      const withEqValue = await cmd.parse({ argv: ['--write=out.fish'], envs: {} })
      expect(withEqValue.opts['write']).toBe('out.fish')

      const shortBare = await cmd.parse({ argv: ['-w'], envs: {} })
      expect(Object.prototype.hasOwnProperty.call(shortBare.opts, 'write')).toBe(true)
      expect(shortBare.opts['write']).toBeUndefined()
    })

    it('should not fallback to default when optional option is explicitly passed without value', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'write',
        type: 'string',
        args: 'optional',
        desc: 'write',
        default: 'default-path',
      })

      const absent = await cmd.parse({ argv: [], envs: {} })
      expect(absent.opts['write']).toBe('default-path')

      const bare = await cmd.parse({ argv: ['--write'], envs: {} })
      expect(Object.prototype.hasOwnProperty.call(bare.opts, 'write')).toBe(true)
      expect(bare.opts['write']).toBeUndefined()
    })

    it('should not trigger apply when optional option value is undefined', async () => {
      const applySpy = vi.fn()
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'write',
        type: 'string',
        args: 'optional',
        desc: 'write',
        apply: applySpy,
      })

      await cmd.parse({ argv: ['--write'], envs: {} })
      expect(applySpy).not.toHaveBeenCalled()

      await cmd.parse({ argv: ['--write='], envs: {} })
      expect(applySpy).toHaveBeenCalledWith('', expect.anything())
    })

    it('should parse inline variadic value for option', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
        .option({
          long: 'files',
          type: 'string',
          args: 'variadic',
          desc: 'files',
        })
        .argument({ name: 'rest', kind: 'variadic', type: 'string', desc: 'rest' })

      const result = await cmd.parse({ argv: ['--files=first', 'a', 'b'], envs: {} })
      expect(result.opts).toEqual({ files: ['first'] })
      expect(result.args).toEqual({ rest: ['a', 'b'] })
    })

    it('should parse variadic short option greedily', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'files',
        short: 'f',
        type: 'string',
        args: 'variadic',
        desc: 'files',
      })

      const result = await cmd.parse({ argv: ['-f', 'a', 'b', 'c'], envs: {} })
      expect(result.opts).toEqual({ files: ['a', 'b', 'c'] })
    })

    it('should keep empty array when variadic option has no trailing values', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'files',
        type: 'string',
        args: 'variadic',
        desc: 'files',
      })

      const result = await cmd.parse({ argv: ['--files'], envs: {} })
      expect(result.opts).toEqual({ files: [] })
    })

    it('should reject missing required option value when next token is another option', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
        .option({ long: 'output', type: 'string', args: 'required', desc: 'output' })
        .option({ long: 'verbose', type: 'boolean', args: 'none', desc: 'verbose' })

      await expect(cmd.parse({ argv: ['--output', '--verbose'], envs: {} })).rejects.toThrow(
        'requires a value',
      )
    })

    it('should reject missing required option', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'config',
        type: 'string',
        args: 'required',
        required: true,
        desc: 'config',
      })

      await expect(cmd.parse({ argv: [], envs: {} })).rejects.toThrow('missing required option')
    })

    it('should reject invalid choice value', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'mode',
        type: 'string',
        args: 'required',
        choices: ['dev', 'prod'],
        desc: 'mode',
      })

      await expect(cmd.parse({ argv: ['--mode', 'test'], envs: {} })).rejects.toThrow(
        'Allowed: dev, prod',
      )
    })

    it('should reject invalid number for option', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'port',
        type: 'number',
        args: 'required',
        desc: 'port',
      })

      await expect(cmd.parse({ argv: ['--port', 'abc'], envs: {} })).rejects.toThrow(
        'invalid number',
      )
    })

    it('should parse JS primitive number literals for options and enforce negative-value boundary', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'port',
        short: 'p',
        type: 'number',
        args: 'required',
        desc: 'port',
      })

      const samples = [
        '1e3',
        '0x10',
        '0b1010',
        '0o10',
        '+1',
        '.5',
        '1.',
        '1.5',
        '1.5e2',
        '1_000',
        '-1',
      ]
      for (const sample of samples) {
        const result = await cmd.parse({ argv: [`--port=${sample}`], envs: {} })
        expect(result.opts.port).toBe(Number(sample.replaceAll('_', '')))
      }

      await expect(cmd.parse({ argv: ['--port', '-1'], envs: {} })).rejects.toThrow(
        'requires a value',
      )
      await expect(cmd.parse({ argv: ['--port=+0x10'], envs: {} })).rejects.toThrow(
        'invalid number',
      )
      await expect(cmd.parse({ argv: ['--port=-0x10'], envs: {} })).rejects.toThrow(
        'invalid number',
      )
      await expect(cmd.parse({ argv: ['-p=-1'], envs: {} })).rejects.toThrow('is not supported')
    })

    it('should reject non-primitive JS number literal syntax for option numbers', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'port',
        type: 'number',
        args: 'required',
        desc: 'port',
      })

      const invalidSamples = [
        '',
        ' 1',
        '1 ',
        'NaN',
        'Infinity',
        '-Infinity',
        '+',
        '-',
        '1e',
        '1e+',
        '1.2.3',
        '1__0',
        '1_.0',
        '1._0',
        '_1',
        '1_',
        '0b2',
        '0o8',
        '0xg',
        '1e309',
      ]

      for (const sample of invalidSamples) {
        await expect(cmd.parse({ argv: [`--port=${sample}`], envs: {} })).rejects.toThrow(
          'invalid number',
        )
      }
    })

    it('should parse optional argument default and reject too many args', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
        .argument({ name: 'input', kind: 'required', type: 'string', desc: 'input' })
        .argument({
          name: 'output',
          kind: 'optional',
          type: 'string',
          desc: 'output',
          default: 'dist.txt',
        })

      const result = await cmd.parse({ argv: ['a.txt'], envs: {} })
      expect(result.args).toEqual({ input: 'a.txt', output: 'dist.txt' })

      await expect(cmd.parse({ argv: ['a', 'b', 'c'], envs: {} })).rejects.toThrow(
        'too many arguments',
      )
    })

    it('should enforce some argument cardinality', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).argument({
        name: 'files',
        kind: 'some',
        type: 'string',
        desc: 'files',
      })

      await expect(cmd.parse({ argv: [], envs: {} })).rejects.toThrow('missing required argument')

      const result = await cmd.parse({ argv: ['a.txt', 'b.txt'], envs: {} })
      expect(result.args).toEqual({ files: ['a.txt', 'b.txt'] })
    })

    it('should validate argument choice and coerce result type', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
        .argument({
          name: 'mode',
          kind: 'required',
          type: 'choice',
          choices: ['safe', 'force'],
          desc: 'mode',
        })
        .argument({
          name: 'target',
          kind: 'optional',
          type: 'string',
          desc: 'target',
          coerce: raw => {
            if (raw === 'bad') {
              throw new Error('bad')
            }
            if (raw === 'typed') {
              return 123 as unknown as string
            }
            return raw
          },
        })

      await expect(cmd.parse({ argv: ['abc'], envs: {} })).rejects.toThrow('invalid value "abc"')
      await expect(cmd.parse({ argv: ['safe', 'bad'], envs: {} })).rejects.toThrow(
        'invalid value "bad"',
      )
      await expect(cmd.parse({ argv: ['safe', 'typed'], envs: {} })).rejects.toThrow(
        'expected string',
      )

      const result = await cmd.parse({ argv: ['force', 'ok'], envs: {} })
      expect(result.args).toEqual({ mode: 'force', target: 'ok' })
    })
  })

  describe('coverage: builtins and definitions', () => {
    it('should resolve builtin config variants', async () => {
      const withBuiltinTrue = new Command({
        name: 'cli',
        desc: 'cli',
        builtin: true,
        version: '1.0.0',
      })
      await expect(withBuiltinTrue.parse({ argv: ['--version'], envs: {} })).resolves.toBeDefined()

      const withBuiltinOptionsTrue = new Command({
        name: 'cli',
        desc: 'cli',
        builtin: { option: true },
      })
      await expect(
        withBuiltinOptionsTrue.parse({ argv: ['--log-level', 'warn'], envs: {} }),
      ).resolves.toBeDefined()

      const withBuiltinOptionsFalse = new Command({
        name: 'cli',
        desc: 'cli',
        builtin: { option: false },
      })
      await expect(
        withBuiltinOptionsFalse.parse({ argv: ['--log-level', 'warn'], envs: {} }),
      ).rejects.toThrow('unknown option')

      const partialBuiltin = new Command({
        name: 'cli',
        desc: 'cli',
        builtin: {
          option: {
            version: false,
            color: false,
            devmode: false,
            logLevel: false,
            silent: false,
            logDate: false,
            logColorful: false,
          },
        },
      })
      await expect(partialBuiltin.parse({ argv: ['--color'], envs: {} })).rejects.toThrow(
        'unknown option',
      )
    })

    it('should set builtin log level to debug when devmode is enabled without explicit log level', async () => {
      const reporter = {
        setLevel: vi.fn(),
        setFlight: vi.fn(),
      }
      const cmd = new Command({ name: 'cli', desc: 'cli' })

      await cmd.parse({ argv: ['--devmode'], envs: {}, reporter: reporter as any })

      expect(reporter.setLevel).toHaveBeenCalledTimes(1)
      expect(reporter.setLevel).toHaveBeenCalledWith('debug')
    })

    it('should keep explicit log level when devmode is enabled', async () => {
      const reporter = {
        setLevel: vi.fn(),
        setFlight: vi.fn(),
      }
      const cmd = new Command({ name: 'cli', desc: 'cli' })

      await cmd.parse({
        argv: ['--devmode', '--log-level', 'warn'],
        envs: {},
        reporter: reporter as any,
      })

      expect(reporter.setLevel).toHaveBeenCalledTimes(1)
      expect(reporter.setLevel).toHaveBeenCalledWith('warn')
    })

    it('should support preset opts enabling devmode default log level', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envs: {},
                opts: { devmode: true },
              },
            },
          }),
        )

        const reporter = {
          setLevel: vi.fn(),
          setFlight: vi.fn(),
        }
        const cmd = new Command({ name: 'cli', desc: 'cli' })

        await cmd.parse({
          argv: [`--preset-file=${presetFile}`],
          envs: {},
          reporter: reporter as any,
        })

        expect(reporter.setLevel).toHaveBeenCalledTimes(1)
        expect(reporter.setLevel).toHaveBeenCalledWith('debug')
      })
    })

    it('should keep explicit preset logLevel when preset devmode is enabled', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envs: {},
                opts: { devmode: true, logLevel: 'error' },
              },
            },
          }),
        )

        const reporter = {
          setLevel: vi.fn(),
          setFlight: vi.fn(),
        }
        const cmd = new Command({ name: 'cli', desc: 'cli' })

        await cmd.parse({
          argv: [`--preset-file=${presetFile}`],
          envs: {},
          reporter: reporter as any,
        })

        expect(reporter.setLevel).toHaveBeenCalledTimes(1)
        expect(reporter.setLevel).toHaveBeenCalledWith('error')
      })
    })

    it('parse result should expose builtin.devmode and keep opts contract unchanged', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      const result = await cmd.parse({ argv: ['--devmode'], envs: {} })

      expect(result.builtin.devmode).toBe(true)
      expect(result.opts['devmode']).toBeUndefined()
    })

    it('parse result should always expose builtin.devmode with default false', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      const result = await cmd.parse({ argv: [], envs: {} })

      expect(result.builtin.devmode).toBe(false)
    })

    it('parse result should expose builtin.devmode=false when builtin option is disabled', async () => {
      const cmd = new Command({
        name: 'cli',
        desc: 'cli',
        builtin: { option: { devmode: false } },
      })
      const result = await cmd.parse({ argv: [], envs: {} })

      expect(result.builtin.devmode).toBe(false)
    })

    it('action params should expose builtin.devmode as params.builtin.devmode', async () => {
      let seen: boolean | undefined
      const cmd = new Command({ name: 'cli', desc: 'cli' }).action(({ builtin }) => {
        seen = builtin.devmode
      })

      await cmd.run({ argv: ['--devmode'], envs: {} })

      expect(seen).toBe(true)
    })

    it('should expose defensive getters', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli', version: '1.0.0' })
      cmd.option({ long: 'verbose', type: 'boolean', args: 'none', short: 'v', desc: 'verbose' })
      cmd.argument({ name: 'input', kind: 'required', type: 'string', desc: 'input' })
      cmd.example('Title', 'run', 'desc')

      const options = cmd.options
      const args = cmd.arguments
      const examples = cmd.examples

      options.push({ long: 'foo', type: 'boolean', args: 'none', desc: 'foo' })
      args.push({ name: 'x', kind: 'optional', type: 'string', desc: 'x' })
      examples[0].title = 'Mutated'

      expect(cmd.version).toBe('1.0.0')
      expect(cmd.options).toHaveLength(1)
      expect(cmd.arguments).toHaveLength(1)
      expect(cmd.examples[0].title).toBe('Title')
      expect(cmd.parent).toBeUndefined()
      expect(cmd.subcommands.size).toBe(0)
    })

    it('should include built-in control options in completion metadata', () => {
      const withVersion = new Command({ name: 'cli', desc: 'cli', version: '1.0.0' })
      const withVersionOptions = withVersion.getCompletionMeta().options.map(option => option.long)
      expect(withVersionOptions).toContain('help')
      expect(withVersionOptions).toContain('version')

      const withoutVersion = new Command({
        name: 'cli',
        desc: 'cli',
        version: '1.0.0',
        builtin: { option: { version: false } },
      })
      const withoutVersionOptions = withoutVersion
        .getCompletionMeta()
        .options.map(option => option.long)
      expect(withoutVersionOptions).toContain('help')
      expect(withoutVersionOptions).not.toContain('version')
    })

    it('should reject subcommand parent conflict and keep aliases unique', () => {
      const root1 = new Command({ name: 'cli1', desc: 'cli1' })
      const root2 = new Command({ name: 'cli2', desc: 'cli2' })
      const sub = new Command({ desc: 'sub' })

      root1.subcommand('build', sub)
      expect(() => root2.subcommand('build', sub)).toThrow('already has a parent')

      root1.subcommand('b', sub)
      root1.subcommand('b', sub)
      root1.subcommand('build', sub)

      const other = new Command({ desc: 'other' })
      expect(() => root1.subcommand('build', other)).toThrow('conflicts with an existing command')
      expect(() => root1.subcommand('b', other)).toThrow('conflicts with an existing command')

      const meta = root1.getCompletionMeta()
      expect(meta.subcommands.find(item => item.name === 'build')?.aliases).toEqual(['b'])
    })

    it('should validate option and argument definitions', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })

      expect(() =>
        cmd.option({ long: 'verbose', type: 'boolean', args: 'required', desc: 'verbose' }),
      ).toThrow("must have args: 'none'")
      expect(() =>
        cmd.option({ long: 'output', type: 'string', args: 'none', desc: 'output' }),
      ).toThrow("must have args: 'required', 'optional', or 'variadic'")
      expect(() =>
        cmd.option({ long: 'port', type: 'number', args: 'optional', desc: 'port' }),
      ).toThrow("does not support args: 'optional'")
      expect(() =>
        cmd.option({ long: 'noOutput', type: 'boolean', args: 'none', desc: 'bad' }),
      ).toThrow('cannot start with "no"')
      expect(() =>
        cmd.option({ long: 'Output', type: 'boolean', args: 'none', desc: 'bad' }),
      ).toThrow('must be camelCase')
      expect(() =>
        cmd.option({
          long: 'config',
          type: 'string',
          args: 'required',
          required: true,
          default: 'a',
          desc: 'c',
        }),
      ).toThrow('cannot be both required and have a default')
      expect(() =>
        cmd.option({
          long: 'silentMode',
          type: 'boolean',
          args: 'none',
          required: true,
          desc: 's',
        }),
      ).toThrow('cannot be required')
      expect(() =>
        cmd.option({
          long: 'target',
          type: 'string',
          args: 'optional',
          required: true,
          desc: 'target',
        }),
      ).toThrow("must use args: 'required'")
      expect(() =>
        cmd.option({
          long: 'tags',
          type: 'string',
          args: 'variadic',
          required: true,
          desc: 'tags',
        }),
      ).toThrow("must use args: 'required'")

      cmd.option({ long: 'uniqueLong', short: 'u', type: 'boolean', args: 'none', desc: 'u' })
      expect(() =>
        cmd.option({ long: 'uniqueLong', short: 'x', type: 'boolean', args: 'none', desc: 'dup' }),
      ).toThrow('already defined')
      expect(() =>
        cmd.option({ long: 'otherLong', short: 'u', type: 'boolean', args: 'none', desc: 'dup' }),
      ).toThrow('already defined')
      expect(() =>
        cmd.option({ long: 'badShort', short: 'ab', type: 'boolean', args: 'none', desc: 'bad' }),
      ).toThrow('must be a single character')

      expect(() =>
        cmd.argument({
          name: 'input',
          kind: 'required',
          type: 'string',
          desc: 'input',
          default: 'x',
        }),
      ).toThrow('only optional argument')

      const argsCmd = new Command({ name: 'args', desc: 'args' })
      argsCmd.argument({ name: 'first', kind: 'optional', type: 'string', desc: 'first' })
      expect(() =>
        argsCmd.argument({ name: 'required', kind: 'required', type: 'string', desc: 'required' }),
      ).toThrow('cannot come after optional/variadic')

      const variadicCmd = new Command({ name: 'variadic', desc: 'variadic' })
      variadicCmd.argument({ name: 'files', kind: 'variadic', type: 'string', desc: 'files' })
      expect(() =>
        variadicCmd.argument({ name: 'next', kind: 'optional', type: 'string', desc: 'next' }),
      ).toThrow('variadic/some argument must be the last argument')

      const multiVariadicCmd = new Command({ name: 'multi', desc: 'multi' })
      multiVariadicCmd.argument({ name: 'files', kind: 'variadic', type: 'string', desc: 'files' })
      expect(() =>
        multiVariadicCmd.argument({ name: 'more', kind: 'variadic', type: 'string', desc: 'more' }),
      ).toThrow('only one variadic/some argument is allowed')

      expect(() =>
        cmd.argument({
          name: 'mode',
          kind: 'optional',
          type: 'choice',
          desc: 'mode',
        }),
      ).toThrow('must declare a non-empty choices array')

      expect(() =>
        cmd.argument({
          name: 'label',
          kind: 'optional',
          type: 'string',
          choices: ['a'],
          desc: 'label',
        }),
      ).toThrow('cannot declare choices')

      expect(() =>
        cmd.argument({
          name: 'channel',
          kind: 'optional',
          type: 'choice',
          choices: ['dev', 'prod'],
          default: 'test',
          desc: 'channel',
        }),
      ).toThrow('must be one of declared choices')

      expect(() =>
        cmd.argument({
          name: 'mode',
          kind: 'optional',
          type: 'choice',
          choices: ['dev', 1 as unknown as string],
          desc: 'mode',
        }),
      ).toThrow('choices must be string[]')

      expect(() =>
        cmd.argument({
          name: 'out',
          kind: 'optional',
          type: 'string',
          default: 1 as unknown as string,
          desc: 'out',
        }),
      ).toThrow('must match type')

      expect(() =>
        cmd.argument({
          name: 'broken',
          kind: 'optional',
          type: 'invalid' as unknown as 'string',
          desc: 'broken',
        }),
      ).toThrow('must specify a valid type')

      expect(() =>
        cmd.argument({
          name: 'badKind',
          kind: 'invalid' as unknown as 'required',
          type: 'string',
          desc: 'badKind',
        }),
      ).toThrow('must specify a valid kind')
    })

    it('should validate example payloads', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      expect(() => cmd.example('   ', 'run', 'desc')).toThrow('example title cannot be empty')
      expect(() => cmd.example('Title', '   ', 'desc')).toThrow('example usage cannot be empty')
      expect(() => cmd.example('Title', 'run', '   ')).toThrow(
        'example description cannot be empty',
      )
    })
  })

  describe('coverage: run/help/control/preset flows', () => {
    it('should show help when leaf has subcommands but no action', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', desc: 'cli' })
      root.subcommand('build', new Command({ desc: 'build' }))

      await root.run({ argv: [], envs: {} })
      expect(String(logSpy.mock.calls[0]?.[0] ?? '')).toContain('Commands:')
    })

    it('should exit with code 2 when no action and no subcommands', async () => {
      mockProcessExit()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await cmd.run({ argv: [], envs: {} })

      expect(errorSpy).toHaveBeenCalledOnce()
      expect(process.exit).toHaveBeenCalledWith(2)
    })

    it('should rethrow non-CommanderError in run flow', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'port',
        type: 'number',
        args: 'required',
        desc: 'port',
        coerce: () => {
          throw new TypeError('coerce failed')
        },
      })

      await expect(cmd.run({ argv: ['--port', '80'], envs: {} })).rejects.toThrow(TypeError)
    })

    it('should render styled help in tty with commands/options/examples', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', desc: 'cli root' })
        .option({ long: 'verbose', short: 'v', type: 'boolean', args: 'none', desc: 'verbose' })
        .argument({ name: 'input', kind: 'optional', type: 'string', desc: 'input' })
        .example('Quick Start', 'build src.ts', 'build one file')
      const sub = new Command({ desc: 'build subcommand' })
      root.subcommand('build', sub).subcommand('b', sub)

      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as { isTTY?: boolean }).isTTY = true
      try {
        await root.run({ argv: ['--help'], envs: {} })
      } finally {
        ;(process.stdout as { isTTY?: boolean }).isTTY = originalIsTTY
      }

      const output = String(logSpy.mock.calls[0]?.[0] ?? '')
      expect(output).toContain('\u001b[')
      expect(output).toContain('Options:')
      expect(output).toContain('Commands:')
      expect(output).toContain('Examples:')
      expect(output).toContain('build, b')
    })

    it('should render plain help when color disabled by token/env or color option missing', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const cmd = new Command({ name: 'cli', desc: 'cli' })
      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as { isTTY?: boolean }).isTTY = true
      try {
        await cmd.run({ argv: ['--help', '--no-color'], envs: {} })
        expect(String(logSpy.mock.calls[0]?.[0] ?? '')).not.toContain('\u001b[')

        logSpy.mockClear()
        await cmd.run({ argv: ['--help', '--color'], envs: { NO_COLOR: '1' } })
        expect(String(logSpy.mock.calls[0]?.[0] ?? '')).toContain('\u001b[')

        logSpy.mockClear()
        await cmd.run({ argv: ['--help', '--color=false'], envs: {} })
        expect(String(logSpy.mock.calls[0]?.[0] ?? '')).not.toContain('\u001b[')

        logSpy.mockClear()
        await cmd.run({ argv: ['--help', '--color=true'], envs: {} })
        expect(String(logSpy.mock.calls[0]?.[0] ?? '')).toContain('\u001b[')
      } finally {
        ;(process.stdout as { isTTY?: boolean }).isTTY = originalIsTTY
      }

      const noColorOptionCmd = new Command({
        name: 'plain',
        desc: 'plain',
        builtin: { option: { color: false } },
      })
      logSpy.mockClear()
      await noColorOptionCmd.run({ argv: ['--help'], envs: { NO_COLOR: '1' } })
      expect(String(logSpy.mock.calls[0]?.[0] ?? '')).not.toContain('\u001b[')
    })

    it('should report invalid help color token and exit 2', async () => {
      mockProcessExit()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await cmd.run({ argv: ['--help', '--color=auto'], envs: {} })

      expect(errorSpy).toHaveBeenCalledOnce()
      expect(process.exit).toHaveBeenCalledWith(2)
    })

    it('should parse help controls around -- separator correctly', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).argument({
        name: 'items',
        kind: 'variadic',
        type: 'string',
        desc: 'items',
      })

      const parseWithHelpSubcommand = await cmd.parse({ argv: ['help', '--help'], envs: {} })
      expect(parseWithHelpSubcommand.ctx.controls).toEqual({ help: true, version: false })

      const parseWithSeparator = await cmd.parse({ argv: ['--help', '--', '--version'], envs: {} })
      expect(parseWithSeparator.ctx.controls).toEqual({ help: true, version: false })
      expect(parseWithSeparator.args).toEqual({ items: ['--version'] })
    })

    it('should keep --version as normal token when leaf does not support builtin version', async () => {
      const root = new Command({ name: 'cli', desc: 'cli', version: '1.0.0' })
      const sub = new Command({ desc: 'sub' }).option({
        long: 'name',
        type: 'string',
        args: 'required',
        desc: 'name',
      })
      root.subcommand('sub', sub)

      await expect(root.parse({ argv: ['sub', '--version'], envs: {} })).rejects.toThrow(
        'unknown option',
      )
    })

    it('should detect --version as control on subcommand with version', async () => {
      const root = new Command({ name: 'cli', desc: 'cli', version: '1.0.0' })
      root.subcommand('sub', new Command({ desc: 'sub', version: '2.0.0' }))

      const result = await root.parse({ argv: ['sub', '--version'], envs: {} })
      expect(result.ctx.controls).toEqual({ help: false, version: true })
    })

    it('should reject short option conflicts across chain', async () => {
      const root = new Command({ name: 'cli', desc: 'cli' }).option({
        long: 'verbose',
        short: 'v',
        type: 'boolean',
        args: 'none',
        desc: 'verbose',
      })
      const sub = new Command({ desc: 'sub' }).option({
        long: 'versionCode',
        short: 'v',
        type: 'boolean',
        args: 'none',
        desc: 'versionCode',
      })
      root.subcommand('sub', sub)

      await expect(root.parse({ argv: ['sub', '-v'], envs: {} })).rejects.toThrow(
        'short option "-v" conflicts',
      )
    })

    it('should parse preset directives from both token styles and preserve -- tail', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(path.join(tmpDir, 'dev.env'), 'NAME=preset\n')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envFile: 'dev.env',
                envs: {},
                opts: { mode: 'fast' },
              },
              prod: {
                envs: {},
                opts: { mode: 'safe' },
              },
            },
          }),
        )

        const cmd = new Command({ name: 'cli', desc: 'cli' })
          .option({ long: 'mode', type: 'string', args: 'required', desc: 'mode' })
          .argument({ name: 'rest', kind: 'variadic', type: 'string', desc: 'rest' })

        const result = await cmd.parse({
          argv: ['--preset-file', presetFile, '--preset-profile=dev', '--', '--tail'],
          envs: { NAME: 'user' },
        })

        expect(result.opts).toEqual({ mode: 'fast' })
        expect(result.args).toEqual({ rest: ['--tail'] })
        expect(result.ctx.envs.NAME).toBe('preset')
      })
    })

    it('should validate preset directives and removed directive behavior', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })

      await expect(cmd.parse({ argv: ['--preset-file='], envs: {} })).rejects.toThrow(
        'missing value for "--preset-file"',
      )

      await expect(
        cmd.parse({ argv: ['--preset-file=./not-found.preset.json'], envs: {} }),
      ).rejects.toThrow('failed to read preset file')

      await expect(cmd.parse({ argv: ['--preset-envs=./x.env'], envs: {} })).rejects.toThrow(
        'unknown option',
      )
      await expect(cmd.parse({ argv: ['--preset-opts=./x.opt'], envs: {} })).rejects.toThrow(
        'unknown option',
      )
    })

    it('should reject unknown option from preset file at parse stage', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envs: {},
                opts: { unknownOption: true },
              },
            },
          }),
        )

        const cmd = new Command({ name: 'cli', desc: 'cli' })
        await expect(
          cmd.parse({ argv: [`--preset-file=${presetFile}`], envs: {} }),
        ).rejects.toThrow('unknown option')
      })
    })

    it('should not emit preset_token_injected when primary source is user', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envs: {},
                opts: { mode: 'fast' },
              },
            },
          }),
        )

        const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })

        try {
          await cmd.parse({ argv: [`--preset-file=${presetFile}`, '--bad-opt'], envs: {} })
          throw new Error('expected parse to throw')
        } catch (error) {
          expect(error).toBeInstanceOf(CommanderError)
          const commanderError = error as CommanderError
          expect(commanderError.kind).toBe('UnknownOption')
          const issues = commanderError.meta?.issues ?? []
          expect(
            issues.some(
              issue =>
                issue.kind === 'error' &&
                issue.reason.code === 'unknown_option' &&
                issue.source?.primary === 'user',
            ),
          ).toBe(true)
          expect(
            issues.some(
              issue => issue.kind === 'hint' && issue.reason.code === 'preset_token_injected',
            ),
          ).toBe(false)
        }
      })
    })

    it('should emit mixed_source_conflict hint when option conflict involves user and preset', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envs: {},
                opts: { bash: true },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        root.subcommand('completion', new CompletionCommand(root))

        await expect(
          root.parse({ argv: ['completion', `--preset-file=${presetFile}`, '--fish'], envs: {} }),
        ).rejects.toMatchObject({
          kind: 'OptionConflict',
          meta: {
            issues: expect.arrayContaining([
              expect.objectContaining({
                kind: 'error',
                reason: expect.objectContaining({ code: 'option_conflict' }),
                source: { related: ['user', 'preset'] },
                preset: expect.objectContaining({ profile: 'dev' }),
              }),
              expect.objectContaining({
                kind: 'hint',
                reason: expect.objectContaining({ code: 'mixed_source_conflict' }),
                source: { related: ['user', 'preset'] },
                preset: expect.objectContaining({ profile: 'dev' }),
              }),
              expect.objectContaining({
                kind: 'hint',
                reason: expect.objectContaining({ code: 'preset_token_injected' }),
              }),
            ]),
          },
        })
      })
    })

    it('should attach preset attribution for preset-only option conflict error issue', async () => {
      await withTempDir(async tmpDir => {
        const presetFile = path.join(tmpDir, 'preset.json')
        await writeFile(
          presetFile,
          JSON.stringify({
            version: 1,
            defaults: { profile: 'dev' },
            profiles: {
              dev: {
                envs: {},
                opts: { bash: true, fish: true },
              },
            },
          }),
        )

        const root = new Command({ name: 'cli', desc: 'cli' })
        root.subcommand('completion', new CompletionCommand(root))

        await expect(
          root.parse({ argv: ['completion', `--preset-file=${presetFile}`], envs: {} }),
        ).rejects.toMatchObject({
          kind: 'OptionConflict',
          meta: {
            issues: expect.arrayContaining([
              expect.objectContaining({
                kind: 'error',
                reason: expect.objectContaining({ code: 'option_conflict' }),
                source: { primary: 'preset' },
                preset: expect.objectContaining({ profile: 'dev' }),
              }),
              expect.objectContaining({
                kind: 'hint',
                reason: expect.objectContaining({ code: 'preset_token_injected' }),
                preset: expect.objectContaining({ profile: 'dev' }),
              }),
            ]),
          },
        })
      })
    })

    it('formatHelp should render plain examples section', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).example('Quick Start', 'run', 'desc')
      const helpText = cmd.formatHelp()

      expect(helpText).toContain('Examples:')
      expect(helpText).toContain('  - Quick Start')
      expect(helpText).toContain('    cli run')
    })

    it('formatHelp should order options as help/version/required/others and hide negative option lines', () => {
      const cmd = new Command({
        name: 'cli',
        desc: 'cli',
        version: '1.0.0',
        builtin: {
          option: {
            version: true,
            color: false,
            devmode: false,
            logLevel: false,
            silent: false,
            logDate: false,
            logColorful: false,
          },
        },
      })
        .option({ long: 'zeta', type: 'boolean', args: 'none', desc: 'zeta' })
        .option({
          long: 'alpha',
          type: 'string',
          args: 'required',
          required: true,
          desc: 'alpha',
        })
        .option({ long: 'beta', type: 'boolean', args: 'none', desc: 'beta' })

      const lines = cmd.formatHelp().split('\n')
      const helpIdx = lines.findIndex(line => line.includes('--help'))
      const versionIdx = lines.findIndex(line => line.includes('--version'))
      const alphaIdx = lines.findIndex(line => line.includes('--alpha <value>'))
      const betaIdx = lines.findIndex(line => line.includes('--beta'))
      const zetaIdx = lines.findIndex(line => line.includes('--zeta'))

      expect(helpIdx).toBeGreaterThan(-1)
      expect(versionIdx).toBeGreaterThan(-1)
      expect(alphaIdx).toBeGreaterThan(-1)
      expect(betaIdx).toBeGreaterThan(-1)
      expect(zetaIdx).toBeGreaterThan(-1)
      expect(helpIdx).toBeLessThan(versionIdx)
      expect(versionIdx).toBeLessThan(alphaIdx)
      expect(alphaIdx).toBeLessThan(betaIdx)
      expect(betaIdx).toBeLessThan(zetaIdx)
      expect(lines.some(line => line.includes('--no-'))).toBe(false)
    })

    it('formatHelp should keep help command first and sort subcommands alphabetically', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      cmd.subcommand('zeta', new Command({ desc: 'zeta command' }))
      cmd.subcommand('alpha', new Command({ desc: 'alpha command' }))

      const lines = cmd.formatHelp().split('\n')
      const helpIdx = lines.findIndex(line => line.includes('help') && line.includes('Show help'))
      const alphaIdx = lines.findIndex(
        line => line.includes('alpha') && line.includes('alpha command'),
      )
      const zetaIdx = lines.findIndex(
        line => line.includes('zeta') && line.includes('zeta command'),
      )

      expect(helpIdx).toBeGreaterThan(-1)
      expect(alphaIdx).toBeGreaterThan(-1)
      expect(zetaIdx).toBeGreaterThan(-1)
      expect(helpIdx).toBeLessThan(alphaIdx)
      expect(alphaIdx).toBeLessThan(zetaIdx)
    })

    it('formatHelp should render Arguments section and keep columns aligned', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
        .argument({ name: 'target', kind: 'required', type: 'string', desc: 'Deploy target' })
        .argument({
          name: 'mode',
          kind: 'optional',
          type: 'choice',
          choices: ['safe', 'force'],
          default: 'safe',
          desc: 'Deploy mode',
        })
        .option({
          long: 'verbose',
          short: 'v',
          type: 'boolean',
          args: 'none',
          desc: 'Verbose output',
        })

      cmd.subcommand('start', new Command({ desc: 'Start process' }))

      const helpText = cmd.formatHelp()
      const lines = helpText.split('\n')

      const argLine = lines.find(line => line.includes('Deploy target'))
      const optionLine = lines.find(line => line.includes('Verbose output'))
      const commandLine = lines.find(line => line.includes('Start process'))
      const modeLine = lines.find(line => line.includes('Deploy mode'))

      expect(helpText).toContain('Arguments:')
      expect(helpText).toContain('<target>')
      expect(modeLine).toContain('[type: choice]')
      expect(modeLine).toContain('[default: "safe"]')
      expect(modeLine).toContain('[choices: "safe", "force"]')
      expect(argLine).toBeDefined()
      expect(optionLine).toBeDefined()
      expect(commandLine).toBeDefined()

      if (argLine && optionLine && commandLine) {
        expect(argLine.indexOf('Deploy target')).toBe(optionLine.indexOf('Verbose output'))
        expect(argLine.indexOf('Deploy target')).toBe(commandLine.indexOf('Start process'))
      }
    })

    it('formatHelp should handle ANSI, combining marks, and wide chars in alignment width', () => {
      const cjkWide = String.fromCodePoint(0x20000)
      const ethiopic = String.fromCodePoint(0x1200)
      const combiningMarks = String.fromCodePoint(0x0301, 0x1ab1, 0x1dc1, 0x20d1, 0xfe21)

      const cmd = new Command({
        name: 'cli',
        desc: `desc\u001b[31mcolor\u001b[0m${combiningMarks}`,
      })
        .argument({
          name: 'input',
          kind: 'required',
          type: 'string',
          desc: `Input ${cjkWide}${ethiopic}`,
        })
        .option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: `Mode ${cjkWide}${ethiopic}`,
        })

      const helpText = cmd.formatHelp()
      expect(helpText).toContain('Input')
      expect(helpText).toContain('Mode')
    })

    it('should handle action errors with exit code 1', async () => {
      mockProcessExit()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const errCmd = new Command({ name: 'cli', desc: 'cli' })
      errCmd.action(() => {
        throw new Error('boom')
      })
      await errCmd.run({ argv: [], envs: {} })
      expect(errorSpy).toHaveBeenCalledWith('Error: boom\nRun "cli --help" for usage.')
      expect(process.exit).toHaveBeenCalledWith(1)

      errorSpy.mockClear()
      const rawErrCmd = new Command({ name: 'cli', desc: 'cli' })
      rawErrCmd.action(() => {
        throw 'boom'
      })
      await rawErrCmd.run({ argv: [], envs: {} })
      expect(errorSpy).toHaveBeenCalledWith('Error: action failed\nRun "cli --help" for usage.')
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })
})
