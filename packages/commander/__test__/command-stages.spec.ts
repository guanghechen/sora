import { describe, expect, it, vi } from 'vitest'
import type {
  ICommand,
  ICommandOptionConfig,
  ICommandToken,
  ISubcommandEntry,
} from '../src/command/types'
import { CommanderError } from '../src/command/types'
import {
  buildOptionPolicyMap as buildBuiltinPolicyMap,
  findTokenByOriginal,
  mustGetOptionPolicy as mustGetBuiltinPolicy,
  resolveOptionPolicy as resolveBuiltinPolicy,
} from '../src/internal/stages/builtin-resolve'
import { runControl, scanControl } from '../src/internal/stages/control'
import { assertUnknownSubcommand, parseArguments } from '../src/internal/stages/parse'
import {
  buildPresetSources,
  resolvePresetConfigFromChain,
  scanPresetDirectives,
} from '../src/internal/stages/preset'
import {
  resolveTokensByChain,
  shiftTokens,
  validateMergedShortOptions,
} from '../src/internal/stages/resolve'
import {
  findCommandByPath,
  resolveHelpCommand,
  routeCommandChain,
} from '../src/internal/stages/route'
import { runStage } from '../src/internal/stages/run'
import { tokenizeArgv } from '../src/internal/stages/tokenize'

function createCommandStub(name: string): ICommand {
  return {
    name,
    version: undefined,
    builtin: undefined,
    preset: undefined,
    description: name,
    parent: undefined,
    options: [],
    arguments: [],
    examples: [],
    subcommands: new Map(),
  }
}

function token(raw: string, type: ICommandToken['type'], name: string): ICommandToken {
  return {
    original: raw,
    resolved: raw,
    type,
    name,
    source: 'user',
  }
}

describe('stage: route/control', () => {
  it('should route command chain and stop at option token', () => {
    const leaf = { id: 'leaf' }
    const root = { id: 'root' }
    const entries = new Map<unknown, Array<ISubcommandEntry<unknown>>>([
      [root, [{ name: 'build', aliases: ['b'], command: leaf }]],
      [leaf, []],
    ])

    const result = routeCommandChain({
      root,
      argv: ['b', '--help'],
      getSubcommandEntries: command => entries.get(command) ?? [],
    })

    expect(result.cmds).toEqual(['b'])
    expect(result.remaining).toEqual(['--help'])
    expect(result.chain).toEqual([root, leaf])
  })

  it('should resolve help target and find command by path', () => {
    const child = { id: 'child', name: 'child' }
    const root = { id: 'root', name: 'cli' }
    const entries = new Map<unknown, Array<ISubcommandEntry<unknown>>>([
      [root, [{ name: 'child', aliases: ['c'], command: child }]],
      [child, []],
    ])

    expect(
      resolveHelpCommand({
        leafCommand: root,
        helpTarget: 'c',
        getSubcommandEntries: command => entries.get(command) ?? [],
      }),
    ).toBe(child)

    expect(
      findCommandByPath({
        root,
        commandPath: 'cli child',
        getCommandName: command => (command as { name?: string }).name,
        getSubcommandEntries: command => entries.get(command) ?? [],
      }),
    ).toBe(child)
  })

  it('should scan controls and run short-circuit with help priority', () => {
    const scanResult = scanControl({
      tailArgv: ['help', 'deploy', '--version', '--', '--help'],
      supportsBuiltinVersion: true,
    })

    expect(scanResult.controls).toEqual({ help: true, version: true })
    expect(scanResult.helpTarget).toBe('deploy')
    expect(scanResult.remaining).toEqual(['--', '--help'])

    const termination = runControl({
      leafCommand: { path: 'cli deploy', version: '1.0.0' },
      controlScanResult: scanResult,
      resolveHelpCommand: leaf => leaf,
      getCommandPath: command => command.path,
      getCommandVersion: command => command.version,
    })

    expect(termination).toEqual({
      kind: 'help',
      targetCommandPath: 'cli deploy',
    })
  })
})

describe('stage: preset', () => {
  it('should resolve chain preset config from nearest command', () => {
    const root = { preset: { file: 'root.yml' } }
    const leaf = { preset: { profile: 'dev' } }

    const result = resolvePresetConfigFromChain({
      chain: [root, leaf],
      getPresetConfig: command => command.preset,
    })

    expect(result).toEqual({
      presetFile: 'root.yml',
      presetProfile: 'dev',
    })
  })

  it('should scan preset directives and keep clean argv', () => {
    const result = scanPresetDirectives({
      argv: ['--preset-file=a.yml', '--preset-profile', 'qa:cn', '--foo'],
      commandPath: 'cli',
      presetFileFlag: '--preset-file',
      presetProfileFlag: '--preset-profile',
      assertPresetProfileSelectorValue: () => {},
    })

    expect(result).toEqual({
      cleanArgv: ['--foo'],
      presetFile: 'a.yml',
      presetProfile: 'qa:cn',
    })
  })

  it('should throw when preset directive value is missing', () => {
    expect(() =>
      scanPresetDirectives({
        argv: ['--preset-profile'],
        commandPath: 'cli',
        presetFileFlag: '--preset-file',
        presetProfileFlag: '--preset-profile',
        assertPresetProfileSelectorValue: () => {},
      }),
    ).toThrow('missing value for "--preset-profile"')
  })

  it('should build source snapshots and preset segments', () => {
    const result = buildPresetSources({
      userCmds: ['deploy'],
      userArgv: ['--force'],
      userEnvs: { NODE_ENV: 'test' },
      presetArgv: ['--log-level=debug'],
      presetEnvs: { LOG_LEVEL: 'debug' },
      presetMeta: { file: 'preset.yml', profile: 'dev', variant: 'cn' },
      presetResolvedEnvFile: '/tmp/preset/dev.env',
    })

    expect(result.sources.preset.state).toBe('applied')
    expect(result.sources.preset.meta?.resolvedEnvFile).toBe('/tmp/preset/dev.env')
    expect(result.tailArgv).toEqual(['--log-level=debug', '--force'])
    expect(result.segments[0].source).toBe('preset')
    expect(result.segments[1].source).toBe('user')
  })

  it('should not expose resolvedEnvFile when no envFile is selected', () => {
    const result = buildPresetSources({
      userCmds: ['deploy'],
      userArgv: ['--force'],
      userEnvs: { NODE_ENV: 'test' },
      presetArgv: ['--log-level=debug'],
      presetEnvs: { LOG_LEVEL: 'debug' },
      presetMeta: { file: 'preset.yml', profile: 'dev' },
      presetResolvedEnvFile: undefined,
    })

    expect(result.sources.preset.state).toBe('applied')
    expect(result.sources.preset.meta).toBeDefined()
    expect(result.sources.preset.meta?.resolvedEnvFile).toBeUndefined()
    expect('resolvedEnvFile' in (result.sources.preset.meta ?? {})).toBe(false)
  })
})

describe('stage: tokenize/builtin-resolve', () => {
  it('should tokenize long/short/negative options and pass through -- rest args', () => {
    const result = tokenizeArgv(
      [
        { value: '--no-color', source: 'user' },
        { value: '-ab', source: 'user' },
        { value: '--', source: 'user' },
        { value: '--raw', source: 'user' },
      ],
      'cli',
    )

    expect(result.optionTokens.map(token => token.resolved)).toEqual(['--color=false', '-a', '-b'])
    expect(result.restArgs).toEqual(['--raw'])
  })

  it('should reject invalid tokenize syntax and resolve builtin options', () => {
    expect(() => tokenizeArgv([{ value: '--log_level', source: 'user' }], 'cli')).toThrow(
      "use '-' instead of",
    )
    expect(() => tokenizeArgv([{ value: '-o=value', source: 'user' }], 'cli')).toThrow(
      'is not supported',
    )

    const policy = resolveBuiltinPolicy({
      builtinOption: {
        version: true,
        color: true,
        devmode: true,
        logLevel: true,
        silent: true,
        logDate: true,
        logColorful: true,
      },
      localOptions: [
        {
          long: 'color',
          type: 'boolean',
          args: 'none',
          desc: 'user color',
        },
      ],
    })

    expect(policy.mergedOptions.some(option => option.long === 'devmode')).toBe(true)
    expect(
      policy.mergedOptions.some(option => option.long === 'color' && option.desc === 'user color'),
    ).toBe(true)

    const map = buildBuiltinPolicyMap({
      chain: ['root', 'leaf'],
      resolveOptionPolicy: () => policy,
    })
    expect(map.get('root')).toBeDefined()

    const fallback = mustGetBuiltinPolicy({
      optionPolicyMap: map,
      command: 'missing',
      resolveOptionPolicy: () => ({ mergedOptions: [] }),
    })
    expect(fallback.mergedOptions).toEqual([])

    expect(findTokenByOriginal([token('--x', 'long', 'x')], '--x')?.name).toBe('x')
  })
})

describe('stage: resolve/parse/run', () => {
  it('should shift and resolve tokens by command chain', () => {
    const root = createCommandStub('cli')
    const leaf = createCommandStub('leaf')
    const rootOption: ICommandOptionConfig = {
      long: 'verbose',
      short: 'v',
      type: 'boolean',
      args: 'none',
      desc: 'verbose',
    }
    const leafOption: ICommandOptionConfig = {
      long: 'port',
      short: 'p',
      type: 'string',
      args: 'required',
      desc: 'port',
    }

    const shifted = shiftTokens({
      tokens: [token('--port', 'long', 'port'), token('3000', 'none', '')],
      shadowed: new Set<string>(),
      allOptions: [leafOption],
    })
    expect(shifted.consumed).toHaveLength(2)
    expect(shifted.remaining).toHaveLength(0)

    const optionPolicyMap = new Map([
      [root, { mergedOptions: [rootOption] }],
      [leaf, { mergedOptions: [leafOption] }],
    ])
    const resolved = resolveTokensByChain({
      chain: [root, leaf],
      tokens: [token('--port', 'long', 'port'), token('3000', 'none', '')],
      optionPolicyMap,
      mustGetOptionPolicy: (map, command) =>
        map.get(command) as { mergedOptions: ICommandOptionConfig[] },
      getLocalOptions: command => (command === root ? [rootOption] : [leafOption]),
      getCommandPath: command => command.name ?? 'cli',
    })

    expect(resolved.argTokens).toEqual([])
    expect((resolved.consumedTokens.get(leaf) ?? []).length).toBe(2)
  })

  it('should report unknown option and short option conflicts', () => {
    const root = createCommandStub('cli')
    const leaf = createCommandStub('leaf')
    const optionA: ICommandOptionConfig = {
      long: 'alpha',
      short: 'a',
      type: 'boolean',
      args: 'none',
      desc: 'alpha',
    }
    const optionB: ICommandOptionConfig = {
      long: 'another',
      short: 'a',
      type: 'boolean',
      args: 'none',
      desc: 'another',
    }

    expect(() =>
      resolveTokensByChain({
        chain: [root, leaf],
        tokens: [token('--unknown', 'long', 'unknown')],
        optionPolicyMap: new Map([
          [root, { mergedOptions: [] }],
          [leaf, { mergedOptions: [] }],
        ]),
        mustGetOptionPolicy: (map, command) =>
          map.get(command) as { mergedOptions: ICommandOptionConfig[] },
        getLocalOptions: () => [],
        getCommandPath: command => command.name ?? 'cli',
      }),
    ).toThrow('unknown option "--unknown"')

    expect(() =>
      validateMergedShortOptions({
        chain: [root, leaf],
        optionPolicyMap: new Map([
          [root, { mergedOptions: [optionA] }],
          [leaf, { mergedOptions: [optionB] }],
        ]),
        mustGetOptionPolicy: (map, command) =>
          map.get(command) as { mergedOptions: ICommandOptionConfig[] },
        rootCommandPath: 'cli',
      }),
    ).toThrow('short option "-a" conflicts')
  })

  it('should parse positional arguments and unknown subcommand hint', () => {
    const parsed = parseArguments({
      commandPath: 'cli',
      rawArgs: ['prod'],
      argumentDefs: [
        {
          name: 'env',
          type: 'choice',
          kind: 'required',
          choices: ['prod', 'dev'],
        },
      ],
    })
    expect(parsed.args).toEqual({ env: 'prod' })

    expect(() =>
      assertUnknownSubcommand({
        userTailArgv: ['depliy'],
        subcommands: [
          { name: 'deploy', aliases: [], command: {} },
          { name: 'destroy', aliases: [], command: {} },
        ],
        hasArguments: false,
        commandPath: 'cli',
        withDiagnosticsIssue: error =>
          error.withIssue({
            kind: 'error',
            stage: 'parse',
            scope: 'command',
            source: { primary: 'user' },
            reason: {
              code: 'unknown_subcommand',
              message: error.message,
            },
          }),
      }),
    ).toThrow('unknown subcommand "depliy"')
  })

  it('should run action path and help fallback path', async () => {
    const action = vi.fn(async () => {})
    await runStage({
      leafCommand: { name: 'leaf', hasAction: true, hasSubcommands: false },
      actionParams: {
        ctx: {} as never,
        builtin: { devmode: false },
        opts: {},
        args: {},
        rawArgs: [],
      },
      tailArgv: [],
      envs: {},
      hasAction: command => command.hasAction,
      runAction: async (_command, params) => {
        await action(params)
      },
      hasSubcommands: command => command.hasSubcommands,
      renderHelpForDisplay: () => 'help-text',
      print: () => {},
      getCommandPath: command => command.name,
    })
    expect(action).toHaveBeenCalledOnce()

    const print = vi.fn()
    await runStage({
      leafCommand: { name: 'leaf', hasAction: false, hasSubcommands: true },
      actionParams: {
        ctx: {} as never,
        builtin: { devmode: false },
        opts: {},
        args: {},
        rawArgs: [],
      },
      tailArgv: ['--help'],
      envs: {},
      hasAction: command => command.hasAction,
      runAction: async () => {},
      hasSubcommands: command => command.hasSubcommands,
      renderHelpForDisplay: () => 'help-text',
      print,
      getCommandPath: command => command.name,
    })
    expect(print).toHaveBeenCalledWith('help-text')

    await expect(
      runStage({
        leafCommand: { name: 'leaf', hasAction: false, hasSubcommands: false },
        actionParams: {
          ctx: {} as never,
          builtin: { devmode: false },
          opts: {},
          args: {},
          rawArgs: [],
        },
        tailArgv: [],
        envs: {},
        hasAction: command => command.hasAction,
        runAction: async () => {},
        hasSubcommands: command => command.hasSubcommands,
        renderHelpForDisplay: () => 'help-text',
        print: () => {},
        getCommandPath: command => command.name,
      }),
    ).rejects.toBeInstanceOf(CommanderError)
  })
})
