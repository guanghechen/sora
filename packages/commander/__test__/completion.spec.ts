import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { vi } from 'vitest'
import {
  BashCompletion,
  Command,
  CompletionCommand,
  FishCompletion,
  PwshCompletion,
} from '../src/runtime/node'
import type { ICompletionMeta, ICompletionPaths } from '../src/runtime/node'

// Default paths for testing
const testPaths: ICompletionPaths = {
  bash: '~/.local/share/bash-completion/completions/mycli',
  fish: '~/.config/fish/completions/mycli.fish',
  pwsh: '~/.config/powershell/profile.ps1',
}

describe('BashCompletion', () => {
  it('should generate valid bash script', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [{ short: 'h', long: 'help', desc: 'Show help', type: 'boolean', args: 'none' }],
      arguments: [],
      subcommands: [
        {
          name: 'sub',
          desc: 'Subcommand',
          aliases: [],
          options: [],
          arguments: [],
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
      desc: 'My CLI Tool',
      aliases: [],
      options: [],
      arguments: [],
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
      desc: 'Test CLI',
      aliases: [],
      options: [{ long: 'verbose', desc: 'Verbose mode', type: 'boolean', args: 'none' }],
      arguments: [],
      subcommands: [],
    }

    const completion = new BashCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('--verbose')
    expect(script).toContain('--no-verbose')
  })

  it('should not include --no-help/--no-version for built-in controls', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [
        { long: 'help', desc: 'Show help information', type: 'boolean', args: 'none' },
        { long: 'version', desc: 'Show version number', type: 'boolean', args: 'none' },
      ],
      arguments: [],
      subcommands: [],
    }

    const script = new BashCompletion(meta, 'testcli').generate()

    expect(script).toContain('--help')
    expect(script).toContain('--version')
    expect(script).not.toContain('--no-help')
    expect(script).not.toContain('--no-version')
  })

  it('should generate argument slot choices while skipping non-choice arguments', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [
        { long: 'config', desc: 'Config', type: 'string', args: 'required' },
        {
          short: 'f',
          long: 'format',
          desc: 'Format',
          type: 'string',
          args: 'required',
          choices: ['json', 'yaml'],
        },
      ],
      arguments: [
        { name: 'input', kind: 'required', type: 'string' },
        { name: 'mode', kind: 'optional', type: 'choice', choices: ['safe', 'force'] },
      ],
      subcommands: [],
    }

    const script = new BashCompletion(meta, 'testcli').generate()
    expect(script).toContain('opts="json yaml"')
    expect(script).toContain('arg_count=2')
    expect(script).toContain('has_rest=0')
    expect(script).toContain('1) opts="safe force" ;;')
    expect(script).not.toContain('0) opts=')
  })
})

describe('FishCompletion', () => {
  it('should generate valid fish script', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [
        { short: 'v', long: 'verbose', desc: 'Verbose mode', type: 'boolean', args: 'none' },
        {
          long: 'format',
          desc: 'Output format',
          type: 'string',
          args: 'required',
          choices: ['json', 'yaml'],
        },
      ],
      arguments: [],
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
      desc: "It's a test",
      aliases: [],
      options: [{ long: 'opt', desc: "Option's description", type: 'boolean', args: 'none' }],
      arguments: [],
      subcommands: [],
    }

    const completion = new FishCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("Option\\'s description")
  })

  it('should include --no-{option} for boolean options', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [{ long: 'verbose', desc: 'Verbose mode', type: 'boolean', args: 'none' }],
      arguments: [],
      subcommands: [],
    }

    const completion = new FishCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain('-l verbose')
    expect(script).toContain('-l no-verbose')
  })

  it('should not include --no-help/--no-version for built-in controls', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [
        { long: 'help', desc: 'Show help information', type: 'boolean', args: 'none' },
        { long: 'version', desc: 'Show version number', type: 'boolean', args: 'none' },
      ],
      arguments: [],
      subcommands: [],
    }

    const script = new FishCompletion(meta, 'testcli').generate()

    expect(script).toContain('-l help')
    expect(script).toContain('-l version')
    expect(script).not.toContain('-l no-help')
    expect(script).not.toContain('-l no-version')
  })

  it('should generate nested conditions for non-root subcommand completions', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [],
      arguments: [],
      subcommands: [
        {
          name: 'repo',
          desc: 'Repo',
          aliases: [],
          options: [],
          arguments: [],
          subcommands: [
            {
              name: 'sync',
              desc: 'Sync',
              aliases: ['s'],
              options: [],
              arguments: [],
              subcommands: [],
            },
          ],
        },
      ],
    }

    const completion = new FishCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain(
      '__fish_seen_subcommand_from repo; and not __fish_seen_subcommand_from sync s',
    )
    expect(script).toContain('-a s')
  })

  it('should attach argument choice completion condition for nested subcommands', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [],
      arguments: [],
      subcommands: [
        {
          name: 'repo',
          desc: 'Repo',
          aliases: ['r'],
          options: [
            { long: 'format', short: 'f', desc: 'Format', type: 'string', args: 'required' },
          ],
          arguments: [
            { name: 'target', kind: 'required', type: 'string' },
            { name: 'mode', kind: 'optional', type: 'choice', choices: ['safe', 'force'] },
          ],
          subcommands: [],
        },
      ],
    }

    const script = new FishCompletion(meta, 'testcli').generate()
    expect(script).toContain(
      "-n '__fish_seen_subcommand_from repo r; and __testcli_match_arg_slot 1 2 0 1 'format' 'f''",
    )
    expect(script).toContain("-a 'safe force'")
  })

  it('should build fish conditions with full command chain to avoid sibling collisions', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [],
      arguments: [],
      subcommands: [
        {
          name: 'team',
          desc: 'Team',
          aliases: ['t'],
          options: [],
          arguments: [],
          subcommands: [
            {
              name: 'repo',
              desc: 'Repo in team',
              aliases: ['r'],
              options: [],
              arguments: [{ name: 'mode', kind: 'required', type: 'choice', choices: ['safe'] }],
              subcommands: [],
            },
          ],
        },
        {
          name: 'repo',
          desc: 'Root repo',
          aliases: [],
          options: [],
          arguments: [{ name: 'mode', kind: 'required', type: 'choice', choices: ['force'] }],
          subcommands: [],
        },
      ],
    }

    const script = new FishCompletion(meta, 'testcli').generate()
    expect(script).toContain(
      '__fish_seen_subcommand_from team t; and __fish_seen_subcommand_from repo r',
    )
  })
})

describe('PwshCompletion', () => {
  it('should generate valid powershell script', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [{ short: 'h', long: 'help', desc: 'Show help', type: 'boolean', args: 'none' }],
      arguments: [],
      subcommands: [
        {
          name: 'init',
          desc: 'Initialize',
          aliases: [],
          options: [],
          arguments: [],
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
      desc: "It's a test",
      aliases: [],
      options: [],
      arguments: [],
      subcommands: [],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("It''s a test")
  })

  it('should include explicit type/args metadata for options', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [{ long: 'verbose', desc: 'Verbose mode', type: 'boolean', args: 'none' }],
      arguments: [],
      subcommands: [],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("type = 'boolean'")
    expect(script).toContain("args = 'none'")
  })

  it('should skip negative completion for built-in controls', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [
        { long: 'help', desc: 'Show help information', type: 'boolean', args: 'none' },
        { long: 'version', desc: 'Show version number', type: 'boolean', args: 'none' },
        { long: 'verbose', desc: 'Verbose mode', type: 'boolean', args: 'none' },
      ],
      arguments: [],
      subcommands: [],
    }

    const script = new PwshCompletion(meta, 'testcli').generate()

    expect(script).toContain("long = 'help'")
    expect(script).toContain("long = 'version'")
    expect(script).toContain("long = 'verbose'")
    expect(script).toContain('canNegate = $true')
    expect(script).toContain('canNegate = $false')
    expect(script).toContain('if ($opt.canNegate -and "--no-$($opt.long)" -like "$current*")')
    expect(script).not.toContain('--no-help')
    expect(script).not.toContain('--no-version')
  })

  it('should include argument metadata even when argument has no choices', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [],
      arguments: [
        { name: 'input', kind: 'required', type: 'string' },
        { name: 'mode', kind: 'optional', type: 'choice', choices: ['safe', 'force'] },
      ],
      subcommands: [],
    }

    const script = new PwshCompletion(meta, 'testcli').generate()
    expect(script).toContain("name = 'input'")
    expect(script).toContain("type = 'string'")
    expect(script).toContain("name = 'mode'")
    expect(script).toContain("choices = @('safe', 'force')")
  })
})

describe('Integration with Command', () => {
  it('should generate completion from Command', () => {
    const root = new Command({ name: 'mycli', desc: 'My CLI', version: '1.0.0' })
    root.option({
      type: 'string',
      args: 'required',
      short: 'c',
      long: 'config',
      desc: 'Config file',
    })

    const init = new Command({ desc: 'Initialize project' })
    init.option({ type: 'string', args: 'required', long: 'template', desc: 'Template' })
    root.subcommand('init', init)

    const meta = root.getCompletionMeta()

    const bashScript = new BashCompletion(meta, 'mycli').generate()
    expect(bashScript).toContain('--config')
    expect(bashScript).toContain('init')
    expect(bashScript).toContain('--help')
    expect(bashScript).toContain('--version')
    expect(bashScript).not.toContain('--no-help')
    expect(bashScript).not.toContain('--no-version')

    const fishScript = new FishCompletion(meta, 'mycli').generate()
    expect(fishScript).toContain('-l config')
    expect(fishScript).toContain('-l help')
    expect(fishScript).toContain('-l version')
    expect(fishScript).not.toContain('-l no-help')
    expect(fishScript).not.toContain('-l no-version')

    const pwshScript = new PwshCompletion(meta, 'mycli').generate()
    expect(pwshScript).toContain("long = 'config'")
    expect(pwshScript).toContain("long = 'help'")
    expect(pwshScript).toContain("long = 'version'")
  })

  it('should expose argument choices in completion metadata and scripts', () => {
    const root = new Command({ name: 'mycli', desc: 'My CLI' })
      .argument({
        name: 'mode',
        kind: 'required',
        type: 'choice',
        choices: ['safe', 'force'],
        desc: 'Mode',
      })
      .option({
        long: 'format',
        short: 'f',
        type: 'string',
        args: 'required',
        choices: ['json', 'yaml'],
        desc: 'Format',
      })

    const meta = root.getCompletionMeta()
    expect(meta.arguments).toEqual([
      {
        name: 'mode',
        kind: 'required',
        type: 'choice',
        choices: ['safe', 'force'],
      },
    ])

    const bashScript = new BashCompletion(meta, 'mycli').generate()
    expect(bashScript).toContain('safe force')

    const fishScript = new FishCompletion(meta, 'mycli').generate()
    expect(fishScript).toContain('Argument: mode')
    expect(fishScript).toContain("-xa 'json yaml'")

    const pwshScript = new PwshCompletion(meta, 'mycli').generate()
    expect(pwshScript).toContain("choices = @('safe', 'force')")
    expect(pwshScript).toContain('Determine argument slot')

    expect(bashScript).toContain('arg_slot')
    expect(pwshScript).toContain('$argSlot')
    expect(fishScript).toContain('_match_arg_slot')
  })
})

describe('CompletionCommand', () => {
  it('should fallback to "program" when root has no name and programName is omitted', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const root = new Command({ desc: 'Root without name' })
    const completionCmd = new CompletionCommand(root)
    root.subcommand('completion', completionCmd)

    await root.run({ argv: ['completion', '--bash'], envs: {} })

    expect(String(consoleSpy.mock.calls[0]?.[0] ?? '')).toContain('_program_completions()')
    consoleSpy.mockRestore()
  })

  it('should resolve ~ path using USERPROFILE when HOME is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'completion-profile-'))
    const originalHome = process.env['HOME']
    const originalUserProfile = process.env['USERPROFILE']
    delete process.env['HOME']
    process.env['USERPROFILE'] = tempProfile

    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, {
      paths: {
        bash: '~/.mycli-completion',
      },
    })
    root.subcommand('completion', completionCmd)

    try {
      await root.run({ argv: ['completion', '--bash', '--write='], envs: {} })

      const expectedPath = path.join(tempProfile, '.mycli-completion')
      expect(fs.existsSync(expectedPath)).toBe(true)
    } finally {
      if (originalHome === undefined) {
        delete process.env['HOME']
      } else {
        process.env['HOME'] = originalHome
      }
      if (originalUserProfile === undefined) {
        delete process.env['USERPROFILE']
      } else {
        process.env['USERPROFILE'] = originalUserProfile
      }
      fs.rmSync(tempProfile, { recursive: true, force: true })
      consoleSpy.mockRestore()
    }
  })

  it('should allow constructor without config', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root)
    root.subcommand('completion', completionCmd)

    await root.run({ argv: ['completion', '--bash'], envs: {} })

    expect(consoleSpy).toHaveBeenCalled()
    const output = String(consoleSpy.mock.calls[0]?.[0] ?? '')
    expect(output).toContain('_mycli_completions()')

    consoleSpy.mockRestore()
  })

  it('should fallback command path to "command" when completion command is run standalone', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    const root = new Command({ desc: 'Root without name' })
    const completionCmd = new CompletionCommand(root)

    await completionCmd.run({ argv: [], envs: {} })

    const errText = String(consoleErrorSpy.mock.calls[0]?.[0] ?? '')
    expect(errText).toContain('missing required option: one of "--bash", "--fish", or "--pwsh"')
    expect(errText).toContain('Run "command --help" for usage.')
    expect(exitSpy).toHaveBeenCalledWith(2)

    consoleErrorSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('should resolve ~ path to absolute path when HOME and USERPROFILE are both missing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const originalHome = process.env['HOME']
    const originalUserProfile = process.env['USERPROFILE']
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'completion-nohome-'))
    const fishPath = path.join(tempDir, 'no-home.fish')

    delete process.env['HOME']
    delete process.env['USERPROFILE']

    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, {
      paths: { ...testPaths, fish: `~${fishPath}` },
    })
    root.subcommand('completion', completionCmd)

    await root.run({ argv: ['completion', '--fish', '--write', ''], envs: {} })

    expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${fishPath}`)
    expect(fs.existsSync(fishPath)).toBe(true)

    if (originalHome !== undefined) {
      process.env['HOME'] = originalHome
    } else {
      delete process.env['HOME']
    }
    if (originalUserProfile !== undefined) {
      process.env['USERPROFILE'] = originalUserProfile
    } else {
      delete process.env['USERPROFILE']
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
    consoleSpy.mockRestore()
  })

  it('should use derived default write path when config paths are omitted', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'completion-home-'))
    const originalHome = process.env['HOME']
    const originalUserProfile = process.env['USERPROFILE']
    process.env['HOME'] = tempHome
    delete process.env['USERPROFILE']

    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root)
    root.subcommand('completion', completionCmd)

    try {
      await root.run({ argv: ['completion', '--bash', '--write='], envs: {} })

      const expectedPath = path.join(tempHome, '.local/share/bash-completion/completions/mycli')
      expect(fs.existsSync(expectedPath)).toBe(true)
    } finally {
      if (originalHome === undefined) {
        delete process.env['HOME']
      } else {
        process.env['HOME'] = originalHome
      }
      if (originalUserProfile === undefined) {
        delete process.env['USERPROFILE']
      } else {
        process.env['USERPROFILE'] = originalUserProfile
      }
      fs.rmSync(tempHome, { recursive: true, force: true })
      consoleSpy.mockRestore()
    }
  })

  it('should create a completion subcommand', () => {
    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completion', completionCmd)

    expect(completionCmd.name).toBe('completion')
    expect(completionCmd.description).toBe('Generate shell completion script')
  })

  it('should allow custom name via registration', () => {
    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completions', completionCmd)

    expect(completionCmd.name).toBe('completions')
  })

  it('should have bash, fish, pwsh, and write options', () => {
    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completion', completionCmd)

    const cmdMeta = completionCmd.getCompletionMeta()

    expect(cmdMeta.options.some(o => o.long === 'bash')).toBe(true)
    expect(cmdMeta.options.some(o => o.long === 'fish')).toBe(true)
    expect(cmdMeta.options.some(o => o.long === 'pwsh')).toBe(true)
    expect(cmdMeta.options.some(o => o.long === 'write')).toBe(true)
  })

  it('should be an instance of Command', () => {
    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })

    expect(completionCmd).toBeInstanceOf(Command)
  })

  it('should generate bash completion when --bash is passed', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    root.option({ type: 'boolean', args: 'none', long: 'verbose', desc: 'Verbose' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completion', completionCmd)

    await root.run({ argv: ['completion', '--bash'], envs: {} })

    expect(consoleSpy).toHaveBeenCalled()
    const output = consoleSpy.mock.calls[0][0]
    expect(output).toContain('_mycli_completions()')
    expect(output).toContain('complete -F _mycli_completions mycli')

    consoleSpy.mockRestore()
  })

  it('should generate fish completion when --fish is passed', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completion', completionCmd)

    await root.run({ argv: ['completion', '--fish'], envs: {} })

    expect(consoleSpy).toHaveBeenCalled()
    const output = consoleSpy.mock.calls[0][0]
    expect(output).toContain('complete -c mycli')

    consoleSpy.mockRestore()
  })

  it('should generate pwsh completion when --pwsh is passed', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completion', completionCmd)

    await root.run({ argv: ['completion', '--pwsh'], envs: {} })

    expect(consoleSpy).toHaveBeenCalled()
    const output = consoleSpy.mock.calls[0][0]
    expect(output).toContain('Register-ArgumentCompleter -Native -CommandName mycli')

    consoleSpy.mockRestore()
  })

  it('should error when no shell is specified', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completion', completionCmd)

    await root.run({ argv: ['completion'], envs: {} })

    const errText = String(consoleErrorSpy.mock.calls[0]?.[0] ?? '')
    expect(errText).toContain('missing required option: one of "--bash", "--fish", or "--pwsh"')
    expect(exitSpy).toHaveBeenCalledWith(2)

    consoleErrorSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('parse should throw MissingRequired when no shell is specified', async () => {
    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completion', completionCmd)

    await expect(root.parse({ argv: ['completion'], envs: {} })).rejects.toMatchObject({
      name: 'CommanderError',
      kind: 'MissingRequired',
    })
  })

  it('should error when multiple shells are specified', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completion', completionCmd)

    await root.run({ argv: ['completion', '--bash', '--fish'], envs: {} })

    const errText = String(consoleErrorSpy.mock.calls[0]?.[0] ?? '')
    expect(errText).toContain('mutually exclusive')
    expect(exitSpy).toHaveBeenCalledWith(2)

    consoleErrorSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('parse should throw OptionConflict when multiple shells are specified', async () => {
    const root = new Command({ name: 'mycli', desc: 'My CLI' })
    const completionCmd = new CompletionCommand(root, { paths: testPaths })
    root.subcommand('completion', completionCmd)

    await expect(
      root.parse({ argv: ['completion', '--bash', '--fish'], envs: {} }),
    ).rejects.toMatchObject({
      name: 'CommanderError',
      kind: 'OptionConflict',
    })
  })

  describe('--write option', () => {
    let tempDir: string

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commander-test-'))
    })

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true })
    })

    it('should write to default path when --write is used with empty value', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const fishPath = path.join(tempDir, 'fish-completion.fish')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, {
        paths: { ...testPaths, fish: fishPath },
      })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', '--write', ''], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${fishPath}`)
      expect(fs.existsSync(fishPath)).toBe(true)
      const content = fs.readFileSync(fishPath, 'utf-8')
      expect(content).toContain('complete -c mycli')

      consoleSpy.mockRestore()
    })

    it('should write to default path when --write is used without value', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const fishPath = path.join(tempDir, 'fish-completion-no-value.fish')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, {
        paths: { ...testPaths, fish: fishPath },
      })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', '--write'], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${fishPath}`)
      expect(fs.existsSync(fishPath)).toBe(true)

      consoleSpy.mockRestore()
    })

    it('should write to custom path when --write is used with value', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const customPath = path.join(tempDir, 'custom', 'mycli.fish')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, { paths: testPaths })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', '--write', customPath], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${customPath}`)
      expect(fs.existsSync(customPath)).toBe(true)
      const content = fs.readFileSync(customPath, 'utf-8')
      expect(content).toContain('complete -c mycli')

      consoleSpy.mockRestore()
    })

    it('should write to custom path with -w shorthand', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const customPath = path.join(tempDir, 'mycli.bash')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, { paths: testPaths })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--bash', '-w', customPath], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${customPath}`)
      expect(fs.existsSync(customPath)).toBe(true)

      consoleSpy.mockRestore()
    })

    it('should create parent directories if they do not exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const nestedPath = path.join(tempDir, 'a', 'b', 'c', 'mycli.fish')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, { paths: testPaths })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', '--write', nestedPath], envs: {} })

      expect(fs.existsSync(nestedPath)).toBe(true)

      consoleSpy.mockRestore()
    })

    it('should write bash completion to default bash path with empty value', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const bashPath = path.join(tempDir, 'bash-completion')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, {
        paths: { ...testPaths, bash: bashPath },
      })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--bash', '--write', ''], envs: {} })

      expect(fs.existsSync(bashPath)).toBe(true)
      const content = fs.readFileSync(bashPath, 'utf-8')
      expect(content).toContain('_mycli_completions()')

      consoleSpy.mockRestore()
    })

    it('should write pwsh completion to default pwsh path with empty value', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const pwshPath = path.join(tempDir, 'profile.ps1')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, {
        paths: { ...testPaths, pwsh: pwshPath },
      })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--pwsh', '--write', ''], envs: {} })

      expect(fs.existsSync(pwshPath)).toBe(true)
      const content = fs.readFileSync(pwshPath, 'utf-8')
      expect(content).toContain('Register-ArgumentCompleter')

      consoleSpy.mockRestore()
    })

    it('should support --write=path syntax', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const customPath = path.join(tempDir, 'custom-eq.fish')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, { paths: testPaths })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', `--write=${customPath}`], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${customPath}`)
      expect(fs.existsSync(customPath)).toBe(true)

      consoleSpy.mockRestore()
    })

    it('should support -w with path using space syntax', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const customPath = path.join(tempDir, 'custom-short-space.fish')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, { paths: testPaths })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', '-w', customPath], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${customPath}`)
      expect(fs.existsSync(customPath)).toBe(true)

      consoleSpy.mockRestore()
    })

    it('should not write when --write is used without shell', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, { paths: testPaths })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--write', ''], envs: {} })

      const errText = String(consoleErrorSpy.mock.calls[0]?.[0] ?? '')
      expect(errText).toContain('missing required option: one of "--bash", "--fish", or "--pwsh"')
      expect(exitSpy).toHaveBeenCalledWith(2)
      // Should not have written anything
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('written to'))

      consoleErrorSpy.mockRestore()
      consoleSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should expand ~ in default paths with empty write value', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const homeDir = os.homedir()
      const relativePath = path.join(tempDir.replace(homeDir, '~'), 'tilde-test.fish')
      const expandedPath = path.join(tempDir, 'tilde-test.fish')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, {
        paths: { ...testPaths, fish: relativePath },
      })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', '--write', ''], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${expandedPath}`)
      expect(fs.existsSync(expandedPath)).toBe(true)

      consoleSpy.mockRestore()
    })

    it('should use default path with -w shorthand and empty value', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const fishPath = path.join(tempDir, 'fish-shorthand.fish')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, {
        paths: { ...testPaths, fish: fishPath },
      })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', '-w', ''], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${fishPath}`)
      expect(fs.existsSync(fishPath)).toBe(true)

      consoleSpy.mockRestore()
    })

    it('should use default path with -w shorthand without value', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const fishPath = path.join(tempDir, 'fish-shorthand-no-value.fish')

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, {
        paths: { ...testPaths, fish: fishPath },
      })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', '-w'], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${fishPath}`)
      expect(fs.existsSync(fishPath)).toBe(true)

      consoleSpy.mockRestore()
    })

    it('should expand ~ using USERPROFILE when HOME is not set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const fishPath = path.join(tempDir, 'userprofile-test.fish')
      const originalHome = process.env['HOME']
      const originalUserProfile = process.env['USERPROFILE']

      // Simulate Windows environment where HOME is not set but USERPROFILE is
      delete process.env['HOME']
      process.env['USERPROFILE'] = tempDir

      const root = new Command({ name: 'mycli', desc: 'My CLI' })
      const completionCmd = new CompletionCommand(root, {
        paths: { ...testPaths, fish: '~/userprofile-test.fish' },
      })
      root.subcommand('completion', completionCmd)

      await root.run({ argv: ['completion', '--fish', '--write', ''], envs: {} })

      expect(consoleSpy).toHaveBeenCalledWith(`Completion script written to: ${fishPath}`)
      expect(fs.existsSync(fishPath)).toBe(true)

      // Restore environment
      if (originalHome !== undefined) {
        process.env['HOME'] = originalHome
      } else {
        delete process.env['HOME']
      }
      if (originalUserProfile !== undefined) {
        process.env['USERPROFILE'] = originalUserProfile
      } else {
        delete process.env['USERPROFILE']
      }

      consoleSpy.mockRestore()
    })
  })
})

describe('Completion with aliases and nested subcommands', () => {
  it('should include aliases in bash completion', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [],
      arguments: [],
      subcommands: [
        {
          name: 'build',
          desc: 'Build project',
          aliases: ['b', 'compile'],
          options: [],
          arguments: [],
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
      desc: 'Test CLI',
      aliases: [],
      options: [],
      arguments: [],
      subcommands: [
        {
          name: 'build',
          desc: 'Build project',
          aliases: ['b'],
          options: [],
          arguments: [],
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
      desc: 'Test CLI',
      aliases: [],
      options: [],
      arguments: [],
      subcommands: [
        {
          name: 'build',
          desc: 'Build project',
          aliases: ['b'],
          options: [],
          arguments: [],
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
      desc: 'Test CLI',
      aliases: [],
      options: [],
      arguments: [],
      subcommands: [
        {
          name: 'config',
          desc: 'Config commands',
          aliases: [],
          options: [],
          arguments: [],
          subcommands: [
            {
              name: 'set',
              desc: 'Set config value',
              aliases: [],
              options: [{ long: 'key', desc: 'Key name', type: 'string', args: 'required' }],
              arguments: [],
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
      desc: 'Test CLI',
      aliases: [],
      options: [],
      arguments: [],
      subcommands: [
        {
          name: 'config',
          desc: 'Config commands',
          aliases: [],
          options: [],
          arguments: [],
          subcommands: [
            {
              name: 'set',
              desc: 'Set config value',
              aliases: ['s'],
              options: [],
              arguments: [],
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
      desc: 'Test CLI',
      aliases: [],
      options: [
        {
          long: 'format',
          desc: 'Output format',
          type: 'string',
          args: 'required',
          choices: ['json', 'yaml', 'xml'],
        },
      ],
      arguments: [],
      subcommands: [],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("choices = @('json', 'yaml', 'xml')")
  })

  it('should handle options with short in pwsh', () => {
    const meta: ICompletionMeta = {
      name: 'testcli',
      desc: 'Test CLI',
      aliases: [],
      options: [
        {
          short: 'v',
          long: 'verbose',
          desc: 'Verbose mode',
          type: 'boolean',
          args: 'none',
        },
      ],
      arguments: [],
      subcommands: [],
    }

    const completion = new PwshCompletion(meta, 'testcli')
    const script = completion.generate()

    expect(script).toContain("short = 'v'")
    expect(script).toContain("long = 'verbose'")
  })
})
