import { vi } from 'vitest'
import type { ICommandActionParams } from '../src'
import { Command, CommanderError } from '../src'

describe('Command', () => {
  describe('constructor', () => {
    it('should create with basic config', () => {
      const cmd = new Command({ name: 'test', desc: 'Test command' })
      expect(cmd.name).toBe('test')
      expect(cmd.description).toBe('Test command')
    })

    it('should accept version', () => {
      const cmd = new Command({ name: 'test', desc: 'Test', version: '1.0.0' })
      expect(cmd.version).toBe('1.0.0')
    })

    it('should expose options property', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Verbose' })

      const options = cmd.options
      expect(options.length).toBeGreaterThan(0)
      expect(options.some(o => o.long === 'verbose')).toBe(true)
    })

    it('should expose arguments property', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'file', desc: 'File', kind: 'required' })

      const args = cmd.arguments
      expect(args).toHaveLength(1)
      expect(args[0].name).toBe('file')
    })
  })

  describe('option', () => {
    it('should add boolean option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'boolean',
        args: 'none',
        short: 'v',
        long: 'verbose',
        desc: 'Verbose output',
      })

      const result = cmd.parse({ argv: ['--verbose'], envs: {} })
      expect(result.opts['verbose']).toBe(true)
    })

    it('should parse short option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'boolean',
        args: 'none',
        short: 'v',
        long: 'verbose',
        desc: 'Verbose',
      })

      const result = cmd.parse({ argv: ['-v'], envs: {} })
      expect(result.opts['verbose']).toBe(true)
    })

    it('should add string option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        short: 'o',
        long: 'output',
        desc: 'Output file',
      })

      const result = cmd.parse({ argv: ['--output', 'file.txt'], envs: {} })
      expect(result.opts['output']).toBe('file.txt')
    })

    it('should parse string option with equals sign', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', args: 'required', long: 'output', desc: 'Output file' })

      const result = cmd.parse({ argv: ['--output=file.txt'], envs: {} })
      expect(result.opts['output']).toBe('file.txt')
    })

    it('should add number option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'number',
        args: 'required',
        short: 'p',
        long: 'port',
        desc: 'Port number',
      })

      const result = cmd.parse({ argv: ['--port', '8080'], envs: {} })
      expect(result.opts['port']).toBe(8080)
    })

    it('should throw for invalid number', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'number', args: 'required', long: 'port', desc: 'Port number' })

      expect(() => cmd.parse({ argv: ['--port', 'abc'], envs: {} })).toThrow('invalid number')
    })

    it('should use default value when option not provided', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'env',
        desc: 'Environment',
        default: 'dev',
      })

      const result = cmd.parse({ argv: [], envs: {} })
      expect(result.opts['env']).toBe('dev')
    })

    it('should validate choices', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'env',
        desc: 'Environment',
        choices: ['dev', 'prod'],
      })

      expect(() => cmd.parse({ argv: ['--env', 'staging'], envs: {} })).toThrow('invalid value')
    })

    it('should throw for unknown option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      expect(() => cmd.parse({ argv: ['--unknown'], envs: {} })).toThrow('unknown option')
    })

    it('should throw for missing option value', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', args: 'required', long: 'output', desc: 'Output' })

      expect(() => cmd.parse({ argv: ['--output'], envs: {} })).toThrow('requires a value')
    })

    it('should throw for missing required option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'config',
        desc: 'Config file',
        required: true,
      })

      expect(() => cmd.parse({ argv: [], envs: {} })).toThrow('missing required option')
    })

    it('should support --no-{option} for boolean options', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Verbose' })

      const result = cmd.parse({ argv: ['--no-verbose'], envs: {} })
      expect(result.opts['verbose']).toBe(false)
    })

    it('should support --option=true/false for boolean options', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Verbose' })

      expect(cmd.parse({ argv: ['--verbose=true'], envs: {} }).opts['verbose']).toBe(true)
      expect(cmd.parse({ argv: ['--verbose=false'], envs: {} }).opts['verbose']).toBe(false)
    })

    it('should throw for invalid boolean value', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Verbose' })

      expect(() => cmd.parse({ argv: ['--verbose=yes'], envs: {} })).toThrow(
        'Use "true" or "false"',
      )
    })

    it('should throw for --no-option with value', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Verbose' })

      expect(() => cmd.parse({ argv: ['--no-verbose=true'], envs: {} })).toThrow(
        'does not accept a value',
      )
    })

    it('should support Last Write Wins for boolean options', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Verbose' })

      expect(cmd.parse({ argv: ['--verbose', '--no-verbose'], envs: {} }).opts['verbose']).toBe(
        false,
      )
      expect(cmd.parse({ argv: ['--no-verbose', '--verbose'], envs: {} }).opts['verbose']).toBe(
        true,
      )
    })

    it('should support string[] option with append', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'variadic',
        long: 'include',
        desc: 'Include paths',
      })

      const result = cmd.parse({ argv: ['--include', 'a', '--include', 'b'], envs: {} })
      expect(result.opts['include']).toEqual(['a', 'b'])
    })

    it('should support number[] option with append', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'number', args: 'variadic', long: 'port', desc: 'Ports' })

      const result = cmd.parse({ argv: ['--port', '80', '--port', '443'], envs: {} })
      expect(result.opts['port']).toEqual([80, 443])
    })

    it('should support variadic option with = syntax (inline value only)', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', args: 'variadic', long: 'files', desc: 'Files' })
      cmd.argument({ name: 'args', kind: 'variadic', desc: 'Args' })

      // --files=first.txt only takes first.txt, rest become positional args
      const result = cmd.parse({ argv: ['--files=first.txt', 'a.txt', 'b.txt'], envs: {} })
      expect(result.opts['files']).toEqual(['first.txt'])
      expect(result.args).toEqual({ args: ['a.txt', 'b.txt'] })
    })

    it('should support variadic short option greedy consume', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'variadic',
        short: 'f',
        long: 'files',
        desc: 'Files',
      })

      // -f greedily consumes following values until next option
      const result = cmd.parse({ argv: ['-f', 'a.txt', 'b.txt', 'c.txt'], envs: {} })
      expect(result.opts['files']).toEqual(['a.txt', 'b.txt', 'c.txt'])
    })

    it('should support coerce callback', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'number',
        args: 'required',
        long: 'port',
        desc: 'Port',
        coerce: v => {
          const n = parseInt(v, 10)
          if (n < 0 || n > 65535) throw new Error('Invalid port')
          return n
        },
      })

      expect(cmd.parse({ argv: ['--port', '8080'], envs: {} }).opts['port']).toBe(8080)
      expect(() => cmd.parse({ argv: ['--port', '99999'], envs: {} })).toThrow('Invalid port')
    })
  })

  describe('argument', () => {
    it('should parse required argument', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'input', desc: 'Input file', kind: 'required' })

      const result = cmd.parse({ argv: ['file.txt'], envs: {} })
      expect(result.args).toEqual({ input: 'file.txt' })
      expect(result.rawArgs).toEqual(['file.txt'])
    })

    it('should parse optional argument', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'output', desc: 'Output file', kind: 'optional' })

      const result = cmd.parse({ argv: [], envs: {} })
      expect(result.args).toEqual({ output: undefined })
      expect(result.rawArgs).toEqual([])
    })

    it('should parse variadic argument', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'files', desc: 'Input files', kind: 'variadic' })

      const result = cmd.parse({ argv: ['a.txt', 'b.txt', 'c.txt'], envs: {} })
      expect(result.args).toEqual({ files: ['a.txt', 'b.txt', 'c.txt'] })
      expect(result.rawArgs).toEqual(['a.txt', 'b.txt', 'c.txt'])
    })

    it('should throw for missing required argument', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'input', desc: 'Input file', kind: 'required' })

      expect(() => cmd.parse({ argv: [], envs: {} })).toThrow('missing required argument')
    })

    it('should throw for multiple variadic arguments', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'files1', desc: 'Files 1', kind: 'variadic' })

      expect(() => cmd.argument({ name: 'files2', desc: 'Files 2', kind: 'variadic' })).toThrow(
        'only one variadic',
      )
    })

    it('should throw if variadic is not last', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'files', desc: 'Files', kind: 'variadic' })

      expect(() => cmd.argument({ name: 'extra', desc: 'Extra', kind: 'required' })).toThrow(
        'variadic argument must be the last',
      )
    })
  })

  describe('positional arguments mixed with options', () => {
    it('should accept positional argument after option', async () => {
      let receivedArgs: Record<string, unknown> = {}
      let receivedOpts: Record<string, unknown> = {}
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', args: 'required', long: 'opt', desc: 'Option' })
      cmd.argument({ name: 'arg', kind: 'required', desc: 'Arg' })
      cmd.action(({ opts, args }) => {
        receivedOpts = opts
        receivedArgs = args
      })

      await cmd.run({ argv: ['--opt', 'val', 'arg1'], envs: {} })
      expect(receivedOpts['opt']).toBe('val')
      expect(receivedArgs).toEqual({ arg: 'arg1' })
    })

    it('should accept positional argument before option', async () => {
      let receivedArgs: Record<string, unknown> = {}
      let receivedOpts: Record<string, unknown> = {}
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', args: 'required', long: 'opt', desc: 'Option' })
      cmd.argument({ name: 'arg', kind: 'required', desc: 'Arg' })
      cmd.action(({ opts, args }) => {
        receivedOpts = opts
        receivedArgs = args
      })

      await cmd.run({ argv: ['arg1', '--opt', 'val'], envs: {} })
      expect(receivedOpts['opt']).toBe('val')
      expect(receivedArgs).toEqual({ arg: 'arg1' })
    })

    it('should accept positional arguments on both sides of options', async () => {
      let receivedArgs: Record<string, unknown> = {}
      let receivedOpts: Record<string, unknown> = {}
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', args: 'required', long: 'opt', desc: 'Option' })
      cmd.argument({ name: 'files', kind: 'variadic', desc: 'Files' })
      cmd.action(({ opts, args }) => {
        receivedOpts = opts
        receivedArgs = args
      })

      await cmd.run({ argv: ['arg1', '--opt', 'val', 'arg2'], envs: {} })
      expect(receivedOpts['opt']).toBe('val')
      expect(receivedArgs).toEqual({ files: ['arg1', 'arg2'] })
    })

    it('should accept positional argument in subcommand after options', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' })
      root.option({
        type: 'boolean',
        args: 'none',
        long: 'verbose',
        short: 'v',
        desc: 'Verbose',
      })

      let receivedArgs: Record<string, unknown> = {}
      let receivedOpts: Record<string, unknown> = {}
      const sub = new Command({ desc: 'Sub' })
      sub.option({
        type: 'string',
        args: 'required',
        long: 'output',
        short: 'o',
        desc: 'Output',
      })
      sub.argument({ name: 'file', kind: 'required', desc: 'File' })
      sub.action(({ opts, args }) => {
        receivedOpts = opts
        receivedArgs = args
      })

      root.subcommand('sub', sub)

      await root.run({ argv: ['sub', '--verbose', '--output', 'out.txt', 'input.txt'], envs: {} })
      expect(receivedOpts['verbose']).toBe(true)
      expect(receivedOpts['output']).toBe('out.txt')
      expect(receivedArgs).toEqual({ file: 'input.txt' })
    })

    it('should accept positional argument in subcommand before options', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' })
      root.option({
        type: 'boolean',
        args: 'none',
        long: 'verbose',
        short: 'v',
        desc: 'Verbose',
      })

      let receivedArgs: Record<string, unknown> = {}
      let receivedOpts: Record<string, unknown> = {}
      const sub = new Command({ desc: 'Sub' })
      sub.option({
        type: 'string',
        args: 'required',
        long: 'output',
        short: 'o',
        desc: 'Output',
      })
      sub.argument({ name: 'file', kind: 'required', desc: 'File' })
      sub.action(({ opts, args }) => {
        receivedOpts = opts
        receivedArgs = args
      })

      root.subcommand('sub', sub)

      await root.run({ argv: ['sub', 'input.txt', '--verbose', '--output', 'out.txt'], envs: {} })
      expect(receivedOpts['verbose']).toBe(true)
      expect(receivedOpts['output']).toBe('out.txt')
      expect(receivedArgs).toEqual({ file: 'input.txt' })
    })

    it('should still support -- separator for compatibility', async () => {
      let receivedArgs: Record<string, unknown> = {}
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'files', kind: 'variadic', desc: 'Files' })
      cmd.action(({ args }) => {
        receivedArgs = args
      })

      await cmd.run({ argv: ['--', '--looks-like-option', 'arg'], envs: {} })
      expect(receivedArgs).toEqual({ files: ['--looks-like-option', 'arg'] })
    })
  })

  describe('subcommand', () => {
    it('should route to subcommand via run', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI tool' })
      const sub = new Command({ desc: 'Initialize' }).argument({
        name: 'args',
        kind: 'variadic',
        desc: 'Args',
      })

      let receivedArgs: Record<string, unknown> = {}
      sub.action(({ args }) => {
        receivedArgs = args
      })
      root.subcommand('init', sub)

      await root.run({ argv: ['init', 'arg'], envs: {} })
      expect(receivedArgs).toEqual({ args: ['arg'] })
    })

    it('should route to subcommand with argument via run', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI tool' })
      const sub = new Command({ desc: 'Initialize' }).argument({
        name: 'name',
        desc: 'Name',
        kind: 'required',
      })

      let receivedArgs: Record<string, unknown> = {}
      sub.action(({ args }) => {
        receivedArgs = args
      })
      root.subcommand('init', sub)

      await root.run({ argv: ['init', 'myarg'], envs: {} })
      expect(receivedArgs).toEqual({ name: 'myarg' })
    })

    it('should resolve subcommand by alias', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI tool' })
      const sub = new Command({ desc: 'Initialize' })

      let executed = false
      sub.action(() => {
        executed = true
      })
      root.subcommand('initialize', sub).subcommand('init', sub).subcommand('i', sub)

      await root.run({ argv: ['i'], envs: {} })
      expect(executed).toBe(true)
    })

    it('should stop routing at option-like token', () => {
      const root = new Command({ name: 'cli', desc: 'CLI' })
      root.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Verbose' })
      root.argument({ name: 'args', kind: 'variadic', desc: 'Args' })
      const sub = new Command({ desc: 'Start' })
      sub.action(() => {})
      root.subcommand('start', sub)

      // pm --verbose start should NOT route to start
      // start becomes a positional argument for root
      const result = root.parse({ argv: ['--verbose', 'start'], envs: {} })
      expect(result.opts['verbose']).toBe(true)
      expect(result.rawArgs).toEqual(['start'])
      expect(result.args).toEqual({ args: ['start'] })
    })

    it('should set registered name on subcommand', () => {
      const root = new Command({ name: 'cli', desc: 'CLI' })
      const sub = new Command({ desc: 'Build' })
      root.subcommand('build', sub)

      expect(sub.name).toBe('build')
    })

    it('should collect aliases when same command registered multiple times', () => {
      const root = new Command({ name: 'cli', desc: 'CLI' })
      const sub = new Command({ desc: 'Build' })
      root.subcommand('build', sub).subcommand('b', sub).subcommand('compile', sub)

      // First registration is the name, subsequent are aliases
      expect(sub.name).toBe('build')
      // Aliases are stored in the entry, accessible via getCompletionMeta
      const meta = root.getCompletionMeta()
      const subMeta = meta.subcommands.find(s => s.name === 'build')
      expect(subMeta?.aliases).toEqual(['b', 'compile'])
    })

    it('should throw when command already has a different parent', () => {
      const root1 = new Command({ name: 'cli1', desc: 'CLI 1' })
      const root2 = new Command({ name: 'cli2', desc: 'CLI 2' })
      const sub = new Command({ desc: 'Sub' })

      root1.subcommand('sub', sub)
      expect(() => root2.subcommand('sub', sub)).toThrow('already has a parent')
    })
  })

  describe('action', () => {
    it('should execute action', async () => {
      const action = vi.fn()
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.action(action)

      await cmd.run({ argv: [], envs: {} })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('should pass context to action', async () => {
      let params: ICommandActionParams | undefined
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', args: 'required', long: 'name', desc: 'Name' })
      cmd.argument({ name: 'file', desc: 'File', kind: 'required' })
      cmd.action(p => {
        params = p
      })

      await cmd.run({ argv: ['--name', 'foo', 'input.txt'], envs: {} })

      expect(params).toBeDefined()
      expect(params!.opts['name']).toBe('foo')
      expect(params!.args).toEqual({ file: 'input.txt' })
      expect(params!.rawArgs).toEqual(['input.txt'])
    })

    it('should use default reporter when none provided', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.action(({ ctx }) => {
        ctx.reporter.info('info message')
        ctx.reporter.warn('warn message')
        ctx.reporter.error('error message')
      })

      await cmd.run({ argv: [], envs: {} })

      // Reporter uses formatted output with timestamp and prefix
      expect(logSpy).toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()

      logSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })

  describe('parse rest arguments', () => {
    it('should collect arguments after --', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' }).argument({
        name: 'extras',
        kind: 'variadic',
        desc: 'Extras',
      })

      const result = cmd.parse({ argv: ['--', 'extra1', '--extra2'], envs: {} })
      expect(result.rawArgs).toEqual(['extra1', '--extra2'])
      expect(result.args).toEqual({ extras: ['extra1', '--extra2'] })
    })
  })

  describe('built-in options', () => {
    it('should have --help option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      const result = cmd.parse({ argv: ['--help'], envs: {} })
      expect(result.opts['help']).toBe(true)
    })

    it('should have --version option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test', version: '1.0.0' })
      const result = cmd.parse({ argv: ['--version'], envs: {} })
      expect(result.opts['version']).toBe(true)
    })

    it('should auto integrate --log-level option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      const result = cmd.parse({ argv: ['--log-level', 'warn'], envs: {} })
      expect(result.opts['logLevel']).toBe('warn')
    })

    it('should auto integrate --silent option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      const result = cmd.parse({ argv: ['--silent'], envs: {} })
      expect(result.opts['silent']).toBe(true)
    })

    it('should auto integrate --log-date/--no-log-date option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      expect(cmd.parse({ argv: [], envs: {} }).opts['logDate']).toBe(true)
      expect(cmd.parse({ argv: ['--no-log-date'], envs: {} }).opts['logDate']).toBe(false)
    })

    it('should auto integrate --log-colorful/--no-log-colorful option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      expect(cmd.parse({ argv: [], envs: {} }).opts['logColorful']).toBe(true)
      expect(cmd.parse({ argv: ['--no-log-colorful'], envs: {} }).opts['logColorful']).toBe(false)
    })

    it('should disable built-in log options when builtin.option is false', () => {
      const cmd = new Command({ name: 'test', desc: 'Test', builtin: { option: false } })
      expect(() => cmd.parse({ argv: ['--log-level', 'warn'], envs: {} })).toThrow('unknown option')
    })

    it('should support partial built-in option config', () => {
      const cmd = new Command({
        name: 'test',
        desc: 'Test',
        builtin: { option: { logDate: false, logColorful: false } },
      })
      expect(() => cmd.parse({ argv: ['--log-date'], envs: {} })).toThrow('unknown option')
      expect(() => cmd.parse({ argv: ['--log-colorful'], envs: {} })).toThrow('unknown option')
      expect(cmd.parse({ argv: ['--log-level', 'error'], envs: {} }).opts['logLevel']).toBe('error')
    })

    it('should disable all built-in features when builtin is false', () => {
      const root = new Command({ name: 'cli', desc: 'CLI', builtin: false })

      expect(() => root.parse({ argv: ['--log-level', 'warn'], envs: {} })).toThrow(
        'unknown option',
      )
      expect(() => root.parse({ argv: ['--silent'], envs: {} })).toThrow('unknown option')
      expect(() => root.parse({ argv: ['--log-date'], envs: {} })).toThrow('unknown option')
      expect(() => root.parse({ argv: ['--log-colorful'], envs: {} })).toThrow('unknown option')
    })

    it('should enable all built-in options when builtin.option is true', () => {
      const cmd = new Command({
        name: 'test',
        desc: 'Test',
        builtin: { option: true },
      })

      expect(cmd.parse({ argv: ['--log-level', 'warn'], envs: {} }).opts['logLevel']).toBe('warn')
      expect(cmd.parse({ argv: ['--silent'], envs: {} }).opts['silent']).toBe(true)
      expect(cmd.parse({ argv: ['--no-log-date'], envs: {} }).opts['logDate']).toBe(false)
      expect(cmd.parse({ argv: ['--no-log-colorful'], envs: {} }).opts['logColorful']).toBe(false)
    })

    it('should support explicit logLevel and silent overrides in builtin.option object', () => {
      const cmd = new Command({
        name: 'test',
        desc: 'Test',
        builtin: { option: { logLevel: false, silent: false } },
      })

      expect(() => cmd.parse({ argv: ['--log-level', 'warn'], envs: {} })).toThrow('unknown option')
      expect(() => cmd.parse({ argv: ['--silent'], envs: {} })).toThrow('unknown option')

      // Unspecified options keep default enabled state
      expect(cmd.parse({ argv: ['--no-log-date'], envs: {} }).opts['logDate']).toBe(false)
      expect(cmd.parse({ argv: ['--no-log-colorful'], envs: {} }).opts['logColorful']).toBe(false)
    })

    it('should not show version output for subcommands when --version is used', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const root = new Command({ name: 'cli', desc: 'CLI', version: '1.0.0' })
      const sub = new Command({ desc: 'Sub' })
      let actionCalled = false
      sub.action(() => {
        actionCalled = true
      })
      root.subcommand('sub', sub)

      await root.run({ argv: ['sub', '--version'], envs: {} })

      // --version is consumed by root (option bubbling) but does not output version
      // because leaf command is not root, and subcommand action still runs
      expect(actionCalled).toBe(true)
      expect(consoleSpy).not.toHaveBeenCalledWith('1.0.0')
      consoleSpy.mockRestore()
    })
  })

  describe('formatHelp', () => {
    it('should generate help text', () => {
      const cmd = new Command({ name: 'mycli', desc: 'My CLI tool', version: '1.0.0' })
      cmd.option({
        type: 'string',
        args: 'required',
        short: 'o',
        long: 'output',
        desc: 'Output file',
      })
      cmd.argument({ name: 'input', desc: 'Input file', kind: 'required' })

      const help = cmd.formatHelp()

      expect(help).toContain('Usage: mycli')
      expect(help).toContain('My CLI tool')
      expect(help).toContain('-o, --output')
      expect(help).toContain('Output file')
      expect(help).toContain('<input>')
    })

    it('should show optional argument in usage', () => {
      const cmd = new Command({ name: 'mycli', desc: 'My CLI' })
      cmd.argument({ name: 'output', desc: 'Output file', kind: 'optional' })

      const help = cmd.formatHelp()

      expect(help).toContain('[output]')
    })

    it('should show variadic argument in usage', () => {
      const cmd = new Command({ name: 'mycli', desc: 'My CLI' })
      cmd.argument({ name: 'files', desc: 'Input files', kind: 'variadic' })

      const help = cmd.formatHelp()

      expect(help).toContain('[files...]')
    })

    it('should show subcommands in help', () => {
      const root = new Command({ name: 'cli', desc: 'CLI' })
      root.subcommand('init', new Command({ desc: 'Initialize project' }))
      root.subcommand('build', new Command({ desc: 'Build project' }))

      const help = root.formatHelp()

      expect(help).toContain('Commands:')
      expect(help).toContain('init')
      expect(help).toContain('Initialize project')
      expect(help).toContain('build')
    })

    it('should show subcommand aliases in help', () => {
      const root = new Command({ name: 'cli', desc: 'CLI' })
      const sub = new Command({ desc: 'Initialize project' })
      root.subcommand('initialize', sub).subcommand('init', sub).subcommand('i', sub)

      const help = root.formatHelp()

      expect(help).toContain('initialize, init, i')
    })

    it('should show default values', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'env',
        desc: 'Environment',
        default: 'development',
      })

      const help = cmd.formatHelp()
      expect(help).toContain('(default: "development")')
    })

    it('should show choices', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'format',
        desc: 'Output format',
        choices: ['json', 'yaml'],
      })

      const help = cmd.formatHelp()
      expect(help).toContain('[choices: json, yaml]')
    })

    it('should show --no-{option} for boolean options with negate description', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'boolean',
        args: 'none',
        long: 'verbose',
        desc: 'Verbose output',
      })

      const help = cmd.formatHelp()
      expect(help).toContain('--verbose')
      expect(help).toContain('--no-verbose')
      expect(help).toContain('Negate --verbose')
    })
  })

  describe('getCompletionMeta', () => {
    it('should return completion metadata', () => {
      const root = new Command({ name: 'cli', desc: 'CLI tool' })
      root.option({
        type: 'string',
        args: 'required',
        short: 'c',
        long: 'config',
        desc: 'Config file',
      })

      const sub = new Command({ desc: 'Initialize' })
      root.subcommand('init', sub)

      const meta = root.getCompletionMeta()

      expect(meta.name).toBe('cli')
      expect(meta.desc).toBe('CLI tool')
      expect(meta.options).toContainEqual(expect.objectContaining({ long: 'config' }))
      expect(meta.subcommands).toHaveLength(1)
      expect(meta.subcommands[0].name).toBe('init')
    })

    it('should include aliases in subcommand metadata', () => {
      const root = new Command({ name: 'cli', desc: 'CLI tool' })
      const sub = new Command({ desc: 'Build' })
      root.subcommand('build', sub).subcommand('b', sub)

      const meta = root.getCompletionMeta()

      expect(meta.subcommands[0].name).toBe('build')
      expect(meta.subcommands[0].aliases).toEqual(['b'])
    })
  })

  describe('combined short options', () => {
    it('should parse combined short boolean options', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'boolean', args: 'none', short: 'a', long: 'alpha', desc: 'Alpha' })
      cmd.option({ type: 'boolean', args: 'none', short: 'b', long: 'beta', desc: 'Beta' })
      cmd.option({ type: 'boolean', args: 'none', short: 'c', long: 'gamma', desc: 'Gamma' })

      const result = cmd.parse({ argv: ['-abc'], envs: {} })

      expect(result.opts['alpha']).toBe(true)
      expect(result.opts['beta']).toBe(true)
      expect(result.opts['gamma']).toBe(true)
    })

    it('should parse combined short options with value at end', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'boolean',
        args: 'none',
        short: 'v',
        long: 'verbose',
        desc: 'Verbose',
      })
      cmd.option({
        type: 'string',
        args: 'required',
        short: 'o',
        long: 'output',
        desc: 'Output',
      })

      const result = cmd.parse({ argv: ['-vo', 'file.txt'], envs: {} })

      expect(result.opts['verbose']).toBe(true)
      expect(result.opts['output']).toBe('file.txt')
    })

    it('should throw for unsupported -o=value syntax', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        short: 'o',
        long: 'output',
        desc: 'Output',
      })

      expect(() => cmd.parse({ argv: ['-o=file.txt'], envs: {} })).toThrow('not supported')
    })

    it('should throw for -ovalue syntax as unknown options', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        short: 'o',
        long: 'output',
        desc: 'Output',
      })
      cmd.option({
        type: 'boolean',
        args: 'none',
        short: 'v',
        long: 'verbose',
        desc: 'Verbose',
      })

      // -ofile is expanded to -o -f -i -l -e, where -f is unknown
      expect(() => cmd.parse({ argv: ['-ofile'], envs: {} })).toThrow('unknown option')
    })

    it('should throw for unknown short option in combined form', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'boolean', args: 'none', short: 'a', long: 'alpha', desc: 'Alpha' })
      cmd.option({ type: 'boolean', args: 'none', short: 'b', long: 'beta', desc: 'Beta' })

      // -axb includes unknown 'x'
      expect(() => cmd.parse({ argv: ['-axb'], envs: {} })).toThrow('unknown option "-x"')
    })
  })

  describe('option conflicts', () => {
    it('should throw for duplicate long option in same command', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Verbose' })

      expect(() =>
        cmd.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Duplicate' }),
      ).toThrow('already defined')
    })

    it('should throw for duplicate short option in same command', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'boolean',
        args: 'none',
        short: 'v',
        long: 'verbose',
        desc: 'Verbose',
      })

      expect(() =>
        cmd.option({
          type: 'boolean',
          args: 'none',
          short: 'v',
          long: 'version',
          desc: 'Version',
        }),
      ).toThrow('already defined')
    })

    it('should throw for short option conflicts across command chain', () => {
      const root = new Command({ name: 'cli', desc: 'CLI' })
      root.option({
        type: 'boolean',
        args: 'none',
        short: 'v',
        long: 'verbose',
        desc: 'Verbose',
      })

      const child = new Command({ desc: 'Child' })
      child.option({
        type: 'boolean',
        args: 'none',
        short: 'v',
        long: 'version',
        desc: 'Version',
      })

      root.subcommand('child', child)

      expect(() => root.parse({ argv: ['child', '-v'], envs: {} })).toThrow(
        'short option "-v" conflicts',
      )
    })

    it('should throw for long option starting with no-', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.option({
          type: 'boolean',
          args: 'none',
          long: 'no-verbose',
          desc: 'No verbose',
        }),
      ).toThrow('cannot start with "no"')
    })

    it('should throw for required + default conflict', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.option({
          type: 'string',
          args: 'required',
          long: 'config',
          desc: 'Config',
          required: true,
          default: 'default.json',
        }),
      ).toThrow('cannot be both required and have a default')
    })

    it('should throw for boolean + required conflict', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.option({
          type: 'boolean',
          args: 'none',
          long: 'verbose',
          desc: 'Verbose',
          required: true,
        }),
      ).toThrow('cannot be required')
    })

    it('should throw for boolean + required args combination', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.option({
          type: 'boolean',
          args: 'required',
          long: 'verbose',
          desc: 'Verbose',
        }),
      ).toThrow("must have args: 'none'")
    })

    it('should throw for boolean + variadic args combination', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.option({
          type: 'boolean',
          args: 'variadic',
          long: 'verbose',
          desc: 'Verbose',
        }),
      ).toThrow("must have args: 'none'")
    })

    it('should throw for string + none args combination', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.option({
          type: 'string',
          args: 'none',
          long: 'output',
          desc: 'Output',
        }),
      ).toThrow("must have args: 'required' or 'variadic'")
    })

    it('should throw for number + none args combination', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.option({
          type: 'number',
          args: 'none',
          long: 'port',
          desc: 'Port',
        }),
      ).toThrow("must have args: 'required' or 'variadic'")
    })

    it('should throw for non-camelCase long option name', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.option({
          type: 'boolean',
          args: 'none',
          long: 'Verbose',
          desc: 'Verbose',
        }),
      ).toThrow('must be camelCase')
    })

    it('should throw for long option name starting with uppercase', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.option({
          type: 'boolean',
          args: 'none',
          long: 'VerboseMode',
          desc: 'Verbose',
        }),
      ).toThrow('must be camelCase')
    })
  })

  describe('run method', () => {
    it('should show version when --version or -V is used', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', desc: 'Test', version: '1.0.0' })
      cmd.action(() => {})

      await cmd.run({ argv: ['--version'], envs: {} })
      expect(consoleSpy).toHaveBeenCalledWith('1.0.0')
      consoleSpy.mockClear()

      await cmd.run({ argv: ['-V'], envs: {} })
      expect(consoleSpy).toHaveBeenCalledWith('1.0.0')
      consoleSpy.mockRestore()
    })

    it('should treat --version as normal boolean option when version is not set', async () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      let versionOptValue: unknown
      cmd.action(({ opts }) => {
        versionOptValue = opts['version']
      })

      await cmd.run({ argv: ['--version'], envs: {} })

      // When version is not set, --version is still a valid option but doesn't
      // trigger special version output, it's just parsed as a boolean option
      expect(versionOptValue).toBe(true)
    })

    it('should show help when --help or -h is used', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', desc: 'Test command' })
      cmd.action(() => {})

      await cmd.run({ argv: ['--help'], envs: {} })
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toContain('Test command')
      expect(consoleSpy.mock.calls[0][0]).toContain('Usage: test')
      consoleSpy.mockClear()

      await cmd.run({ argv: ['-h'], envs: {} })
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toContain('Test command')
      consoleSpy.mockRestore()
    })

    it('should not show help when --help is after -- terminator', async () => {
      const actionSpy = vi.fn()
      const cmd = new Command({ name: 'test', desc: 'Test command' }).argument({
        name: 'args',
        kind: 'variadic',
        desc: 'Args',
      })
      cmd.action(actionSpy)

      await cmd.run({ argv: ['--', '--help'], envs: {} })

      expect(actionSpy).toHaveBeenCalled()
    })

    it('should show help even with unknown option before --help', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', desc: 'Test command' })
      cmd.action(() => {})

      // Both long and short unknown options should allow --help detection
      await cmd.run({ argv: ['--unknown', '--help'], envs: {} })
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toContain('Test command')
      consoleSpy.mockClear()

      await cmd.run({ argv: ['-x', '--help'], envs: {} })
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toContain('Test command')
      consoleSpy.mockRestore()
    })

    it('should show help with string option followed by -- and then --help', async () => {
      const actionSpy = vi.fn()
      const cmd = new Command({ name: 'test', desc: 'Test command' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'config',
        short: 'c',
        desc: 'Config file',
      })
      cmd.argument({ name: 'args', kind: 'variadic', desc: 'Args' })
      cmd.action(actionSpy)

      // -c consumes next value, then -- terminates options, so --help is treated as arg
      await cmd.run({ argv: ['-c', 'file.json', '--', '--help'], envs: {} })

      // Action should be called since --help is after --
      expect(actionSpy).toHaveBeenCalled()
    })

    it('should show help after option that consumes a value', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', desc: 'Test command' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'config',
        short: 'c',
        desc: 'Config file',
      })
      cmd.action(() => {})

      // Both long and short options should allow --help detection after consuming value
      await cmd.run({ argv: ['--config', 'foo', '--help'], envs: {} })
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toContain('Test command')
      consoleSpy.mockClear()

      await cmd.run({ argv: ['-c', 'foo', '--help'], envs: {} })
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toContain('Test command')
      consoleSpy.mockRestore()
    })

    it('should handle action errors with exit code 1', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.action(() => {
        throw new Error('Action failed')
      })

      await cmd.run({ argv: [], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Action failed')
      expect(exitSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should handle non-Error action throws with exit code 1', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.action(() => {
        throw 'string error'
      })

      await cmd.run({ argv: [], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: action failed')
      expect(exitSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should use custom reporter when provided', async () => {
      const baseReporter = {
        setLevel: vi.fn(),
        setFlight: vi.fn(),
        log: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        hint: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
      const customReporter = {
        setLevel: vi.fn(),
        setFlight: vi.fn(),
        log: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        hint: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      let capturedCtx: ICommandActionParams['ctx'] | undefined
      const cmd = new Command({ name: 'test', desc: 'Test', reporter: baseReporter })
      cmd.action(({ ctx }) => {
        capturedCtx = ctx
      })

      await cmd.run({ argv: [], envs: { FOO: 'bar' }, reporter: customReporter })

      expect(capturedCtx?.reporter).toBe(customReporter)
      expect(capturedCtx?.envs).toEqual({ FOO: 'bar' })
    })

    it('should use reporter from constructor when not overridden', async () => {
      const baseReporter = {
        setLevel: vi.fn(),
        setFlight: vi.fn(),
        log: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        hint: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      let capturedCtx: ICommandActionParams['ctx'] | undefined
      const cmd = new Command({ name: 'test', desc: 'Test', reporter: baseReporter })
      cmd.action(({ ctx }) => {
        capturedCtx = ctx
      })

      await cmd.run({ argv: [], envs: {} })

      expect(capturedCtx?.reporter).toBe(baseReporter)
    })

    it('should show help when command has subcommands but no action', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', desc: 'CLI tool' })
      const sub = new Command({ desc: 'Initialize' })
      sub.action(() => {})
      root.subcommand('init', sub)

      // Running root without specifying subcommand
      await root.run({ argv: [], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('CLI tool')
      expect(output).toContain('Commands:')
      expect(output).toContain('init')

      consoleSpy.mockRestore()
    })

    it('should exit with code 2 for CommanderError during parsing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', long: 'config', desc: 'Config', required: true })
      cmd.action(() => {})

      await cmd.run({ argv: [], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('missing required option')
      expect(exitSpy).toHaveBeenCalledWith(2)

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should call option apply callback', async () => {
      const applySpy = vi.fn()
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'env',
        desc: 'Environment',
        apply: applySpy,
      })
      cmd.action(() => {})

      await cmd.run({ argv: ['--env', 'production'], envs: {} })

      expect(applySpy).toHaveBeenCalledWith('production', expect.objectContaining({ cmd }))
    })

    it('should not call apply when option value is undefined', async () => {
      const applySpy = vi.fn()
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'env',
        desc: 'Environment',
        apply: applySpy,
      })
      cmd.action(() => {})

      await cmd.run({ argv: [], envs: {} })

      expect(applySpy).not.toHaveBeenCalled()
    })

    it('should throw ConfigurationError when no action and no subcommands', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const cmd = new Command({ name: 'test', desc: 'Test' })
      // No action, no subcommands

      await cmd.run({ argv: [], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('no action defined')
      expect(exitSpy).toHaveBeenCalledWith(2)

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should rethrow non-CommanderError exceptions', async () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'string',
        args: 'required',
        long: 'config',
        desc: 'Config',
        coerce: () => {
          throw new TypeError('Non-CommanderError')
        },
      })
      cmd.action(() => {})

      await expect(cmd.run({ argv: ['--config', 'value'], envs: {} })).rejects.toThrow(TypeError)
    })
  })

  describe('short option edge cases', () => {
    it('should throw for short option value starting with dash (known limitation)', () => {
      // Known limitation: short options cannot accept negative numbers
      // Use long option syntax instead: --number=-1 or --number -1
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'number',
        args: 'required',
        short: 'n',
        long: 'number',
        desc: 'Number',
      })

      // -1 is interpreted as a short option, not a value for -n
      expect(() => cmd.parse({ argv: ['-n', '-1'], envs: {} })).toThrow('unknown option')
    })

    it('should accept negative number with long option equals syntax', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        type: 'number',
        args: 'required',
        short: 'n',
        long: 'number',
        desc: 'Number',
      })

      // Use --option=-value syntax for negative numbers
      const result = cmd.parse({ argv: ['--number=-1'], envs: {} })
      expect(result.opts['number']).toBe(-1)
    })
  })

  describe('argument validation', () => {
    it('should throw for required argument after optional', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'optional', desc: 'Optional', kind: 'optional' })

      expect(() => cmd.argument({ name: 'required', desc: 'Required', kind: 'required' })).toThrow(
        'cannot come after optional/variadic',
      )
    })

    it('should throw for required argument with default', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() =>
        cmd.argument({
          name: 'input',
          desc: 'Input',
          kind: 'required',
          default: 'default.txt',
        }),
      ).toThrow('required argument "input" cannot have a default value')
    })
  })

  describe('argument type conversion', () => {
    it('should convert argument to number when type is number', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'port', desc: 'Port', kind: 'required', type: 'number' })

      const result = cmd.parse({ argv: ['8080'], envs: {} })
      expect(result.args).toEqual({ port: 8080 })
      expect(result.rawArgs).toEqual(['8080'])
    })

    it('should throw for invalid number argument', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'port', desc: 'Port', kind: 'required', type: 'number' })

      expect(() => cmd.parse({ argv: ['abc'], envs: {} })).toThrow(
        'invalid number "abc" for argument "port"',
      )
    })

    it('should use coerce callback for argument conversion', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({
        name: 'port',
        desc: 'Port',
        kind: 'required',
        coerce: v => {
          const n = parseInt(v, 10)
          if (n < 0 || n > 65535) throw new Error('Invalid port')
          return n
        },
      })

      expect(cmd.parse({ argv: ['8080'], envs: {} }).args).toEqual({ port: 8080 })
      expect(() => cmd.parse({ argv: ['99999'], envs: {} })).toThrow(
        'invalid value "99999" for argument "port"',
      )
    })

    it('should prefer coerce over type conversion', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({
        name: 'value',
        desc: 'Value',
        kind: 'required',
        type: 'number',
        coerce: v => `prefix_${v}`,
      })

      const result = cmd.parse({ argv: ['123'], envs: {} })
      expect(result.args).toEqual({ value: 'prefix_123' })
    })

    it('should use default value for optional argument when not provided', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({
        name: 'env',
        desc: 'Environment',
        kind: 'optional',
        default: 'development',
      })

      const result = cmd.parse({ argv: [], envs: {} })
      expect(result.args).toEqual({ env: 'development' })
    })

    it('should override default when optional argument is provided', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({
        name: 'env',
        desc: 'Environment',
        kind: 'optional',
        default: 'development',
      })

      const result = cmd.parse({ argv: ['production'], envs: {} })
      expect(result.args).toEqual({ env: 'production' })
    })

    it('should return undefined for optional argument without default', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'output', desc: 'Output', kind: 'optional' })

      const result = cmd.parse({ argv: [], envs: {} })
      expect(result.args).toEqual({ output: undefined })
    })

    it('should convert variadic arguments to number[]', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'ports', desc: 'Ports', kind: 'variadic', type: 'number' })

      const result = cmd.parse({ argv: ['80', '443', '8080'], envs: {} })
      expect(result.args).toEqual({ ports: [80, 443, 8080] })
    })

    it('should throw for invalid number in variadic arguments', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'ports', desc: 'Ports', kind: 'variadic', type: 'number' })

      expect(() => cmd.parse({ argv: ['80', 'abc', '8080'], envs: {} })).toThrow(
        'invalid number "abc" for argument "ports"',
      )
    })

    it('should return empty array for variadic argument with no values', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'files', desc: 'Files', kind: 'variadic' })

      const result = cmd.parse({ argv: [], envs: {} })
      expect(result.args).toEqual({ files: [] })
    })
  })

  describe('TooManyArguments error', () => {
    it('should throw for too many arguments when no variadic', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'input', desc: 'Input', kind: 'required' })

      expect(() => cmd.parse({ argv: ['a.txt', 'b.txt', 'c.txt'], envs: {} })).toThrow(
        'too many arguments: expected 1, got 3',
      )
    })

    it('should throw for extra arguments with multiple defined', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'source', desc: 'Source', kind: 'required' })
      cmd.argument({ name: 'dest', desc: 'Dest', kind: 'optional' })

      expect(() => cmd.parse({ argv: ['a.txt', 'b.txt', 'c.txt'], envs: {} })).toThrow(
        'too many arguments: expected 2, got 3',
      )
    })

    it('should not throw when variadic consumes extra arguments', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'source', desc: 'Source', kind: 'required' })
      cmd.argument({ name: 'extras', desc: 'Extras', kind: 'variadic' })

      const result = cmd.parse({ argv: ['a.txt', 'b.txt', 'c.txt'], envs: {} })
      expect(result.args).toEqual({ source: 'a.txt', extras: ['b.txt', 'c.txt'] })
    })

    it('should not throw when no arguments defined and no arguments provided', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      const result = cmd.parse({ argv: [], envs: {} })
      expect(result.args).toEqual({})
    })

    it('should throw when no arguments defined but arguments provided', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })

      expect(() => cmd.parse({ argv: ['unexpected'], envs: {} })).toThrow(
        'too many arguments: expected 0, got 1',
      )
    })
  })

  describe('default type handling', () => {
    it('should treat undefined type as string', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', args: 'required', long: 'config', desc: 'Config file' }) // no type specified

      const result = cmd.parse({ argv: ['--config', 'app.json'], envs: {} })
      expect(result.opts['config']).toBe('app.json')
    })

    it('should show <value> in help for options without explicit type', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ type: 'string', args: 'required', long: 'config', desc: 'Config file' })

      const help = cmd.formatHelp()
      expect(help).toContain('--config <value>')
    })
  })

  describe('CommanderError', () => {
    it('should format error message with help hint', () => {
      const error = new CommanderError('UnknownOption', 'unknown option "--foo"', 'app sub')

      const formatted = error.format()

      expect(formatted).toBe('Error: unknown option "--foo"\nRun "app sub --help" for usage.')
    })

    it('should have correct properties', () => {
      const error = new CommanderError('InvalidChoice', 'invalid choice', 'mycli')

      expect(error.kind).toBe('InvalidChoice')
      expect(error.commandPath).toBe('mycli')
      expect(error.message).toBe('invalid choice')
      expect(error.name).toBe('CommanderError')
    })
  })

  describe('help subcommand', () => {
    it('should enable help subcommand when builtin.command is true', () => {
      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: true },
      })
      const sub = new Command({ desc: 'Initialize' })
      root.subcommand('init', sub)

      const help = root.formatHelp()
      expect(help).toContain('Commands:')
      expect(help).toContain('help')
      expect(help).toContain('Show help for a command')
    })

    it('should allow custom help subcommand when builtin.command is false', () => {
      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: false },
      })

      const helpCmd = new Command({ desc: 'Custom help' })
      helpCmd.action(() => {})

      expect(() => root.subcommand('help', helpCmd)).not.toThrow()
    })

    it('should keep help subcommand disabled when builtin.command config is empty', () => {
      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: {} },
      })

      const helpCmd = new Command({ desc: 'Custom help' })
      helpCmd.action(() => {})

      expect(() => root.subcommand('help', helpCmd)).not.toThrow()
    })

    it('should enable help subcommand when builtin is true', () => {
      const root = new Command({ name: 'cli', desc: 'CLI tool', builtin: true })
      const sub = new Command({ desc: 'Initialize' })
      root.subcommand('init', sub)

      const help = root.formatHelp()
      expect(help).toContain('Commands:')
      expect(help).toContain('help')
      expect(help).toContain('Show help for a command')
    })

    it('should show subcommand help with "help <subcommand>"', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: { help: true } },
      })

      const sub = new Command({ desc: 'Initialize project' })
      sub.option({
        type: 'string',
        args: 'required',
        long: 'template',
        desc: 'Template name',
      })
      sub.action(() => {})
      root.subcommand('init', sub)

      await root.run({ argv: ['help', 'init'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Initialize project')
      expect(output).toContain('--template')

      consoleSpy.mockRestore()
    })

    it('should show root help with "help" alone when has subcommands', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: { help: true } },
      })
      const sub = new Command({ desc: 'Initialize' })
      sub.action(() => {})
      root.subcommand('init', sub)

      await root.run({ argv: ['help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('CLI tool')

      consoleSpy.mockRestore()
    })

    it('should show help subcommand in help output when has subcommands', () => {
      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: { help: true } },
      })
      const sub = new Command({ desc: 'Initialize' })
      root.subcommand('init', sub)

      const help = root.formatHelp()

      expect(help).toContain('Commands:')
      expect(help).toContain('help')
      expect(help).toContain('Show help for a command')
    })

    it('should not show help subcommand when no subcommands', () => {
      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: { help: true } },
      })

      const help = root.formatHelp()

      expect(help).not.toContain('Commands:')
      expect(help).not.toContain('Show help for a command')
    })

    it('should not process help subcommand when not enabled', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI tool' })
      // NOT setting help: true

      // When help is not enabled and there are subcommands, "help" is not a subcommand
      // Routing stops at root because "help" is not a registered subcommand name
      // Since root has subcommands but no action, it will show help
      const sub = new Command({ desc: 'Initialize' })
      sub.action(() => {})
      root.subcommand('init', sub)

      // "help" is not a registered subcommand, routing stops at root
      // Root has subcommands but no action, so it shows help (with "too many arguments" error
      // because "help" and "init" become positional args but root has no arguments defined)
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      await root.run({ argv: ['help', 'init'], envs: {} })

      // Should throw "too many arguments" error because root has no arguments defined
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('too many arguments')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should handle unknown subcommand in help', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: { help: true } },
      })

      const sub = new Command({ desc: 'Initialize' })
      sub.action(() => {})
      root.subcommand('init', sub)

      // "help unknown" transforms to "unknown --help", but "unknown" is not a subcommand
      // Routing stops at root, "unknown" becomes positional arg
      // Root has no arguments defined, so "too many arguments" error
      await root.run({ argv: ['help', 'unknown'], envs: {} })

      // Should throw "too many arguments" error
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('too many arguments')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should work with subcommand aliases', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: { help: true } },
      })

      const sub = new Command({ desc: 'Initialize project' })
      sub.action(() => {})
      root.subcommand('initialize', sub).subcommand('init', sub).subcommand('i', sub)

      await root.run({ argv: ['help', 'init'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Initialize project')

      consoleSpy.mockRestore()
    })

    it('should throw when subcommand name conflicts with reserved "help"', () => {
      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: { help: true } },
      })

      const helpCmd = new Command({ desc: 'Custom help' })

      expect(() => root.subcommand('help', helpCmd)).toThrow('reserved subcommand name')
    })

    it('should throw when subcommand alias conflicts with reserved "help"', () => {
      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: { help: true } },
      })

      const cmd = new Command({ desc: 'Info' })
      root.subcommand('info', cmd)

      expect(() => root.subcommand('help', cmd)).toThrow('reserved subcommand name')
    })

    it('should allow "help" subcommand when help is not enabled', () => {
      const root = new Command({ name: 'cli', desc: 'CLI tool' })

      const helpCmd = new Command({ desc: 'Custom help' })
      helpCmd.action(() => {})

      // Should not throw
      expect(() => root.subcommand('help', helpCmd)).not.toThrow()
    })

    it('should show help when help:true and no subcommands', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({
        name: 'cli',
        desc: 'CLI tool',
        builtin: { command: { help: true } },
      })
      root.action(() => {})

      await root.run({ argv: ['help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('CLI tool')

      consoleSpy.mockRestore()
    })

    it('should treat help as positional arg when help:false and no subcommands', async () => {
      let receivedArgs: Record<string, unknown> = {}
      const root = new Command({ name: 'cli', desc: 'CLI tool' })
      root.argument({ name: 'cmd', kind: 'optional', desc: 'Command' })
      root.action(({ args }) => {
        receivedArgs = args
      })

      await root.run({ argv: ['help'], envs: {} })

      expect(receivedArgs).toEqual({ cmd: 'help' })
    })
  })

  describe('option bubbling', () => {
    it('should bubble unknown options to parent', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'verbose',
        short: 'v',
        type: 'boolean',
        args: 'none',
        desc: 'Verbose',
      })

      const child = new Command({ desc: 'Child' })
        .option({
          long: 'output',
          short: 'o',
          type: 'string',
          args: 'required',
          desc: 'Output',
        })
        .action(({ opts }) => {
          expect(opts['verbose']).toBe(true)
          expect(opts['output']).toBe('file.txt')
        })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--output', 'file.txt', '--verbose'], envs: {} })
    })

    it('should let child consume first when same option name exists', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        desc: 'Root verbose',
      })

      const child = new Command({ desc: 'Child' })
        .option({ long: 'verbose', type: 'boolean', args: 'none', desc: 'Child verbose' })
        .action(({ opts }) => {
          // Child consumes --verbose, merge order is root → leaf, so child overwrites
          expect(opts['verbose']).toBe(true)
        })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--verbose'], envs: {} })
    })

    it('should not shift options after --', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        desc: 'Verbose',
      })

      const child = new Command({ desc: 'Child' })
        .argument({ name: 'files', kind: 'variadic', desc: 'Files' })
        .action(({ opts, args, rawArgs }) => {
          expect(opts['verbose']).toBe(false) // --verbose is after --, not parsed
          expect(args).toEqual({ files: ['--verbose', 'file.txt'] })
          expect(rawArgs).toEqual(['--verbose', 'file.txt'])
        })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--', '--verbose', 'file.txt'], envs: {} })
    })

    it('should apply options from root to leaf', async () => {
      const order: string[] = []

      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'config',
        type: 'string',
        args: 'required',
        desc: 'Config',
        apply: () => order.push('root-config'),
      })

      const child = new Command({ desc: 'Child' })
        .option({
          long: 'env',
          type: 'string',
          args: 'required',
          desc: 'Env',
          apply: () => order.push('child-env'),
        })
        .action(() => {
          expect(order).toEqual(['root-config', 'child-env'])
        })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--config', 'a', '--env', 'b'], envs: {} })
    })

    it('should throw for truly unknown options', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', desc: 'CLI' })
      const child = new Command({ desc: 'Child' }).action(() => {})

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--unknown'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('unknown option')
      // Error message should contain full command path
      expect(errorOutput).toContain('cli child')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should merge options with child overwriting root for same key', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'level',
        type: 'number',
        args: 'required',
        default: 1,
        desc: 'Level',
      })

      const child = new Command({ desc: 'Child' })
        .option({
          long: 'level',
          type: 'number',
          args: 'required',
          default: 2,
          desc: 'Child level',
        })
        .action(({ opts }) => {
          // No --level provided, but defaults merge with child overwriting root
          expect(opts['level']).toBe(2)
        })

      root.subcommand('child', child)

      await root.run({ argv: ['child'], envs: {} })
    })

    it('should work with multiple levels of nesting', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'global',
        type: 'boolean',
        args: 'none',
        desc: 'Global',
      })

      const parent = new Command({ desc: 'Parent' }).option({
        long: 'parentOpt',
        type: 'string',
        args: 'required',
        desc: 'Parent opt',
      })

      const child = new Command({ desc: 'Child' })
        .option({ long: 'childOpt', type: 'string', args: 'required', desc: 'Child opt' })
        .action(({ opts }) => {
          expect(opts['global']).toBe(true)
          expect(opts['parentOpt']).toBe('p')
          expect(opts['childOpt']).toBe('c')
        })

      parent.subcommand('child', child)
      root.subcommand('parent', parent)

      await root.run({
        argv: ['parent', 'child', '--child-opt', 'c', '--parent-opt', 'p', '--global'],
        envs: {},
      })
    })

    it('should bubble short options to parent', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'verbose',
        short: 'v',
        type: 'boolean',
        args: 'none',
        desc: 'Verbose',
      })

      const child = new Command({ desc: 'Child' })
        .option({
          long: 'output',
          short: 'o',
          type: 'string',
          args: 'required',
          desc: 'Output',
        })
        .action(({ opts }) => {
          expect(opts['verbose']).toBe(true)
          expect(opts['output']).toBe('file.txt')
        })

      root.subcommand('child', child)

      // Use -v (short) which should bubble to root
      await root.run({ argv: ['child', '-o', 'file.txt', '-v'], envs: {} })
    })

    it('should handle combined short options with bubbling', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'verbose',
        short: 'v',
        type: 'boolean',
        args: 'none',
        desc: 'Verbose',
      })

      const child = new Command({ desc: 'Child' })
        .option({ long: 'debug', short: 'd', type: 'boolean', args: 'none', desc: 'Debug' })
        .action(({ opts }) => {
          expect(opts['verbose']).toBe(true)
          expect(opts['debug']).toBe(true)
        })

      root.subcommand('child', child)

      // Combined -dv, child consumes -d, -v bubbles to root
      await root.run({ argv: ['child', '-dv'], envs: {} })
    })

    it('should handle --option=value syntax with bubbling', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'config',
        type: 'string',
        args: 'required',
        desc: 'Config',
      })

      const child = new Command({ desc: 'Child' }).action(({ opts }) => {
        expect(opts['config']).toBe('app.json')
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--config=app.json'], envs: {} })
    })

    it('should handle --boolean=true/false syntax with bubbling', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        default: true,
        desc: 'Verbose',
      })

      let capturedOpts: Record<string, unknown> = {}
      const child = new Command({ desc: 'Child' }).action(({ opts }) => {
        capturedOpts = opts
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--verbose=true'], envs: {} })
      expect(capturedOpts['verbose']).toBe(true)

      await root.run({ argv: ['child', '--verbose=false'], envs: {} })
      expect(capturedOpts['verbose']).toBe(false)
    })

    it('should handle --no-option syntax with bubbling', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        default: true,
        desc: 'Verbose',
      })

      const child = new Command({ desc: 'Child' }).action(({ opts }) => {
        expect(opts['verbose']).toBe(false)
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--no-verbose'], envs: {} })
    })

    it('should throw error for -o=value on known short option', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'output',
        short: 'o',
        type: 'string',
        args: 'required',
        desc: 'Output',
      })

      const child = new Command({ desc: 'Child' }).action(() => {})

      root.subcommand('child', child)

      await root.run({ argv: ['child', '-o=file.txt'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('not supported')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should throw for short option requiring value without next token', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'output',
        short: 'o',
        type: 'string',
        args: 'required',
        desc: 'Output',
      })

      const child = new Command({ desc: 'Child' }).action(() => {})

      root.subcommand('child', child)

      // -o without value (no next token)
      await root.run({ argv: ['child', '-o'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('requires a value')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should throw for combined short options with value option not last', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', desc: 'CLI' })
        .option({
          long: 'output',
          short: 'o',
          type: 'string',
          args: 'required',
          desc: 'Output',
        })
        .option({
          long: 'verbose',
          short: 'v',
          type: 'boolean',
          args: 'none',
          desc: 'Verbose',
        })

      const child = new Command({ desc: 'Child' }).action(() => {})

      root.subcommand('child', child)

      // -ov where -o takes value but is not last, -o requires value but -v is an option not a value
      await root.run({ argv: ['child', '-ov'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('requires a value')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should throw for invalid boolean value in bubbled option', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        args: 'none',
        desc: 'Verbose',
      })

      const child = new Command({ desc: 'Child' }).action(() => {})

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--verbose=invalid'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('Use "true" or "false"')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should throw for missing value in bubbled string option', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'output',
        type: 'string',
        args: 'required',
        desc: 'Output',
      })

      const child = new Command({ desc: 'Child' }).action(() => {})

      root.subcommand('child', child)

      // --output without value at end of argv
      await root.run({ argv: ['child', '--output'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('requires a value')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should handle bubbling with number options', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'port',
        type: 'number',
        args: 'required',
        desc: 'Port',
      })

      const child = new Command({ desc: 'Child' }).action(({ opts }) => {
        expect(opts['port']).toBe(8080)
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--port', '8080'], envs: {} })
    })

    it('should handle bubbling with array options', async () => {
      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'include',
        type: 'string',
        args: 'variadic',
        desc: 'Include',
      })

      const child = new Command({ desc: 'Child' }).action(({ opts }) => {
        expect(opts['include']).toEqual(['a', 'b'])
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--include', 'a', '--include', 'b'], envs: {} })
    })

    it('should throw for missing required argument in subcommand', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', desc: 'CLI' })

      const child = new Command({ desc: 'Child' })
        .argument({ name: 'file', kind: 'required', desc: 'File' })
        .action(() => {})

      root.subcommand('child', child)

      await root.run({ argv: ['child'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('missing required argument')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should validate choices in shift for bubbled options', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'env',
        type: 'string',
        args: 'required',
        desc: 'Env',
        choices: ['dev', 'prod'],
      })

      const child = new Command({ desc: 'Child' }).action(() => {})

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--env', 'staging'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('invalid value')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should handle --help after option requiring value before --', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', desc: 'CLI' }).option({
        long: 'config',
        type: 'string',
        args: 'required',
        desc: 'Config',
      })

      const child = new Command({ desc: 'Child' }).action(() => {})

      root.subcommand('child', child)

      // --config foo --help - help should be detected even after --config
      await root.run({ argv: ['child', '--config', 'foo', '--help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Child')

      consoleSpy.mockRestore()
    })

    it('should not detect --help after -- terminator in subcommand', async () => {
      const actionSpy = vi.fn()

      const root = new Command({ name: 'cli', desc: 'CLI' })

      const child = new Command({ desc: 'Child' })
        .argument({ name: 'args', kind: 'variadic', desc: 'Args' })
        .action(actionSpy)

      root.subcommand('child', child)

      // -- --help: the --help is after --, so it should not trigger help display
      await root.run({ argv: ['child', '--', '--help'], envs: {} })

      expect(actionSpy).toHaveBeenCalled()
      expect(actionSpy.mock.calls[0][0].args).toEqual({ args: ['--help'] })
      expect(actionSpy.mock.calls[0][0].rawArgs).toEqual(['--help'])
    })
  })

  describe('kebab-case/camelCase naming convention', () => {
    it('should accept kebab-case input and map to camelCase option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', args: 'required', desc: 'Log level' })

      const result = cmd.parse({ argv: ['--log-level', 'debug'], envs: {} })
      expect(result.opts['logLevel']).toBe('debug')
    })

    it('should be case-insensitive for kebab-case input', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', args: 'required', desc: 'Log level' })

      expect(cmd.parse({ argv: ['--LOG-LEVEL', 'debug'], envs: {} }).opts['logLevel']).toBe('debug')
      expect(cmd.parse({ argv: ['--Log-Level', 'info'], envs: {} }).opts['logLevel']).toBe('info')
    })

    it('should preserve value case', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'name', type: 'string', args: 'required', desc: 'Name' })

      const result = cmd.parse({ argv: ['--name', 'MyApp'], envs: {} })
      expect(result.opts['name']).toBe('MyApp')
    })

    it('should preserve value case with inline syntax', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'name', type: 'string', args: 'required', desc: 'Name' })

      const result = cmd.parse({ argv: ['--name=MyApp'], envs: {} })
      expect(result.opts['name']).toBe('MyApp')
    })

    it('should throw for underscore in option name', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', args: 'required', desc: 'Log level' })

      expect(() => cmd.parse({ argv: ['--log_level', 'debug'], envs: {} })).toThrow(
        "use '-' instead of '_'",
      )
    })

    it('should throw for invalid option format (consecutive dashes)', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', args: 'required', desc: 'Log level' })

      expect(() => cmd.parse({ argv: ['--log--level', 'debug'], envs: {} })).toThrow(
        'invalid option format',
      )
    })

    it('should throw for option starting with number', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'verbose', type: 'boolean', args: 'none', desc: 'Verbose' })

      expect(() => cmd.parse({ argv: ['--2fa'], envs: {} })).toThrow('invalid option format')
    })

    it('should throw for incomplete negative option --no', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'verbose', type: 'boolean', args: 'none', desc: 'Verbose' })

      expect(() => cmd.parse({ argv: ['--no'], envs: {} })).toThrow(
        'invalid negative option syntax',
      )
    })

    it('should throw for incomplete negative option --no-', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'verbose', type: 'boolean', args: 'none', desc: 'Verbose' })

      expect(() => cmd.parse({ argv: ['--no-'], envs: {} })).toThrow(
        'invalid negative option syntax',
      )
    })

    it('should throw NegativeOptionType when --no-xxx is used on non-boolean option', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'output', type: 'string', args: 'required', desc: 'Output' })

      // --no-xxx can only be used with boolean options
      expect(() => cmd.parse({ argv: ['--no-output'], envs: {} })).toThrow(
        'can only be used with boolean options',
      )
    })

    it('should convert --no-xxx to false for boolean options', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'verbose', type: 'boolean', args: 'none', desc: 'Verbose' })

      const result = cmd.parse({ argv: ['--no-verbose'], envs: {} })
      expect(result.opts['verbose']).toBe(false)
    })

    it('should handle kebab-case in --no-xxx', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({
        long: 'colorOutput',
        type: 'boolean',
        args: 'none',
        desc: 'Color output',
      })

      const result = cmd.parse({ argv: ['--no-color-output'], envs: {} })
      expect(result.opts['colorOutput']).toBe(false)
    })

    it('should display options in kebab-case in help', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', args: 'required', desc: 'Log level' })
      cmd.option({
        long: 'colorOutput',
        type: 'boolean',
        args: 'none',
        desc: 'Color output',
      })

      const help = cmd.formatHelp()
      expect(help).toContain('--log-level')
      expect(help).toContain('--color-output')
      expect(help).toContain('--no-color-output')
    })

    it('should not process options after --', () => {
      const cmd = new Command({ name: 'test', desc: 'Test' })
      cmd.argument({ name: 'args', kind: 'variadic', desc: 'Args' })

      const result = cmd.parse({ argv: ['--', '--log_level', '--2fa', '--no-'], envs: {} })
      expect(result.rawArgs).toEqual(['--log_level', '--2fa', '--no-'])
    })
  })
})
