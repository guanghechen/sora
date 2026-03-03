import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Command } from '../src/runtime/node'
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
        .argument({ name: 'input', kind: 'required', desc: 'input' })

      const result = await cmd.parse({ argv: ['-v', '--port', '8080', 'index.ts'], envs: {} })

      expect(result.opts).toEqual({ verbose: true, port: 8080 })
      expect(result.args).toEqual({ input: 'index.ts' })
      expect(result.rawArgs).toEqual(['index.ts'])
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
    it('should resolve --preset-root with default .opt.local/.env.local', async () => {
      await withTempDir(async tmpDir => {
        await writeFile(path.join(tmpDir, '.opt.local'), '--mode preset-default')
        await writeFile(path.join(tmpDir, '.env.local'), 'NAME=from-default\n')

        const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
          default: 'safe',
        })

        const result = await cmd.parse({
          argv: [`--preset-root=${tmpDir}`],
          envs: { NAME: 'user' },
        })

        expect(result.opts).toEqual({ mode: 'preset-default' })
        expect(result.ctx.envs.NAME).toBe('from-default')
      })
    })

    it('should use last --preset-root when provided multiple times', async () => {
      await withTempDir(async tmpDir => {
        const firstRoot = path.join(tmpDir, 'first')
        const secondRoot = path.join(tmpDir, 'second')
        await mkdir(firstRoot, { recursive: true })
        await mkdir(secondRoot, { recursive: true })
        await writeFile(path.join(firstRoot, '.opt.local'), '--mode from-first')
        await writeFile(path.join(secondRoot, '.opt.local'), '--mode from-second')

        const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
          default: 'safe',
        })

        const result = await cmd.parse({
          argv: [`--preset-root=${firstRoot}`, `--preset-root=${secondRoot}`],
          envs: {},
        })

        expect(result.opts).toEqual({ mode: 'from-second' })
      })
    })

    it('should resolve preset file paths after final presetRoot is decided', async () => {
      await withTempDir(async tmpDir => {
        const rootA = path.join(tmpDir, 'a')
        const rootB = path.join(tmpDir, 'b')
        await mkdir(rootA, { recursive: true })
        await mkdir(rootB, { recursive: true })
        await writeFile(path.join(rootA, 'cli.opt'), '--mode from-a')
        await writeFile(path.join(rootB, 'cli.opt'), '--mode from-b')

        const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
        })

        const result = await cmd.parse({
          argv: [`--preset-opts=cli.opt`, `--preset-root=${rootA}`, `--preset-root=${rootB}`],
          envs: {},
        })

        expect(result.opts).toEqual({ mode: 'from-b' })
      })
    })

    it('should load preset opts (multiline) and merge before user argv', async () => {
      await withTempDir(async tmpDir => {
        const presetOptsPath = path.join(tmpDir, 'preset.argv')
        await writeFile(presetOptsPath, '--mode\nfast\n')

        const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
          default: 'safe',
        })

        const result = await cmd.parse({
          argv: [`--preset-opts=${presetOptsPath}`, '--mode', 'slow'],
          envs: {},
        })

        expect(result.opts).toEqual({ mode: 'slow' })
        expect(result.ctx.sources.preset.argv).toEqual(['--mode', 'fast'])
        expect(result.ctx.sources.user.argv).toEqual(['--mode', 'slow'])
      })
    })

    it('should load preset envs and let preset override user envs', async () => {
      await withTempDir(async tmpDir => {
        const envPath = path.join(tmpDir, 'preset.env')
        await writeFile(envPath, 'NO_COLOR=1\nNAME=preset\n')

        const cmd = new Command({ name: 'cli', desc: 'cli' })
        const result = await cmd.parse({
          argv: [`--preset-envs=${envPath}`],
          envs: { NAME: 'user' },
        })

        expect(result.ctx.sources.preset.envs).toEqual({ NO_COLOR: '1', NAME: 'preset' })
        expect(result.ctx.envs.NAME).toBe('preset')
      })
    })

    it('should fallback to leaf command preset root and stop upward scan', async () => {
      await withTempDir(async rootDir => {
        await withTempDir(async leafDir => {
          await writeFile(path.join(rootDir, '.opt.local'), '--mode from-root')
          await writeFile(path.join(leafDir, '.opt.local'), '--mode from-leaf')

          const root = new Command({
            name: 'cli',
            desc: 'cli',
            preset: { root: rootDir },
          })
          const leaf = new Command({
            desc: 'leaf',
            preset: { root: leafDir },
          }).option({ long: 'mode', type: 'string', args: 'required', desc: 'mode' })
          root.subcommand('run', leaf)
          root.subcommand('r', leaf)

          const result = await root.parse({ argv: ['r'], envs: {} })
          expect(result.opts).toEqual({ mode: 'from-leaf' })
          expect(result.ctx.sources.user.cmds).toEqual(['r'])
        })
      })
    })

    it('cli --preset-root should override command preset root but keep command opt/env defaults', async () => {
      await withTempDir(async commandRoot => {
        await withTempDir(async cliRoot => {
          const optFile = 'named.opt'
          const envFile = 'named.env'
          await writeFile(path.join(commandRoot, optFile), '--mode from-command-root')
          await writeFile(path.join(cliRoot, optFile), '--mode from-cli-root')
          await writeFile(path.join(commandRoot, envFile), 'NAME=from-command-root\n')
          await writeFile(path.join(cliRoot, envFile), 'NAME=from-cli-root\n')

          const cmd = new Command({
            name: 'cli',
            desc: 'cli',
            preset: { root: commandRoot, opt: optFile, env: envFile },
          }).option({ long: 'mode', type: 'string', args: 'required', desc: 'mode' })

          const result = await cmd.parse({
            argv: [`--preset-root=${cliRoot}`],
            envs: { NAME: 'user' },
          })
          expect(result.opts).toEqual({ mode: 'from-cli-root' })
          expect(result.ctx.envs.NAME).toBe('from-cli-root')
        })
      })
    })

    it('should throw immediately when fallback command preset root is invalid', async () => {
      await withTempDir(async rootDir => {
        const root = new Command({
          name: 'cli',
          desc: 'cli',
          preset: { root: rootDir },
        })
        const leaf = new Command({
          desc: 'leaf',
          preset: { root: 'relative/path' },
        })
        root.subcommand('run', leaf)

        await expect(root.parse({ argv: ['run'], envs: {} })).rejects.toThrow('invalid preset root')
      })
    })

    it('should apply command preset opt/env relative to final preset root', async () => {
      await withTempDir(async presetRoot => {
        const optRel = 'config/preset.opt'
        const envRel = 'config/preset.env'
        await mkdir(path.join(presetRoot, 'config'), { recursive: true })
        await writeFile(path.join(presetRoot, optRel), '--mode from-command-preset')
        await writeFile(path.join(presetRoot, envRel), 'NAME=from-command-preset\n')

        const cmd = new Command({
          name: 'cli',
          desc: 'cli',
          preset: { root: presetRoot, opt: optRel, env: envRel },
        }).option({ long: 'mode', type: 'string', args: 'required', desc: 'mode' })

        const result = await cmd.parse({ argv: [], envs: { NAME: 'user' } })
        expect(result.opts).toEqual({ mode: 'from-command-preset' })
        expect(result.ctx.envs.NAME).toBe('from-command-preset')
      })
    })

    it('should treat invalid command preset opt/env as unset and fallback to defaults', async () => {
      await withTempDir(async presetRoot => {
        await writeFile(path.join(presetRoot, '.opt.local'), '--mode from-default-opt')
        await writeFile(path.join(presetRoot, '.env.local'), 'NAME=from-default-env\n')

        const cmd = new Command({
          name: 'cli',
          desc: 'cli',
          preset: {
            root: presetRoot,
            opt: '..invalid.opt',
            env: '..invalid.env',
          },
        }).option({ long: 'mode', type: 'string', args: 'required', desc: 'mode' })

        const result = await cmd.parse({ argv: [], envs: { NAME: 'user' } })
        expect(result.opts).toEqual({ mode: 'from-default-opt' })
        expect(result.ctx.envs.NAME).toBe('from-default-env')
      })
    })

    it('should throw when explicit command preset file does not exist', async () => {
      await withTempDir(async presetRoot => {
        const cmd = new Command({
          name: 'cli',
          desc: 'cli',
          preset: { root: presetRoot, opt: 'missing.opt' },
        }).option({ long: 'mode', type: 'string', args: 'required', desc: 'mode' })

        await expect(cmd.parse({ argv: [], envs: {} })).rejects.toThrow(
          'failed to read preset file',
        )
      })
    })

    it('should ignore missing implicit default files under preset root', async () => {
      await withTempDir(async presetRoot => {
        const cmd = new Command({
          name: 'cli',
          desc: 'cli',
          preset: { root: presetRoot },
        }).option({
          long: 'mode',
          type: 'string',
          args: 'required',
          desc: 'mode',
          default: 'safe',
        })

        const result = await cmd.parse({ argv: [], envs: {} })
        expect(result.opts).toEqual({ mode: 'safe' })
      })
    })

    it('should wrap invalid preset envs parse error as configuration error', async () => {
      await withTempDir(async tmpDir => {
        const envPath = path.join(tmpDir, 'broken.env')
        await writeFile(envPath, 'BROKEN="unterminated\n')

        const cmd = new Command({ name: 'cli', desc: 'cli' })
        await expect(cmd.parse({ argv: [`--preset-envs=${envPath}`], envs: {} })).rejects.toThrow(
          'failed to parse preset envs file',
        )
      })
    })

    it('run short-circuit should not read preset files', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await cmd.run({
        argv: ['--help', '--preset-opts=./not-found.argv', '--preset-envs=./not-found.env'],
        envs: {},
      })

      expect(logSpy).toHaveBeenCalledOnce()
      expect(process.exit).not.toHaveBeenCalled()
    })

    it('should throw when preset directive misses value', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(cmd.parse({ argv: ['--preset-opts'], envs: {} })).rejects.toThrow(
        'missing value for "--preset-opts"',
      )
      await expect(cmd.parse({ argv: ['--preset-root'], envs: {} })).rejects.toThrow(
        'missing value for "--preset-root"',
      )
    })

    it('should validate explicit preset file values for CLI directives', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(cmd.parse({ argv: ['--preset-opts=..bad.opt'], envs: {} })).rejects.toThrow(
        'invalid value for "--preset-opts"',
      )
      await expect(cmd.parse({ argv: ['--preset-envs=..bad.env'], envs: {} })).rejects.toThrow(
        'invalid value for "--preset-envs"',
      )
    })

    it('should resolve preset root before validating preset opts/env directives', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      await expect(
        cmd.parse({ argv: ['--preset-root=relative/path', '--preset-opts=..bad.opt'], envs: {} }),
      ).rejects.toThrow('invalid preset root')
    })

    it('should forbid --preset-root directive inside preset opts file', async () => {
      await withTempDir(async tmpDir => {
        const presetOptsPath = path.join(tmpDir, 'preset.argv')
        await writeFile(presetOptsPath, '--preset-root=/tmp')

        const cmd = new Command({ name: 'cli', desc: 'cli' })
        await expect(
          cmd.parse({ argv: [`--preset-opts=${presetOptsPath}`], envs: {} }),
        ).rejects.toThrow('preset directive')
      })
    })

    it('should forbid control tokens in preset opts file', async () => {
      await withTempDir(async tmpDir => {
        const presetOptsPath = path.join(tmpDir, 'preset.argv')
        await writeFile(presetOptsPath, '--help')

        const cmd = new Command({ name: 'cli', desc: 'cli' })
        await expect(
          cmd.parse({ argv: [`--preset-opts=${presetOptsPath}`], envs: {} }),
        ).rejects.toThrow('control token')
      })
    })

    it('should forbid "--" in preset opts file', async () => {
      await withTempDir(async tmpDir => {
        const presetOptsPath = path.join(tmpDir, 'preset.argv')
        await writeFile(presetOptsPath, '--')

        const cmd = new Command({ name: 'cli', desc: 'cli' })
        await expect(
          cmd.parse({ argv: [`--preset-opts=${presetOptsPath}`], envs: {} }),
        ).rejects.toThrow('"--" is not allowed')
      })
    })

    it('should reject preset token that cannot be resolved as option fragment', async () => {
      await withTempDir(async tmpDir => {
        const presetOptsPath = path.join(tmpDir, 'preset.argv')
        await writeFile(presetOptsPath, '--silent orphan')

        const cmd = new Command({ name: 'cli', desc: 'cli' }).option({
          long: 'silent',
          type: 'boolean',
          args: 'none',
          desc: 'silent',
        })

        await expect(
          cmd.parse({ argv: [`--preset-opts=${presetOptsPath}`], envs: {} }),
        ).rejects.toThrow('cannot be resolved as an option fragment')
      })
    })

    it('should treat --preset-* after -- as plain args', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).argument({
        name: 'items',
        kind: 'variadic',
        desc: 'items',
      })

      const result = await cmd.parse({
        argv: ['--', '--preset-root=/x', '--preset-opts=./x', '--preset-envs=./y'],
        envs: {},
      })

      expect(result.args).toEqual({
        items: ['--preset-root=/x', '--preset-opts=./x', '--preset-envs=./y'],
      })
    })
  })

  describe('reserved names', () => {
    it('should reject reserved option long names help/version', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
      expect(() =>
        cmd.option({ long: 'help', type: 'boolean', args: 'none', desc: 'invalid' }),
      ).toThrow('reserved')
      expect(() =>
        cmd.option({ long: 'version', type: 'boolean', args: 'none', desc: 'invalid' }),
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

    it('should parse inline variadic value for option', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
        .option({
          long: 'files',
          type: 'string',
          args: 'variadic',
          desc: 'files',
        })
        .argument({ name: 'rest', kind: 'variadic', desc: 'rest' })

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

    it('should parse optional argument default and reject too many args', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
        .argument({ name: 'input', kind: 'required', desc: 'input' })
        .argument({ name: 'output', kind: 'optional', desc: 'output', default: 'dist.txt' })

      const result = await cmd.parse({ argv: ['a.txt'], envs: {} })
      expect(result.args).toEqual({ input: 'a.txt', output: 'dist.txt' })

      await expect(cmd.parse({ argv: ['a', 'b', 'c'], envs: {} })).rejects.toThrow(
        'too many arguments',
      )
    })

    it('should reject invalid argument conversion', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })
        .argument({ name: 'port', kind: 'required', type: 'number', desc: 'port' })
        .argument({
          name: 'target',
          kind: 'optional',
          desc: 'target',
          coerce: raw => {
            if (raw === 'bad') {
              throw new Error('bad')
            }
            return raw
          },
        })

      await expect(cmd.parse({ argv: ['abc'], envs: {} })).rejects.toThrow('invalid number "abc"')
      await expect(cmd.parse({ argv: ['8080', 'bad'], envs: {} })).rejects.toThrow(
        'invalid value "bad"',
      )
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

    it('should expose defensive getters', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli', version: '1.0.0' })
      cmd.option({ long: 'verbose', type: 'boolean', args: 'none', short: 'v', desc: 'verbose' })
      cmd.argument({ name: 'input', kind: 'required', desc: 'input' })
      cmd.example('Title', 'run', 'desc')

      const options = cmd.options
      const args = cmd.arguments
      const examples = cmd.examples

      options.push({ long: 'foo', type: 'boolean', args: 'none', desc: 'foo' })
      args.push({ name: 'x', kind: 'optional', desc: 'x' })
      examples[0].title = 'Mutated'

      expect(cmd.version).toBe('1.0.0')
      expect(cmd.options).toHaveLength(1)
      expect(cmd.arguments).toHaveLength(1)
      expect(cmd.examples[0].title).toBe('Title')
      expect(cmd.parent).toBeUndefined()
      expect(cmd.subcommands.size).toBe(0)
    })

    it('should reject subcommand parent conflict and keep aliases unique', () => {
      const root1 = new Command({ name: 'cli1', desc: 'cli1' })
      const root2 = new Command({ name: 'cli2', desc: 'cli2' })
      const sub = new Command({ desc: 'sub' })

      root1.subcommand('build', sub)
      expect(() => root2.subcommand('build', sub)).toThrow('already has a parent')

      root1.subcommand('b', sub)
      root1.subcommand('b', sub)
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
      ).toThrow("must have args: 'required' or 'variadic'")
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

      cmd.option({ long: 'uniqueLong', short: 'u', type: 'boolean', args: 'none', desc: 'u' })
      expect(() =>
        cmd.option({ long: 'uniqueLong', short: 'x', type: 'boolean', args: 'none', desc: 'dup' }),
      ).toThrow('already defined')
      expect(() =>
        cmd.option({ long: 'otherLong', short: 'u', type: 'boolean', args: 'none', desc: 'dup' }),
      ).toThrow('already defined')

      expect(() =>
        cmd.argument({ name: 'input', kind: 'required', desc: 'input', default: 'x' }),
      ).toThrow('cannot have a default value')

      const argsCmd = new Command({ name: 'args', desc: 'args' })
      argsCmd.argument({ name: 'first', kind: 'optional', desc: 'first' })
      expect(() =>
        argsCmd.argument({ name: 'required', kind: 'required', desc: 'required' }),
      ).toThrow('cannot come after optional/variadic')

      const variadicCmd = new Command({ name: 'variadic', desc: 'variadic' })
      variadicCmd.argument({ name: 'files', kind: 'variadic', desc: 'files' })
      expect(() => variadicCmd.argument({ name: 'next', kind: 'optional', desc: 'next' })).toThrow(
        'variadic argument must be the last argument',
      )

      const multiVariadicCmd = new Command({ name: 'multi', desc: 'multi' })
      multiVariadicCmd.argument({ name: 'files', kind: 'variadic', desc: 'files' })
      expect(() =>
        multiVariadicCmd.argument({ name: 'more', kind: 'variadic', desc: 'more' }),
      ).toThrow('only one variadic argument is allowed')
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
        .argument({ name: 'input', kind: 'optional', desc: 'input' })
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
        const presetOptsPath = path.join(tmpDir, 'preset.args')
        const presetEnvsPath = path.join(tmpDir, 'preset.env')
        await writeFile(presetOptsPath, '--mode fast')
        await writeFile(presetEnvsPath, 'NAME=preset\n')

        const cmd = new Command({ name: 'cli', desc: 'cli' })
          .option({ long: 'mode', type: 'string', args: 'required', desc: 'mode' })
          .argument({ name: 'rest', kind: 'variadic', desc: 'rest' })

        const result = await cmd.parse({
          argv: [
            '--preset-opts',
            presetOptsPath,
            `--preset-envs=${presetEnvsPath}`,
            '--',
            '--tail',
          ],
          envs: { NAME: 'user' },
        })

        expect(result.opts).toEqual({ mode: 'fast' })
        expect(result.args).toEqual({ rest: ['--tail'] })
        expect(result.ctx.envs.NAME).toBe('preset')
      })
    })

    it('should support --preset-envs <file> token style', async () => {
      await withTempDir(async tmpDir => {
        const envPath = path.join(tmpDir, 'preset.env')
        await writeFile(envPath, 'NAME=from-env-file\n')

        const cmd = new Command({ name: 'cli', desc: 'cli' })
        const result = await cmd.parse({ argv: ['--preset-envs', envPath], envs: { NAME: 'user' } })

        expect(result.ctx.envs.NAME).toBe('from-env-file')
      })
    })

    it('should validate preset directive values and file content', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' })

      await expect(cmd.parse({ argv: ['--preset-envs'], envs: {} })).rejects.toThrow(
        'missing value for "--preset-envs"',
      )
      await expect(cmd.parse({ argv: ['--preset-envs='], envs: {} })).rejects.toThrow(
        'missing value for "--preset-envs"',
      )
      await expect(cmd.parse({ argv: ['--preset-opts='], envs: {} })).rejects.toThrow(
        'missing value for "--preset-opts"',
      )

      await expect(
        cmd.parse({ argv: ['--preset-envs=./not-found.env'], envs: {} }),
      ).rejects.toThrow('failed to read preset file')

      await withTempDir(async tmpDir => {
        const emptyPath = path.join(tmpDir, 'empty.opts')
        await writeFile(emptyPath, '  \n\t  ')
        const barePath = path.join(tmpDir, 'bare.opts')
        await writeFile(barePath, 'plain-token --mode fast')
        const presetDirectivePath = path.join(tmpDir, 'directive.opts')
        await writeFile(presetDirectivePath, '--preset-opts=./x')

        await expect(
          cmd.parse({ argv: [`--preset-opts=${emptyPath}`], envs: {} }),
        ).resolves.toBeDefined()
        await expect(cmd.parse({ argv: [`--preset-opts=${barePath}`], envs: {} })).rejects.toThrow(
          'bare token',
        )
        await expect(
          cmd.parse({ argv: [`--preset-opts=${presetDirectivePath}`], envs: {} }),
        ).rejects.toThrow('preset directive')
      })
    })

    it('should reject unknown option from preset file with configuration error', async () => {
      await withTempDir(async tmpDir => {
        const presetOptsPath = path.join(tmpDir, 'preset.argv')
        await writeFile(presetOptsPath, '--unknown-option')

        const cmd = new Command({ name: 'cli', desc: 'cli' })
        await expect(
          cmd.parse({ argv: [`--preset-opts=${presetOptsPath}`], envs: {} }),
        ).rejects.toThrow('invalid preset options')
      })
    })

    it('formatHelp should render plain examples section', () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).example('Quick Start', 'run', 'desc')
      const helpText = cmd.formatHelp()

      expect(helpText).toContain('Examples:')
      expect(helpText).toContain('  - Quick Start')
      expect(helpText).toContain('    cli run')
    })

    it('should handle action errors with exit code 1', async () => {
      mockProcessExit()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const errCmd = new Command({ name: 'cli', desc: 'cli' })
      errCmd.action(() => {
        throw new Error('boom')
      })
      await errCmd.run({ argv: [], envs: {} })
      expect(errorSpy).toHaveBeenCalledWith('Error: boom')
      expect(process.exit).toHaveBeenCalledWith(1)

      errorSpy.mockClear()
      const rawErrCmd = new Command({ name: 'cli', desc: 'cli' })
      rawErrCmd.action(() => {
        throw 'boom'
      })
      await rawErrCmd.run({ argv: [], envs: {} })
      expect(errorSpy).toHaveBeenCalledWith('Error: action failed')
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })
})
