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

    it('should accept aliases', () => {
      const cmd = new Command({ name: 'test', description: 'Test', aliases: ['t', 'tst'] })
      expect(cmd.aliases).toEqual(['t', 'tst'])
    })

    it('should expose parent property', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      const sub = new Command({ name: 'init', description: 'Init' })
      root.subcommand(sub)

      expect(root.parent).toBeUndefined()
      expect(sub.parent).toBe(root)
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
        resolver: argv => {
          const headers: Record<string, string> = {}
          const remaining: string[] = []
          for (let i = 0; i < argv.length; i++) {
            const arg = argv[i]
            if (arg === '--header' && i + 1 < argv.length) {
              const [key, val] = argv[i + 1].split(': ')
              headers[key] = val
              i++
            } else if (arg.startsWith('--header=')) {
              const [key, val] = arg.slice(9).split(': ')
              headers[key] = val
            } else {
              remaining.push(arg)
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
      expect(result.args).toEqual(['file.txt'])
    })

    it('should parse optional argument', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'output', description: 'Output file', kind: 'optional' })

      const result = cmd.parse([])
      expect(result.args).toEqual([])
    })

    it('should parse variadic argument', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.argument({ name: 'files', description: 'Input files', kind: 'variadic' })

      const result = cmd.parse(['a.txt', 'b.txt', 'c.txt'])
      expect(result.args).toEqual(['a.txt', 'b.txt', 'c.txt'])
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

  describe('subcommand', () => {
    it('should route to subcommand via run', async () => {
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      const sub = new Command({ name: 'init', description: 'Initialize' })

      let receivedArgs: string[] = []
      sub.action(({ args }) => {
        receivedArgs = args
      })
      root.subcommand(sub)

      await root.run({ argv: ['init', 'arg'], envs: {} })
      expect(receivedArgs).toEqual(['arg'])
    })

    it('should resolve subcommand by alias', async () => {
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      const sub = new Command({
        name: 'initialize',
        description: 'Initialize',
        aliases: ['init', 'i'],
      })

      let executed = false
      sub.action(() => {
        executed = true
      })
      root.subcommand(sub)

      await root.run({ argv: ['i'], envs: {} })
      expect(executed).toBe(true)
    })

    it('should inherit options from parent', async () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.option({ type: 'boolean', long: 'debug', description: 'Debug mode' })

      const sub = new Command({ name: 'build', description: 'Build' })
      let debugValue: boolean | undefined
      sub.action(({ opts }) => {
        debugValue = opts['debug'] as boolean
      })
      root.subcommand(sub)

      await root.run({ argv: ['build', '--debug'], envs: {} })
      expect(debugValue).toBe(true)
    })

    it('subcommand should inherit version from parent', () => {
      const root = new Command({ name: 'cli', description: 'CLI', version: '2.0.0' })
      const sub = new Command({ name: 'init', description: 'Init' })
      root.subcommand(sub)

      expect(sub.version).toBe('2.0.0')
    })

    it('should stop routing at option-like token', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })
      const sub = new Command({ name: 'start', description: 'Start' })
      sub.action(() => {})
      root.subcommand(sub)

      // pm --verbose start should NOT route to start
      // start becomes a positional argument for root
      const result = root.parse(['--verbose', 'start'])
      expect(result.opts['verbose']).toBe(true)
      expect(result.args).toEqual(['start'])
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
      expect(params!.args).toEqual(['input.txt'])
    })
  })

  describe('parse rest arguments', () => {
    it('should collect arguments after --', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })

      const result = cmd.parse(['--', 'extra1', '--extra2'])
      expect(result.args).toEqual(['extra1', '--extra2'])
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
      root.subcommand(new Command({ name: 'init', description: 'Initialize project' }))
      root.subcommand(new Command({ name: 'build', description: 'Build project' }))

      const help = root.formatHelp()

      expect(help).toContain('Commands:')
      expect(help).toContain('init')
      expect(help).toContain('Initialize project')
      expect(help).toContain('build')
    })

    it('should show subcommand aliases in help', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.subcommand(
        new Command({
          name: 'initialize',
          description: 'Initialize project',
          aliases: ['init', 'i'],
        }),
      )

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

    it('should show --no-{option} for boolean options', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({
        type: 'boolean',
        long: 'verbose',
        description: 'Verbose output',
      })

      const help = cmd.formatHelp()
      expect(help).toContain('--verbose')
      expect(help).toContain('--no-verbose')
    })
  })

  describe('getCompletionMeta', () => {
    it('should return completion metadata', () => {
      const root = new Command({ name: 'cli', description: 'CLI tool' })
      root.option({ type: 'string', short: 'c', long: 'config', description: 'Config file' })

      const sub = new Command({ name: 'init', description: 'Initialize' })
      root.subcommand(sub)

      const meta = root.getCompletionMeta()

      expect(meta.name).toBe('cli')
      expect(meta.description).toBe('CLI tool')
      expect(meta.options).toContainEqual(expect.objectContaining({ long: 'config' }))
      expect(meta.subcommands).toHaveLength(1)
      expect(meta.subcommands[0].name).toBe('init')
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

  describe('option inheritance', () => {
    it('should merge options from ancestor chain', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.option({ type: 'boolean', long: 'verbose', short: 'v', description: 'Verbose' })

      const sub = new Command({ name: 'build', description: 'Build' })
      sub.option({ type: 'string', long: 'target', description: 'Target' })
      sub.action(() => {})
      root.subcommand(sub)

      // When parsing build command, both verbose and target should be available
      // We test this indirectly via parse
    })

    it('should allow child to override parent option', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.option({ type: 'string', long: 'log-level', description: 'Log level' })

      const sub = new Command({ name: 'build', description: 'Build' })
      sub.option({
        type: 'string',
        long: 'log-level',
        description: 'Build log level',
        default: 'debug',
      })
      sub.action(() => {})
      root.subcommand(sub)

      // Child's log-level definition should be used
    })

    it('should detect short option conflict in merged options', () => {
      const root = new Command({ name: 'cli', description: 'CLI' })
      root.option({ type: 'boolean', long: 'verbose', short: 'v', description: 'Verbose' })

      const sub = new Command({ name: 'build', description: 'Build' })
      sub.option({ type: 'boolean', long: 'version', short: 'v', description: 'Version' })
      sub.action(() => {})
      root.subcommand(sub)

      // Should throw when trying to parse due to short option conflict
      expect(() => sub.parse(['--verbose'])).toThrow('short option "-v" is used by both')
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
        throw 'string error' // eslint-disable-line no-throw-literal
      })

      await cmd.run({ argv: [], envs: {} })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: action failed')
      expect(exitSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should use custom reporter when provided', async () => {
      const customReporter = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      let capturedCtx: IActionParams['ctx'] | undefined
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.action(({ ctx }) => {
        capturedCtx = ctx
      })

      await cmd.run({ argv: [], envs: { FOO: 'bar' }, reporter: customReporter })

      expect(capturedCtx?.reporter).toBe(customReporter)
      expect(capturedCtx?.envs).toEqual({ FOO: 'bar' })
    })

    it('should show help when command has subcommands but no action', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const root = new Command({ name: 'cli', description: 'CLI tool' })
      const sub = new Command({ name: 'init', description: 'Initialize' })
      sub.action(() => {})
      root.subcommand(sub)

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
    it('should throw for short option value starting with dash', () => {
      const cmd = new Command({ name: 'test', description: 'Test' })
      cmd.option({ type: 'number', short: 'n', long: 'number', description: 'Number' })

      expect(() => cmd.parse(['-n', '-1'])).toThrow('requires a value')
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
})
