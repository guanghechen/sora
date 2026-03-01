import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Command } from '../src'
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

    it('run should support root --version only when enabled', async () => {
      mockProcessExit()
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', desc: 'cli', version: '1.2.3' })
      await root.run({ argv: ['--version'], envs: {} })

      expect(logSpy).toHaveBeenCalledWith('1.2.3')
      expect(process.exit).not.toHaveBeenCalled()
    })

    it('subcommand --version should be treated as normal token and fail unknown option', async () => {
      mockProcessExit()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const root = new Command({ name: 'cli', desc: 'cli', version: '1.0.0' })
      root.subcommand('sub', new Command({ desc: 'sub', version: '2.0.0' }))

      await root.run({ argv: ['sub', '--version'], envs: {} })

      expect(errorSpy).toHaveBeenCalledOnce()
      expect(process.exit).toHaveBeenCalledWith(2)
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

    it('should treat --preset-* after -- as plain args', async () => {
      const cmd = new Command({ name: 'cli', desc: 'cli' }).argument({
        name: 'items',
        kind: 'variadic',
        desc: 'items',
      })

      const result = await cmd.parse({
        argv: ['--', '--preset-opts=./x', '--preset-envs=./y'],
        envs: {},
      })

      expect(result.args).toEqual({ items: ['--preset-opts=./x', '--preset-envs=./y'] })
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
  })
})
