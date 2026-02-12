import { vi } from 'vitest'
import type { IActionParams } from '../src'
import { Command, CommanderError } from '../src'

describe('Command', () => {
  describe('constructor', () => {
    it('should create with basic config', () => {
      const cmd = new Command({ name: 'test', description: 'Test command' })
      expect(cmd.name).toBe('test')
      expect(cmd.description).toBe('Test command')
    })

    it('should accept version', () => {
      const cmd = new Command({ name: 'test', description: 'Test', version: '1.0.0' })
      expect(cmd.version).toBe('1.0.0')
    })

    it('should expose options property', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })

      const options = cmd.options
      expect(options.length).toBeGreaterThan(0)
      expect(options.some(o => o.long === 'verbose')).toBe(true)
    })

    it('should expose arguments property', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'file', description: 'File', kind: 'required' })

      const args = cmd.arguments
      expect(args).toHaveLength(1)
      expect(args[0].name).toBe('file')
    })
  })

  describe('option', () => {
    it('should add boolean option', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', short: 'v', long: 'verbose', description: 'Verbose output' })

      const result = cmd.parse(['--verbose'])
      expect(result.opts['verbose']).toBe(true)
    })

    it('should parse short option', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', short: 'v', long: 'verbose', description: 'Verbose' })

      const result = cmd.parse(['-v'])
      expect(result.opts['verbose']).toBe(true)
    })

    it('should add string option', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', short: 'o', long: 'output', description: 'Output file' })

      const result = cmd.parse(['--output', 'file.txt'])
      expect(result.opts['output']).toBe('file.txt')
    })

    it('should parse string option with equals sign', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', long: 'output', description: 'Output file' })

      const result = cmd.parse(['--output=file.txt'])
      expect(result.opts['output']).toBe('file.txt')
    })

    it('should add number option', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'number', short: 'p', long: 'port', description: 'Port number' })

      const result = cmd.parse(['--port', '8080'])
      expect(result.opts['port']).toBe(8080)
    })

    it('should throw for invalid number', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'number', long: 'port', description: 'Port number' })

      expect(() => cmd.parse(['--port', 'abc'])).toThrow('invalid number')
    })

    it('should use default value when option not provided', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', long: 'env', description: 'Environment', default: 'dev' })

      const result = cmd.parse([])
      expect(result.opts['env']).toBe('dev')
    })

    it('should validate choices', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        type: 'string',
        long: 'env',
        description: 'Environment',
        choices: ['dev', 'prod'],
      })

      expect(() => cmd.parse(['--env', 'staging'])).toThrow('invalid value')
    })

    it('should throw for unknown option', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      expect(() => cmd.parse(['--unknown'])).toThrow('unknown option')
    })

    it('should throw for missing option value', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', long: 'output', description: 'Output' })

      expect(() => cmd.parse(['--output'])).toThrow('requires a value')
    })

    it('should throw for missing required option', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', long: 'config', description: 'Config file', required: true })

      expect(() => cmd.parse([])).toThrow('missing required option')
    })

    it('should support --no-{option} for boolean options', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })

      const result = cmd.parse(['--no-verbose'])
      expect(result.opts['verbose']).toBe(false)
    })

    it('should support --option=true/false for boolean options', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })

      expect(cmd.parse(['--verbose=true']).opts['verbose']).toBe(true)
      expect(cmd.parse(['--verbose=false']).opts['verbose']).toBe(false)
    })

    it('should throw for invalid boolean value', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })

      expect(() => cmd.parse(['--verbose=yes'])).toThrow('Use "true" or "false"')
    })

    it('should throw for --no-option with value', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })

      expect(() => cmd.parse(['--no-verbose=true'])).toThrow('does not accept a value')
    })

    it('should support Last Write Wins for boolean options', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })

      expect(cmd.parse(['--verbose', '--no-verbose']).opts['verbose']).toBe(false)
      expect(cmd.parse(['--no-verbose', '--verbose']).opts['verbose']).toBe(true)
    })

    it('should support string[] option with append', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string[]', long: 'include', description: 'Include paths' })

      const result = cmd.parse(['--include', 'a', '--include', 'b'])
      expect(result.opts['include']).toEqual(['a', 'b'])
    })

    it('should support number[] option with append', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'number[]', long: 'port', description: 'Ports' })

      const result = cmd.parse(['--port', '80', '--port', '443'])
      expect(result.opts['port']).toEqual([80, 443])
    })

    it('should support coerce callback', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        type: 'number',
        long: 'port',
        description: 'Port',
        coerce: v => {
          const n = parseInt(v, 10)
          if (n < 0 || n > 65535) throw new Error('Invalid port')
          return n
        },
      })

      expect(cmd.parse(['--port', '8080']).opts['port']).toBe(8080)
      expect(() => cmd.parse(['--port', '99999'])).toThrow('Invalid port')
    })

    it('should support resolver callback', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        long: 'header',
        description: 'Headers',
        resolver: tokens => {
          const headers: Record<string, string> = {}
          const remaining: typeof tokens = []
          for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i]
            if (token.resolved === '--header' && i + 1 < tokens.length) {
              const [key, val] = tokens[i + 1].original.split(': ')
              headers[key] = val
              i++
            } else if (token.resolved.startsWith('--header=')) {
              const [key, val] = token.resolved.slice(9).split(': ')
              headers[key] = val
            } else {
              remaining.push(token)
            }
          }
          return { value: headers, remaining }
        },
      })

      const result = cmd.parse(['--header', 'X-Foo: bar', '--header', 'X-Bar: baz'])
      expect(result.opts['header']).toEqual({ 'X-Foo': 'bar', 'X-Bar': 'baz' })
    })
  })

  describe('argument', () => {
    it('should parse required argument', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'input', description: 'Input file', kind: 'required' })

      const result = cmd.parse(['file.txt'])
      expect(result.args).toEqual({ input: 'file.txt' })
      expect(result.rawArgs).toEqual(['file.txt'])
    })

    it('should parse optional argument', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'output', description: 'Output file', kind: 'optional' })

      const result = cmd.parse([])
      expect(result.args).toEqual({ output: undefined })
      expect(result.rawArgs).toEqual([])
    })

    it('should parse variadic argument', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'files', description: 'Input files', kind: 'variadic' })

      const result = cmd.parse(['a.txt', 'b.txt', 'c.txt'])
      expect(result.args).toEqual({ files: ['a.txt', 'b.txt', 'c.txt'] })
      expect(result.rawArgs).toEqual(['a.txt', 'b.txt', 'c.txt'])
    })

    it('should throw for missing required argument', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'input', description: 'Input file', kind: 'required' })

      expect(() => cmd.parse([])).toThrow('missing required argument')
    })

    it('should throw for multiple variadic arguments', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'files1', description: 'Files 1', kind: 'variadic' })

      expect(() =>
        cmd.argument({ name: 'files2', description: 'Files 2', kind: 'variadic' }),
      ).toThrow('only one variadic')
    })

    it('should throw if variadic is not last', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'files', description: 'Files', kind: 'variadic' })

      expect(() => cmd.argument({ name: 'extra', description: 'Extra', kind: 'required' })).toThrow(
        'variadic argument must be the last',
      )
    })
  })

  describe('positional arguments mixed with options', () => {
    it('should accept positional argument after option', async () => {
      let receivedArgs: Record<string, unknown> = {}
      let receivedOpts: Record<string, unknown> = {}
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', long: 'opt', description: 'Option' })
      cmd.argument({ name: 'arg', kind: 'required', description: 'Arg' })
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
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', long: 'opt', description: 'Option' })
      cmd.argument({ name: 'arg', kind: 'required', description: 'Arg' })
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
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', long: 'opt', description: 'Option' })
      cmd.argument({ name: 'files', kind: 'variadic', description: 'Files' })
      cmd.action(({ opts, args }) => {
        receivedOpts = opts
        receivedArgs = args
      })

      await cmd.run({ argv: ['arg1', '--opt', 'val', 'arg2'], envs: {} })
      expect(receivedOpts['opt']).toBe('val')
      expect(receivedArgs).toEqual({ files: ['arg1', 'arg2'] })
    })

    it('should accept positional argument in subcommand after options', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.option({ type: 'boolean', long: 'verbose', short: 'v', description: 'Verbose' })

      let receivedArgs: Record<string, unknown> = {}
      let receivedOpts: Record<string, unknown> = {}
      const sub = new Command({ description: 'Sub' })
      sub.option({ type: 'string', long: 'output', short: 'o', description: 'Output' })
      sub.argument({ name: 'file', kind: 'required', description: 'File' })
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
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.option({ type: 'boolean', long: 'verbose', short: 'v', description: 'Verbose' })

      let receivedArgs: Record<string, unknown> = {}
      let receivedOpts: Record<string, unknown> = {}
      const sub = new Command({ description: 'Sub' })
      sub.option({ type: 'string', long: 'output', short: 'o', description: 'Output' })
      sub.argument({ name: 'file', kind: 'required', description: 'File' })
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
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'files', kind: 'variadic', description: 'Files' })
      cmd.action(({ args }) => {
        receivedArgs = args
      })

      await cmd.run({ argv: ['--', '--looks-like-option', 'arg'], envs: {} })
      expect(receivedArgs).toEqual({ files: ['--looks-like-option', 'arg'] })
    })
  })

  describe('subcommand', () => {
    it('should route to subcommand via run', async () => {
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      const sub = new Command({ description: 'Initialize' }).argument({
        name: 'args',
        kind: 'variadic',
        description: 'Args',
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
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      const sub = new Command({ description: 'Initialize' }).argument({
        name: 'name',
        description: 'Name',
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
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      const sub = new Command({ description: 'Initialize' })

      let executed = false
      sub.action(() => {
        executed = true
      })
      root.subcommand('initialize', sub).subcommand('init', sub).subcommand('i', sub)

      await root.run({ argv: ['i'], envs: {} })
      expect(executed).toBe(true)
    })

    it('should stop routing at option-like token', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })
      root.argument({ name: 'args', kind: 'variadic', description: 'Args' })
      const sub = new Command({ description: 'Start' })
      sub.action(() => {})
      root.subcommand('start', sub)

      // pm --verbose start should NOT route to start
      // start becomes a positional argument for root
      const result = root.parse(['--verbose', 'start'])
      expect(result.opts['verbose']).toBe(true)
      expect(result.rawArgs).toEqual(['start'])
      expect(result.args).toEqual({ args: ['start'] })
    })

    it('should set registered name on subcommand', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      const sub = new Command({ description: 'Build' })
      root.subcommand('build', sub)

      expect(sub.name).toBe('build')
    })

    it('should collect aliases when same command registered multiple times', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      const sub = new Command({ description: 'Build' })
      root.subcommand('build', sub).subcommand('b', sub).subcommand('compile', sub)

      // First registration is the name, subsequent are aliases
      expect(sub.name).toBe('build')
      // Aliases are stored in the entry, accessible via getCompletionMeta
      const meta = root.getCompletionMeta()
      const subMeta = meta.subcommands.find(s => s.name === 'build')
      expect(subMeta?.aliases).toEqual(['b', 'compile'])
    })
  })

  describe('action', () => {
    it('should execute action', async () => {
      const action = vi.fn()
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.action(action)

      await cmd.run({ argv: [], envs: {} })
      expect(action).toHaveBeenCalledTimes(1)
    })

    it('should pass context to action', async () => {
      let params: IActionParams | undefined
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', long: 'name', description: 'Name' })
      cmd.argument({ name: 'file', description: 'File', kind: 'required' })
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
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.action(({ ctx }) => {
        ctx.reporter.debug('debug message')
        ctx.reporter.info('info message')
        ctx.reporter.warn('warn message')
        ctx.reporter.error('error message')
      })

      await cmd.run({ argv: [], envs: {} })

      expect(debugSpy).toHaveBeenCalledWith('debug message')
      expect(infoSpy).toHaveBeenCalledWith('info message')
      expect(warnSpy).toHaveBeenCalledWith('warn message')
      expect(errorSpy).toHaveBeenCalledWith('error message')

      debugSpy.mockRestore()
      infoSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })

  describe('parse rest arguments', () => {
    it('should collect arguments after --', () => {
      const cmd = new Command({ name: 'test', description: 'Test' }).argument({
        name: 'extras',
        kind: 'variadic',
        description: 'Extras',
      })

      const result = cmd.parse(['--', 'extra1', '--extra2'])
      expect(result.rawArgs).toEqual(['extra1', '--extra2'])
      expect(result.args).toEqual({ extras: ['extra1', '--extra2'] })
    })
  })

  describe('built-in options', () => {
    it('should have --help option', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      const result = cmd.parse(['--help'])
      expect(result.opts['help']).toBe(true)
    })

    it('should have --version option', () => {
      const cmd = new Command({ name: 'test', description: 'Test', version: '1.0.0' })
      const result = cmd.parse(['--version'])
      expect(result.opts['version']).toBe(true)
    })

    it('should not inherit built-in --version for subcommands', () => {
      const root = new Command({ name: 'cli', description: 'CLI', version: '1.0.0' })
      const sub = new Command({ description: 'Sub' })
      root.subcommand('sub', sub)

      expect(() => root.parse(['sub', '--version'])).toThrow('unknown option "--version"')
    })
  })

  describe('formatHelp', () => {
    it('should generate help text', () => {
      const cmd = new Command({ name: 'mycli', description: 'My CLI tool', version: '1.0.0' })
      cmd.option({
        type: 'string',
        short: 'o',
        long: 'output',
        description: 'Output file',
      })
      cmd.argument({ name: 'input', description: 'Input file', kind: 'required' })

      const help = cmd.formatHelp()

      expect(help).toContain('Usage: mycli')
      expect(help).toContain('My CLI tool')
      expect(help).toContain('-o, --output')
      expect(help).toContain('Output file')
      expect(help).toContain('<input>')
    })

    it('should show optional argument in usage', () => {
      const cmd = new Command({ name: 'mycli', description: 'My CLI' })
      cmd.argument({ name: 'output', description: 'Output file', kind: 'optional' })

      const help = cmd.formatHelp()

      expect(help).toContain('[output]')
    })

    it('should show variadic argument in usage', () => {
      const cmd = new Command({ name: 'mycli', description: 'My CLI' })
      cmd.argument({ name: 'files', description: 'Input files', kind: 'variadic' })

      const help = cmd.formatHelp()

      expect(help).toContain('[files...]')
    })

    it('should show subcommands in help', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.subcommand('init', new Command({ description: 'Initialize project' }))
      root.subcommand('build', new Command({ description: 'Build project' }))

      const help = root.formatHelp()

      expect(help).toContain('Commands:')
      expect(help).toContain('init')
      expect(help).toContain('Initialize project')
      expect(help).toContain('build')
    })

    it('should show subcommand aliases in help', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      const sub = new Command({ description: 'Initialize project' })
      root.subcommand('initialize', sub).subcommand('init', sub).subcommand('i', sub)

      const help = root.formatHelp()

      expect(help).toContain('initialize, init, i')
    })

    it('should show default values', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        type: 'string',
        long: 'env',
        description: 'Environment',
        default: 'development',
      })

      const help = cmd.formatHelp()
      expect(help).toContain('(default: "development")')
    })

    it('should show choices', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        type: 'string',
        long: 'format',
        description: 'Output format',
        choices: ['json', 'yaml'],
      })

      const help = cmd.formatHelp()
      expect(help).toContain('[choices: json, yaml]')
    })

    it('should show --no-{option} for boolean options with negate description', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        type: 'boolean',
        long: 'verbose',
        description: 'Verbose output',
      })

      const help = cmd.formatHelp()
      expect(help).toContain('--verbose')
      expect(help).toContain('--no-verbose')
      expect(help).toContain('Negate --verbose')
    })
  })

  describe('getCompletionMeta', () => {
    it('should return completion metadata', () => {
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      root.option({ type: 'string', short: 'c', long: 'config', description: 'Config file' })

      const sub = new Command({ description: 'Initialize' })
      root.subcommand('init', sub)

      const meta = root.getCompletionMeta()

      expect(meta.name).toBe('cli')
      expect(meta.description).toBe('CLI tool')
      expect(meta.options).toContainEqual(expect.objectContaining({ long: 'config' }))
      expect(meta.subcommands).toHaveLength(1)
      expect(meta.subcommands[0].name).toBe('init')
    })

    it('should include aliases in subcommand metadata', () => {
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      const sub = new Command({ description: 'Build' })
      root.subcommand('build', sub).subcommand('b', sub)

      const meta = root.getCompletionMeta()

      expect(meta.subcommands[0].name).toBe('build')
      expect(meta.subcommands[0].aliases).toEqual(['b'])
    })
  })

  describe('combined short options', () => {
    it('should parse combined short boolean options', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', short: 'a', long: 'alpha', description: 'Alpha' })
      cmd.option({ type: 'boolean', short: 'b', long: 'beta', description: 'Beta' })
      cmd.option({ type: 'boolean', short: 'c', long: 'gamma', description: 'Gamma' })

      const result = cmd.parse(['-abc'])

      expect(result.opts['alpha']).toBe(true)
      expect(result.opts['beta']).toBe(true)
      expect(result.opts['gamma']).toBe(true)
    })

    it('should parse combined short options with value at end', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', short: 'v', long: 'verbose', description: 'Verbose' })
      cmd.option({ type: 'string', short: 'o', long: 'output', description: 'Output' })

      const result = cmd.parse(['-vo', 'file.txt'])

      expect(result.opts['verbose']).toBe(true)
      expect(result.opts['output']).toBe('file.txt')
    })

    it('should throw for unsupported -o=value syntax', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', short: 'o', long: 'output', description: 'Output' })

      expect(() => cmd.parse(['-o=file.txt'])).toThrow('not supported')
    })

    it('should throw for unsupported -ovalue syntax', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', short: 'o', long: 'output', description: 'Output' })
      cmd.option({ type: 'boolean', short: 'v', long: 'verbose', description: 'Verbose' })

      // -ofile would look like -o -f -i -l -e but -o takes value
      // So this should error
      expect(() => cmd.parse(['-ofile'])).toThrow('not supported')
    })

    it('should throw for unknown short option in combined form', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', short: 'a', long: 'alpha', description: 'Alpha' })
      cmd.option({ type: 'boolean', short: 'b', long: 'beta', description: 'Beta' })

      // -axb includes unknown 'x'
      expect(() => cmd.parse(['-axb'])).toThrow('unknown option "-x"')
    })
  })

  describe('option conflicts', () => {
    it('should throw for duplicate long option in same command', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })

      expect(() =>
        cmd.option({ type: 'boolean', long: 'verbose', description: 'Duplicate' }),
      ).toThrow('already defined')
    })

    it('should throw for duplicate short option in same command', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', short: 'v', long: 'verbose', description: 'Verbose' })

      expect(() =>
        cmd.option({ type: 'boolean', short: 'v', long: 'version', description: 'Version' }),
      ).toThrow('already defined')
    })

    it('should throw for short option conflicts across command chain', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.option({ type: 'boolean', short: 'v', long: 'verbose', description: 'Verbose' })

      const child = new Command({ description: 'Child' })
      child.option({ type: 'boolean', short: 'v', long: 'version', description: 'Version' })

      root.subcommand('child', child)

      expect(() => root.parse(['child', '-v'])).toThrow('short option "-v" conflicts')
    })

    it('should throw for long option starting with no-', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })

      expect(() =>
        cmd.option({ type: 'boolean', long: 'no-verbose', description: 'No verbose' }),
      ).toThrow('cannot start with "no-"')
    })

    it('should throw for required + default conflict', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })

      expect(() =>
        cmd.option({
          type: 'string',
          long: 'config',
          description: 'Config',
          required: true,
          default: 'default.json',
        }),
      ).toThrow('cannot be both required and have a default')
    })

    it('should throw for boolean + required conflict', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })

      expect(() =>
        cmd.option({
          type: 'boolean',
          long: 'verbose',
          description: 'Verbose',
          required: true,
        }),
      ).toThrow('cannot be required')
    })
  })

  describe('run method', () => {
    it('should show version when --version is used', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', description: 'Test', version: '1.0.0' })
      cmd.action(() => {})

      await cmd.run({ argv: ['--version'], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith('1.0.0')
      consoleSpy.mockRestore()
    })

    it('should show unknown when version is not set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.action(() => {})

      await cmd.run({ argv: ['--version'], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith('unknown')
      consoleSpy.mockRestore()
    })

    it('should show help when --help is used', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', description: 'Test command' })
      cmd.action(() => {})

      await cmd.run({ argv: ['--help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Test command')
      expect(output).toContain('Usage: test')
      consoleSpy.mockRestore()
    })

    it('should not show help when --help is after -- terminator', async () => {
      const actionSpy = vi.fn()
      const cmd = new Command({ name: 'test', description: 'Test command' }).argument({
        name: 'args',
        kind: 'variadic',
        description: 'Args',
      })
      cmd.action(actionSpy)

      await cmd.run({ argv: ['--', '--help'], envs: {} })

      expect(actionSpy).toHaveBeenCalled()
    })

    it('should show help even with unknown option before --help', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', description: 'Test command' })
      cmd.action(() => {})

      await cmd.run({ argv: ['--unknown', '--help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Test command')
      consoleSpy.mockRestore()
    })

    it('should show help even with unknown short option before --help', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', description: 'Test command' })
      cmd.action(() => {})

      await cmd.run({ argv: ['-x', '--help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Test command')
      consoleSpy.mockRestore()
    })

    it('should show help with string option followed by -- and then --help', async () => {
      const actionSpy = vi.fn()
      const cmd = new Command({ name: 'test', description: 'Test command' })
      cmd.option({ type: 'string', long: 'config', short: 'c', description: 'Config file' })
      cmd.argument({ name: 'args', kind: 'variadic', description: 'Args' })
      cmd.action(actionSpy)

      // -c consumes next value, then -- terminates options, so --help is treated as arg
      await cmd.run({ argv: ['-c', 'file.json', '--', '--help'], envs: {} })

      // Action should be called since --help is after --
      expect(actionSpy).toHaveBeenCalled()
    })

    it('should show help with option without explicit type (defaults to string) before --help', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', description: 'Test command' })
      // Option without explicit type defaults to string
      cmd.option({ long: 'config', short: 'c', description: 'Config file' })
      cmd.action(() => {})

      // --config consumes next value "foo", then --help should be detected
      await cmd.run({ argv: ['--config', 'foo', '--help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Test command')
      consoleSpy.mockRestore()
    })

    it('should show help with short option without explicit type before --help', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const cmd = new Command({ name: 'test', description: 'Test command' })
      // Option without explicit type defaults to string
      cmd.option({ long: 'config', short: 'c', description: 'Config file' })
      cmd.action(() => {})

      // -c consumes next value "foo", then --help should be detected
      await cmd.run({ argv: ['-c', 'foo', '--help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Test command')
      consoleSpy.mockRestore()
    })

    it('should handle action errors with exit code 1', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const cmd = new Command({ name: 'test', description: 'Test' })
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

      const cmd = new Command({ name: 'test', description: 'Test' })
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
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
      const customReporter = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      let capturedCtx: IActionParams['ctx'] | undefined
      const cmd = new Command({ name: 'test', description: 'Test', reporter: baseReporter })
      cmd.action(({ ctx }) => {
        capturedCtx = ctx
      })

      await cmd.run({ argv: [], envs: { FOO: 'bar' }, reporter: customReporter })

      expect(capturedCtx?.reporter).toBe(customReporter)
      expect(capturedCtx?.envs).toEqual({ FOO: 'bar' })
    })

    it('should use reporter from constructor when not overridden', async () => {
      const baseReporter = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      let capturedCtx: IActionParams['ctx'] | undefined
      const cmd = new Command({ name: 'test', description: 'Test', reporter: baseReporter })
      cmd.action(({ ctx }) => {
        capturedCtx = ctx
      })

      await cmd.run({ argv: [], envs: {} })

      expect(capturedCtx?.reporter).toBe(baseReporter)
    })

    it('should show help when command has subcommands but no action', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', description: 'CLI tool' })
      const sub = new Command({ description: 'Initialize' })
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

      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'string', long: 'config', description: 'Config', required: true })
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
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        type: 'string',
        long: 'env',
        description: 'Environment',
        apply: applySpy,
      })
      cmd.action(() => {})

      await cmd.run({ argv: ['--env', 'production'], envs: {} })

      expect(applySpy).toHaveBeenCalledWith('production', expect.objectContaining({ cmd }))
    })

    it('should not call apply when option value is undefined', async () => {
      const applySpy = vi.fn()
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        type: 'string',
        long: 'env',
        description: 'Environment',
        apply: applySpy,
      })
      cmd.action(() => {})

      await cmd.run({ argv: [], envs: {} })

      expect(applySpy).not.toHaveBeenCalled()
    })

    it('should throw ConfigurationError when no action and no subcommands', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const cmd = new Command({ name: 'test', description: 'Test' })
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
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        type: 'string',
        long: 'config',
        description: 'Config',
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
      // Use long option syntax instead: --number -1
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'number', short: 'n', long: 'number', description: 'Number' })

      expect(() => cmd.parse(['-n', '-1'])).toThrow('requires a value')
    })

    it('should accept negative number with long option syntax', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'number', short: 'n', long: 'number', description: 'Number' })

      const result = cmd.parse(['--number', '-1'])
      expect(result.opts['number']).toBe(-1)
    })

    it('should parse short option with value in combined form followed by next arg', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'boolean', short: 'v', long: 'verbose', description: 'Verbose' })
      cmd.option({ type: 'string', short: 'o', long: 'output', description: 'Output' })

      const result = cmd.parse(['-vo', 'file.txt'])
      expect(result.opts['verbose']).toBe(true)
      expect(result.opts['output']).toBe('file.txt')
    })
  })

  describe('argument validation', () => {
    it('should throw for required argument after optional', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'optional', description: 'Optional', kind: 'optional' })

      expect(() =>
        cmd.argument({ name: 'required', description: 'Required', kind: 'required' }),
      ).toThrow('cannot come after optional/variadic')
    })

    it('should throw for multiple variadic arguments', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'files', description: 'Files', kind: 'variadic' })

      expect(() => cmd.argument({ name: 'more', description: 'More', kind: 'variadic' })).toThrow(
        'only one variadic argument',
      )
    })

    it('should throw for argument after variadic', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'files', description: 'Files', kind: 'variadic' })

      expect(() => cmd.argument({ name: 'extra', description: 'Extra', kind: 'optional' })).toThrow(
        'variadic argument must be the last',
      )
    })

    it('should throw for required argument with default', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })

      expect(() =>
        cmd.argument({
          name: 'input',
          description: 'Input',
          kind: 'required',
          default: 'default.txt',
        }),
      ).toThrow('required argument "input" cannot have a default value')
    })
  })

  describe('argument type conversion', () => {
    it('should convert argument to number when type is number', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'port', description: 'Port', kind: 'required', type: 'number' })

      const result = cmd.parse(['8080'])
      expect(result.args).toEqual({ port: 8080 })
      expect(result.rawArgs).toEqual(['8080'])
    })

    it('should throw for invalid number argument', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'port', description: 'Port', kind: 'required', type: 'number' })

      expect(() => cmd.parse(['abc'])).toThrow('invalid number "abc" for argument "port"')
    })

    it('should use coerce callback for argument conversion', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({
        name: 'port',
        description: 'Port',
        kind: 'required',
        coerce: v => {
          const n = parseInt(v, 10)
          if (n < 0 || n > 65535) throw new Error('Invalid port')
          return n
        },
      })

      expect(cmd.parse(['8080']).args).toEqual({ port: 8080 })
      expect(() => cmd.parse(['99999'])).toThrow('invalid value "99999" for argument "port"')
    })

    it('should prefer coerce over type conversion', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({
        name: 'value',
        description: 'Value',
        kind: 'required',
        type: 'number',
        coerce: v => `prefix_${v}`,
      })

      const result = cmd.parse(['123'])
      expect(result.args).toEqual({ value: 'prefix_123' })
    })

    it('should use default value for optional argument when not provided', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({
        name: 'env',
        description: 'Environment',
        kind: 'optional',
        default: 'development',
      })

      const result = cmd.parse([])
      expect(result.args).toEqual({ env: 'development' })
    })

    it('should override default when optional argument is provided', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({
        name: 'env',
        description: 'Environment',
        kind: 'optional',
        default: 'development',
      })

      const result = cmd.parse(['production'])
      expect(result.args).toEqual({ env: 'production' })
    })

    it('should return undefined for optional argument without default', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'output', description: 'Output', kind: 'optional' })

      const result = cmd.parse([])
      expect(result.args).toEqual({ output: undefined })
    })

    it('should convert variadic arguments to number[]', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'ports', description: 'Ports', kind: 'variadic', type: 'number' })

      const result = cmd.parse(['80', '443', '8080'])
      expect(result.args).toEqual({ ports: [80, 443, 8080] })
    })

    it('should throw for invalid number in variadic arguments', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'ports', description: 'Ports', kind: 'variadic', type: 'number' })

      expect(() => cmd.parse(['80', 'abc', '8080'])).toThrow(
        'invalid number "abc" for argument "ports"',
      )
    })

    it('should return empty array for variadic argument with no values', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'files', description: 'Files', kind: 'variadic' })

      const result = cmd.parse([])
      expect(result.args).toEqual({ files: [] })
    })
  })

  describe('TooManyArguments error', () => {
    it('should throw for too many arguments when no variadic', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'input', description: 'Input', kind: 'required' })

      expect(() => cmd.parse(['a.txt', 'b.txt', 'c.txt'])).toThrow(
        'too many arguments: expected 1, got 3',
      )
    })

    it('should throw for extra arguments with multiple defined', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'source', description: 'Source', kind: 'required' })
      cmd.argument({ name: 'dest', description: 'Dest', kind: 'optional' })

      expect(() => cmd.parse(['a.txt', 'b.txt', 'c.txt'])).toThrow(
        'too many arguments: expected 2, got 3',
      )
    })

    it('should not throw when variadic consumes extra arguments', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'source', description: 'Source', kind: 'required' })
      cmd.argument({ name: 'extras', description: 'Extras', kind: 'variadic' })

      const result = cmd.parse(['a.txt', 'b.txt', 'c.txt'])
      expect(result.args).toEqual({ source: 'a.txt', extras: ['b.txt', 'c.txt'] })
    })

    it('should not throw when no arguments defined and no arguments provided', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })

      const result = cmd.parse([])
      expect(result.args).toEqual({})
    })

    it('should throw when no arguments defined but arguments provided', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })

      expect(() => cmd.parse(['unexpected'])).toThrow('too many arguments: expected 0, got 1')
    })
  })

  describe('default type handling', () => {
    it('should treat undefined type as string', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'config', description: 'Config file' }) // no type specified

      const result = cmd.parse(['--config', 'app.json'])
      expect(result.opts['config']).toBe('app.json')
    })

    it('should show <value> in help for options without explicit type', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'config', description: 'Config file' })

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
    it('should show subcommand help with "help <subcommand>"', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', description: 'CLI tool', help: true })

      const sub = new Command({ description: 'Initialize project' })
      sub.option({ type: 'string', long: 'template', description: 'Template name' })
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

      const root = new Command({ name: 'cli', description: 'CLI tool', help: true })
      const sub = new Command({ description: 'Initialize' })
      sub.action(() => {})
      root.subcommand('init', sub)

      await root.run({ argv: ['help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('CLI tool')

      consoleSpy.mockRestore()
    })

    it('should show help subcommand in help output when has subcommands', () => {
      const root = new Command({ name: 'cli', description: 'CLI tool', help: true })
      const sub = new Command({ description: 'Initialize' })
      root.subcommand('init', sub)

      const help = root.formatHelp()

      expect(help).toContain('Commands:')
      expect(help).toContain('help')
      expect(help).toContain('Show help for a command')
    })

    it('should not show help subcommand when no subcommands', () => {
      const root = new Command({ name: 'cli', description: 'CLI tool', help: true })

      const help = root.formatHelp()

      expect(help).not.toContain('Commands:')
      expect(help).not.toContain('Show help for a command')
    })

    it('should not process help subcommand when not enabled', async () => {
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      // NOT setting help: true

      // When help is not enabled and there are subcommands, "help" is not a subcommand
      // Routing stops at root because "help" is not a registered subcommand name
      // Since root has subcommands but no action, it will show help
      const sub = new Command({ description: 'Initialize' })
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

      const root = new Command({ name: 'cli', description: 'CLI tool', help: true })

      const sub = new Command({ description: 'Initialize' })
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

      const root = new Command({ name: 'cli', description: 'CLI tool', help: true })

      const sub = new Command({ description: 'Initialize project' })
      sub.action(() => {})
      root.subcommand('initialize', sub).subcommand('init', sub).subcommand('i', sub)

      await root.run({ argv: ['help', 'init'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Initialize project')

      consoleSpy.mockRestore()
    })

    it('should throw when subcommand name conflicts with reserved "help"', () => {
      const root = new Command({ name: 'cli', description: 'CLI tool', help: true })

      const helpCmd = new Command({ description: 'Custom help' })

      expect(() => root.subcommand('help', helpCmd)).toThrow('reserved subcommand name')
    })

    it('should throw when subcommand alias conflicts with reserved "help"', () => {
      const root = new Command({ name: 'cli', description: 'CLI tool', help: true })

      const cmd = new Command({ description: 'Info' })
      root.subcommand('info', cmd)

      expect(() => root.subcommand('help', cmd)).toThrow('reserved subcommand name')
    })

    it('should allow "help" subcommand when help is not enabled', () => {
      const root = new Command({ name: 'cli', description: 'CLI tool' })

      const helpCmd = new Command({ description: 'Custom help' })
      helpCmd.action(() => {})

      // Should not throw
      expect(() => root.subcommand('help', helpCmd)).not.toThrow()
    })

    it('should show help when help:true and no subcommands', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', description: 'CLI tool', help: true })
      root.action(() => {})

      await root.run({ argv: ['help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('CLI tool')

      consoleSpy.mockRestore()
    })

    it('should treat help as positional arg when help:false and no subcommands', async () => {
      let receivedArgs: Record<string, unknown> = {}
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      root.argument({ name: 'cmd', kind: 'optional', description: 'Command' })
      root.action(({ args }) => {
        receivedArgs = args
      })

      await root.run({ argv: ['help'], envs: {} })

      expect(receivedArgs).toEqual({ cmd: 'help' })
    })
  })

  describe('option bubbling', () => {
    it('should bubble unknown options to parent', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'verbose',
        short: 'v',
        type: 'boolean',
        description: 'Verbose',
      })

      const child = new Command({ description: 'Child' })
        .option({ long: 'output', short: 'o', type: 'string', description: 'Output' })
        .action(({ opts }) => {
          expect(opts['verbose']).toBe(true)
          expect(opts['output']).toBe('file.txt')
        })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--output', 'file.txt', '--verbose'], envs: {} })
    })

    it('should let child consume first when same option name exists', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        description: 'Root verbose',
      })

      const child = new Command({ description: 'Child' })
        .option({ long: 'verbose', type: 'boolean', description: 'Child verbose' })
        .action(({ opts }) => {
          // Child consumes --verbose, merge order is root → leaf, so child overwrites
          expect(opts['verbose']).toBe(true)
        })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--verbose'], envs: {} })
    })

    it('should not shift options after --', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        description: 'Verbose',
      })

      const child = new Command({ description: 'Child' })
        .argument({ name: 'files', kind: 'variadic', description: 'Files' })
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

      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'config',
        type: 'string',
        description: 'Config',
        apply: () => order.push('root-config'),
      })

      const child = new Command({ description: 'Child' })
        .option({
          long: 'env',
          type: 'string',
          description: 'Env',
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

      const root = new Command({ name: 'cli', description: 'CLI' })
      const child = new Command({ description: 'Child' }).action(() => {})

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
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'level',
        type: 'number',
        default: 1,
        description: 'Level',
      })

      const child = new Command({ description: 'Child' })
        .option({ long: 'level', type: 'number', default: 2, description: 'Child level' })
        .action(({ opts }) => {
          // No --level provided, but defaults merge with child overwriting root
          expect(opts['level']).toBe(2)
        })

      root.subcommand('child', child)

      await root.run({ argv: ['child'], envs: {} })
    })

    it('should work with multiple levels of nesting', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'global',
        type: 'boolean',
        description: 'Global',
      })

      const parent = new Command({ description: 'Parent' }).option({
        long: 'parentOpt',
        type: 'string',
        description: 'Parent opt',
      })

      const child = new Command({ description: 'Child' })
        .option({ long: 'childOpt', type: 'string', description: 'Child opt' })
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
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'verbose',
        short: 'v',
        type: 'boolean',
        description: 'Verbose',
      })

      const child = new Command({ description: 'Child' })
        .option({ long: 'output', short: 'o', type: 'string', description: 'Output' })
        .action(({ opts }) => {
          expect(opts['verbose']).toBe(true)
          expect(opts['output']).toBe('file.txt')
        })

      root.subcommand('child', child)

      // Use -v (short) which should bubble to root
      await root.run({ argv: ['child', '-o', 'file.txt', '-v'], envs: {} })
    })

    it('should handle combined short options with bubbling', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'verbose',
        short: 'v',
        type: 'boolean',
        description: 'Verbose',
      })

      const child = new Command({ description: 'Child' })
        .option({ long: 'debug', short: 'd', type: 'boolean', description: 'Debug' })
        .action(({ opts }) => {
          expect(opts['verbose']).toBe(true)
          expect(opts['debug']).toBe(true)
        })

      root.subcommand('child', child)

      // Combined -dv, child consumes -d, -v bubbles to root
      await root.run({ argv: ['child', '-dv'], envs: {} })
    })

    it('should handle --option=value syntax with bubbling', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'config',
        type: 'string',
        description: 'Config',
      })

      const child = new Command({ description: 'Child' }).action(({ opts }) => {
        expect(opts['config']).toBe('app.json')
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--config=app.json'], envs: {} })
    })

    it('should handle --boolean=true/false syntax with bubbling', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        description: 'Verbose',
      })

      const child = new Command({ description: 'Child' }).action(({ opts }) => {
        expect(opts['verbose']).toBe(true)
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--verbose=true'], envs: {} })
    })

    it('should handle --no-option syntax with bubbling', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        default: true,
        description: 'Verbose',
      })

      const child = new Command({ description: 'Child' }).action(({ opts }) => {
        expect(opts['verbose']).toBe(false)
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--no-verbose'], envs: {} })
    })

    it('should pass unknown -x=value syntax to parent', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'write',
        short: 'w',
        type: 'string',
        description: 'Write',
        resolver: tokens => {
          const remaining: typeof tokens = []
          let value: string | undefined
          for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i]
            if (token.resolved === '-w' || token.resolved === '--write') {
              const next = tokens[i + 1]
              if (next && !next.resolved.startsWith('-')) {
                value = next.original
                i++
              } else {
                value = ''
              }
            } else if (token.resolved.startsWith('-w=')) {
              value = token.original.slice(3)
            } else if (token.resolved.startsWith('--write=')) {
              value = token.resolved.slice(8)
            } else {
              remaining.push(token)
            }
          }
          return { value, remaining }
        },
      })

      const child = new Command({ description: 'Child' }).action(({ opts }) => {
        expect(opts['write']).toBe('file.txt')
      })

      root.subcommand('child', child)

      // -w=file.txt uses resolver, bubbles to root
      await root.run({ argv: ['child', '-w=file.txt'], envs: {} })
    })

    it('should throw error for -o=value on known short option', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'output',
        short: 'o',
        type: 'string',
        description: 'Output',
      })

      const child = new Command({ description: 'Child' }).action(() => {})

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

      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'output',
        short: 'o',
        type: 'string',
        description: 'Output',
      })

      const child = new Command({ description: 'Child' }).action(() => {})

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

      const root = new Command({ name: 'cli', description: 'CLI' })
        .option({ long: 'output', short: 'o', type: 'string', description: 'Output' })
        .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose' })

      const child = new Command({ description: 'Child' }).action(() => {})

      root.subcommand('child', child)

      // -ov where -o takes value but is not last
      await root.run({ argv: ['child', '-ov'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('not supported')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should throw for invalid boolean value in bubbled option', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        description: 'Verbose',
      })

      const child = new Command({ description: 'Child' }).action(() => {})

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

      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'output',
        type: 'string',
        description: 'Output',
      })

      const child = new Command({ description: 'Child' }).action(() => {})

      root.subcommand('child', child)

      // --output without value at end of argv
      await root.run({ argv: ['child', '--output'], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls[0][0]
      expect(errorOutput).toContain('requires a value')

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should handle --help after -- in subcommand', async () => {
      const actionSpy = vi.fn()
      const root = new Command({ name: 'cli', description: 'CLI' })

      const child = new Command({ description: 'Child' })
        .argument({ name: 'args', kind: 'variadic', description: 'Args' })
        .action(actionSpy)

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--', '--help'], envs: {} })

      expect(actionSpy).toHaveBeenCalled()
      expect(actionSpy.mock.calls[0][0].args).toEqual({ args: ['--help'] })
      expect(actionSpy.mock.calls[0][0].rawArgs).toEqual(['--help'])
    })

    it('should handle --verbose=false in bubbled option', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'verbose',
        type: 'boolean',
        default: true,
        description: 'Verbose',
      })

      const child = new Command({ description: 'Child' }).action(({ opts }) => {
        expect(opts['verbose']).toBe(false)
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--verbose=false'], envs: {} })
    })

    it('should handle bubbling with number options', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'port',
        type: 'number',
        description: 'Port',
      })

      const child = new Command({ description: 'Child' }).action(({ opts }) => {
        expect(opts['port']).toBe(8080)
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--port', '8080'], envs: {} })
    })

    it('should handle bubbling with array options', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'include',
        type: 'string[]',
        description: 'Include',
      })

      const child = new Command({ description: 'Child' }).action(({ opts }) => {
        expect(opts['include']).toEqual(['a', 'b'])
      })

      root.subcommand('child', child)

      await root.run({ argv: ['child', '--include', 'a', '--include', 'b'], envs: {} })
    })

    it('should throw for missing required argument in subcommand', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'cli', description: 'CLI' })

      const child = new Command({ description: 'Child' })
        .argument({ name: 'file', kind: 'required', description: 'File' })
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

      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'env',
        type: 'string',
        description: 'Env',
        choices: ['dev', 'prod'],
      })

      const child = new Command({ description: 'Child' }).action(() => {})

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

      const root = new Command({ name: 'cli', description: 'CLI' }).option({
        long: 'config',
        type: 'string',
        description: 'Config',
      })

      const child = new Command({ description: 'Child' }).action(() => {})

      root.subcommand('child', child)

      // --config foo --help - help should be detected even after --config
      await root.run({ argv: ['child', '--config', 'foo', '--help'], envs: {} })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('Child')

      consoleSpy.mockRestore()
    })

    it('should not detect --help when scanning options that include -- before --help', async () => {
      const actionSpy = vi.fn()

      const root = new Command({ name: 'cli', description: 'CLI' })

      const child = new Command({ description: 'Child' })
        .argument({ name: 'args', kind: 'variadic', description: 'Args' })
        .action(actionSpy)

      root.subcommand('child', child)

      // -- --help: the --help is after --, so it should not trigger help display
      // This tests that #hasBuiltinFlag properly stops at --
      await root.run({ argv: ['child', '--', '--help'], envs: {} })

      expect(actionSpy).toHaveBeenCalled()
      expect(actionSpy.mock.calls[0][0].args).toEqual({ args: ['--help'] })
      expect(actionSpy.mock.calls[0][0].rawArgs).toEqual(['--help'])
    })

    it('should support shift() method directly', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
        .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose' })
        .option({ long: 'output', short: 'o', type: 'string', description: 'Output' })

      // shift() now requires ICommandToken[]
      const tokens = [
        { original: '--verbose', resolved: '--verbose' },
        { original: '--output', resolved: '--output' },
        { original: 'file.txt', resolved: 'file.txt' },
        { original: '--unknown', resolved: '--unknown' },
      ]
      const result = cmd.shift(tokens)

      expect(result.opts).toEqual({
        verbose: true,
        output: 'file.txt',
        help: false,
        version: false,
      })
      expect(result.remaining).toEqual([{ original: '--unknown', resolved: '--unknown' }])
    })
  })

  describe('kebab-case/camelCase naming convention', () => {
    it('should accept kebab-case input and map to camelCase option', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', description: 'Log level' })

      const result = cmd.parse(['--log-level', 'debug'])
      expect(result.opts['logLevel']).toBe('debug')
    })

    it('should be case-insensitive for kebab-case input', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', description: 'Log level' })

      expect(cmd.parse(['--LOG-LEVEL', 'debug']).opts['logLevel']).toBe('debug')
      expect(cmd.parse(['--Log-Level', 'info']).opts['logLevel']).toBe('info')
    })

    it('should preserve value case', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'name', type: 'string', description: 'Name' })

      const result = cmd.parse(['--name', 'MyApp'])
      expect(result.opts['name']).toBe('MyApp')
    })

    it('should preserve value case with inline syntax', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'name', type: 'string', description: 'Name' })

      const result = cmd.parse(['--name=MyApp'])
      expect(result.opts['name']).toBe('MyApp')
    })

    it('should throw for underscore in option name', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', description: 'Log level' })

      expect(() => cmd.parse(['--log_level', 'debug'])).toThrow("use '-' instead of '_'")
    })

    it('should throw for invalid option format (consecutive dashes)', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', description: 'Log level' })

      expect(() => cmd.parse(['--log--level', 'debug'])).toThrow('invalid option format')
    })

    it('should throw for option starting with number', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'verbose', type: 'boolean', description: 'Verbose' })

      expect(() => cmd.parse(['--2fa'])).toThrow('invalid option format')
    })

    it('should throw for incomplete negative option --no', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'verbose', type: 'boolean', description: 'Verbose' })

      expect(() => cmd.parse(['--no'])).toThrow('invalid negative option syntax')
    })

    it('should throw for incomplete negative option --no-', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'verbose', type: 'boolean', description: 'Verbose' })

      expect(() => cmd.parse(['--no-'])).toThrow('invalid negative option syntax')
    })

    it('should throw for --no-xxx used on non-boolean option', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'output', type: 'string', description: 'Output' })

      expect(() => cmd.parse(['--no-output'])).toThrow('can only be used with boolean options')
    })

    it('should convert --no-xxx to false for boolean options', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'verbose', type: 'boolean', description: 'Verbose' })

      const result = cmd.parse(['--no-verbose'])
      expect(result.opts['verbose']).toBe(false)
    })

    it('should handle kebab-case in --no-xxx', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'colorOutput', type: 'boolean', description: 'Color output' })

      const result = cmd.parse(['--no-color-output'])
      expect(result.opts['colorOutput']).toBe(false)
    })

    it('should display options in kebab-case in help', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ long: 'logLevel', type: 'string', description: 'Log level' })
      cmd.option({ long: 'colorOutput', type: 'boolean', description: 'Color output' })

      const help = cmd.formatHelp()
      expect(help).toContain('--log-level')
      expect(help).toContain('--color-output')
      expect(help).toContain('--no-color-output')
    })

    it('should not process options after --', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'args', kind: 'variadic', description: 'Args' })

      const result = cmd.parse(['--', '--log_level', '--2fa', '--no-'])
      expect(result.rawArgs).toEqual(['--log_level', '--2fa', '--no-'])
    })
  })
})
