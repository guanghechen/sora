import { vi } from 'vitest'
import { BashCompletion, Command, CompletionCommand, FishCompletion, PwshCompletion } from '../src'
import type { ICompletionMeta } from '../src'

describe('BashCompletion', () => {
  it('should generate valid bash script', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [{ short: 'h', long: 'help', description: 'Show help', takesValue: false }],
      subcommands: [
        {
          name: 'sub',
          description: 'Subcommand',
          aliases: [],
          options: [],
          subcommands: [],
        },
      ],
    }

    const completion = new BashCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('_testcli_completions()')
    expect(script).toContain('_init_completion')
    expect(script).toContain('COMPREPLY=')
    expect(script).toContain('-h')
    expect(script).toContain('--help')
    expect(script).toContain('sub')
  })

  it('should handle program name with dashes', () => {
    const meta: ICompletionMeta = {
      name: 'my-cli-tool',
      description: 'My CLI Tool',
      aliases: [],
      options: [],
      subcommands: [],
    }

    const completion = new BashCompletion(meta, 'my-cli-tool')
    const script = completion.generate()

    expect(script).toContain('_my_cli_tool_completions()')
    expect(script).toContain('complete -F _my_cli_tool_completions my-cli-tool')
  })

  it('should include --no-{option} for boolean options', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [{ long: 'verbose', description: 'Verbose mode', takesValue: false }],
      subcommands: [],
    }

    const completion = new BashCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('--verbose')
    expect(script).toContain('--no-verbose')
  })
})

describe('FishCompletion', () => {
  it('should generate valid fish script', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [
        { short: 'v', long: 'verbose', description: 'Verbose mode', takesValue: false },
        {
          long: 'format',
          description: 'Output format',
          takesValue: true,
          choices: ['json', 'yaml'],
        },
      ],
      subcommands: [],
    }

    const completion = new FishCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('complete -c testcli')
    expect(script).toContain('-s v')
    expect(script).toContain('-l verbose')
    expect(script).toContain('-l format')
    expect(script).toContain("-xa 'json yaml'")
  })

  it('should escape single quotes in descriptions', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: "It's a test",
      aliases: [],
      options: [{ long: 'opt', description: "Option's description", takesValue: false }],
      subcommands: [],
    }

    const completion = new FishCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("Option\\'s description")
  })

  it('should include --no-{option} for boolean options', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [{ long: 'verbose', description: 'Verbose mode', takesValue: false }],
      subcommands: [],
    }

    const completion = new FishCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('-l verbose')
    expect(script).toContain('-l no-verbose')
  })
})

describe('PwshCompletion', () => {
  it('should generate valid powershell script', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [{ short: 'h', long: 'help', description: 'Show help', takesValue: false }],
      subcommands: [
        {
          name: 'init',
          description: 'Initialize',
          aliases: [],
          options: [],
          subcommands: [],
        },
      ],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('Register-ArgumentCompleter -Native -CommandName testcli')
    expect(script).toContain('$wordToComplete')
    expect(script).toContain('CompletionResult')
    expect(script).toContain("long = 'help'")
    expect(script).toContain("'init' = @{")
  })

  it('should escape single quotes in powershell', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: "It's a test",
      aliases: [],
      options: [],
      subcommands: [],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("It''s a test")
  })

  it('should include isBoolean flag for boolean options', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [{ long: 'verbose', description: 'Verbose mode', takesValue: false }],
      subcommands: [],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('isBoolean = $true')
  })
})

describe('Integration with Command', () => {
  it('should generate completion from Command', () => {
    const root = new Command({ name: 'mycli', description: 'My CLI', version: '1.0.0' })
    root.option({ type: 'string', short: 'c', long: 'config', description: 'Config file' })

    const init = new Command({ name: 'init', description: 'Initialize project' })
    init.option({ type: 'string', long: 'template', description: 'Template' })
    root.subcommand(init)

    const meta = root.getCompletionMeta()

    const bashScript = new BashCompletion(meta, 'mycli').generate()
    expect(bashScript).toContain('--config')
    expect(bashScript).toContain('init')

    const fishScript = new FishCompletion(meta, 'mycli').generate()
    expect(fishScript).toContain('-l config')

    const pwshScript = new PwshCompletion(meta, 'mycli').generate()
    expect(pwshScript).toContain("long = 'config'")
  })
})

describe('CompletionCommand', () => {
  it('should create a completion subcommand with default name', () => {
    const root = new Command({ name: 'mycli', description: 'My CLI' })
    const completionCmd = new CompletionCommand(root)

    expect(completionCmd.name).toBe('completion')
    expect(completionCmd.description).toBe('Generate shell completion script')
  })

  it('should allow custom name via config', () => {
    const root = new Command({ name: 'mycli', description: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { name: 'completions' })

    expect(completionCmd.name).toBe('completions')
  })

  it('should have bash, fish, and pwsh options', () => {
    const root = new Command({ name: 'mycli', description: 'My CLI' })
    const completionCmd = new CompletionCommand(root)

    const cmdMeta = completionCmd.getCompletionMeta()

    expect(cmdMeta.options.some(o => o.long === 'bash')).toBe(true)
    expect(cmdMeta.options.some(o => o.long === 'fish')).toBe(true)
    expect(cmdMeta.options.some(o => o.long === 'pwsh')).toBe(true)
  })

  it('should be an instance of Command', () => {
    const root = new Command({ name: 'mycli', description: 'My CLI' })
    const completionCmd = new CompletionCommand(root)

    expect(completionCmd).toBeInstanceOf(Command)
  })

  it('should generate bash completion when --bash is passed', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const root = new Command({ name: 'mycli', description: 'My CLI' })
    root.option({ type: 'boolean', long: 'verbose', description: 'Verbose' })
    const completionCmd = new CompletionCommand(root)
    root.subcommand(completionCmd)

    await root.run({ argv: ['completion', '--bash'], envs: {} })

    expect(consoleSpy).toHaveBeenCalled()
    const output = consoleSpy.mock.calls[0][0]
    expect(output).toContain('_mycli_completions()')
    expect(output).toContain('complete -F _mycli_completions mycli')

    consoleSpy.mockRestore()
  })

  it('should generate fish completion when --fish is passed', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const root = new Command({ name: 'mycli', description: 'My CLI' })
    const completionCmd = new CompletionCommand(root)
    root.subcommand(completionCmd)

    await root.run({ argv: ['completion', '--fish'], envs: {} })

    expect(consoleSpy).toHaveBeenCalled()
    const output = consoleSpy.mock.calls[0][0]
    expect(output).toContain('complete -c mycli')

    consoleSpy.mockRestore()
  })

  it('should generate pwsh completion when --pwsh is passed', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const root = new Command({ name: 'mycli', description: 'My CLI' })
    const completionCmd = new CompletionCommand(root)
    root.subcommand(completionCmd)

    await root.run({ argv: ['completion', '--pwsh'], envs: {} })

    expect(consoleSpy).toHaveBeenCalled()
    const output = consoleSpy.mock.calls[0][0]
    expect(output).toContain('Register-ArgumentCompleter -Native -CommandName mycli')

    consoleSpy.mockRestore()
  })

  it('should error when no shell is specified', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    const root = new Command({ name: 'mycli', description: 'My CLI' })
    const completionCmd = new CompletionCommand(root)
    root.subcommand(completionCmd)

    await root.run({ argv: ['completion'], envs: {} })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Please specify a shell: --bash, --fish, or --pwsh',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)

    consoleErrorSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('should error when multiple shells are specified', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    const root = new Command({ name: 'mycli', description: 'My CLI' })
    const completionCmd = new CompletionCommand(root)
    root.subcommand(completionCmd)

    await root.run({ argv: ['completion', '--bash', '--fish'], envs: {} })

    expect(consoleErrorSpy).toHaveBeenCalledWith('Please specify only one shell option')
    expect(exitSpy).toHaveBeenCalledWith(1)

    consoleErrorSpy.mockRestore()
    exitSpy.mockRestore()
  })
})

describe('Completion with aliases and nested subcommands', () => {
  it('should include aliases in bash completion', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [],
      subcommands: [
        {
          name: 'build',
          description: 'Build project',
          aliases: ['b', 'compile'],
          options: [],
          subcommands: [],
        },
      ],
    }

    const completion = new BashCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('build|b|compile)')
  })

  it('should include aliases in fish completion', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [],
      subcommands: [
        {
          name: 'build',
          description: 'Build project',
          aliases: ['b'],
          options: [],
          subcommands: [],
        },
      ],
    }

    const completion = new FishCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('-a build')
    expect(script).toContain('-a b')
    expect(script).toContain('Alias for build')
  })

  it('should include aliases in pwsh completion', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [],
      subcommands: [
        {
          name: 'build',
          description: 'Build project',
          aliases: ['b'],
          options: [],
          subcommands: [],
        },
      ],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("'build' = @{")
    expect(script).toContain("'b' = @{")
  })

  it('should handle nested subcommands in fish completion', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [],
      subcommands: [
        {
          name: 'config',
          description: 'Config commands',
          aliases: [],
          options: [],
          subcommands: [
            {
              name: 'set',
              description: 'Set config value',
              aliases: [],
              options: [{ long: 'key', description: 'Key name', takesValue: true }],
              subcommands: [],
            },
          ],
        },
      ],
    }

    const completion = new FishCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('__fish_seen_subcommand_from config')
    expect(script).toContain('-a set')
    expect(script).toContain('-l key')
  })

  it('should handle nested subcommand aliases in fish completion', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [],
      subcommands: [
        {
          name: 'config',
          description: 'Config commands',
          aliases: [],
          options: [],
          subcommands: [
            {
              name: 'set',
              description: 'Set config value',
              aliases: ['s'],
              options: [],
              subcommands: [],
            },
          ],
        },
      ],
    }

    const completion = new FishCompletion(meta, 'testcli')
    const script = completion.generate()

    // The alias 's' in nested context should have condition with config
    expect(script).toContain('-a s')
    expect(script).toContain('Alias for set')
    // Verify condition is applied to nested alias
    expect(script).toMatch(/__fish_seen_subcommand_from config.*-a s/)
  })

  it('should include choices in pwsh completion', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [
        {
          long: 'format',
          description: 'Output format',
          takesValue: true,
          choices: ['json', 'yaml', 'xml'],
        },
      ],
      subcommands: [],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("choices = @('json', 'yaml', 'xml')")
  })

  it('should handle options with short in pwsh', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      description: 'Test CLI',
      aliases: [],
      options: [
        {
          short: 'v',
          long: 'verbose',
          description: 'Verbose mode',
          takesValue: false,
        },
      ],
      subcommands: [],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("short = 'v'")
    expect(script).toContain("long = 'verbose'")
  })
})
