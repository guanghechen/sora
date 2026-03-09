/**
 * Command class - CLI command builder with fluent API
 *
 * Execution flow: route → control-scan → control-run(run) → preset → tokenize → builtin-resolve → resolve → parse → run
 *
 * @module @guanghechen/commander
 */

import type { IReporter } from '@guanghechen/reporter'
import { Reporter } from '@guanghechen/reporter'
import { runCommandAction } from '../internal/command/action'
import {
  BUILTIN_HELP_OPTION,
  BUILTIN_VERSION_OPTION,
  errorKindToIssueScope,
  normalizeBuiltinConfig,
} from '../internal/command/builtins'
import { createCommandContext, freezeInputSources } from '../internal/command/context'
import { buildCompletionMeta, buildHelpSubcommands } from '../internal/command/help-completion'
import { readPresetFile, resolvePresetFileAbsolutePath } from '../internal/command/preset'
import { handleRunOutcome, unwrapParseOutcome } from '../internal/command/run-parse'
import {
  checkOptionUniqueness,
  normalizeExample,
  validateArgumentConfig,
  validateOptionConfig,
} from '../internal/command/validation'
import {
  CommandKernel,
  type ICommandExecutionMode,
  type ICommandExecutionTermination,
  type IExecutionOutcome,
} from '../internal/command-kernel'
import { CommandContextAdapter } from '../internal/context-adapter'
import { CommandDiagnosticsEngine } from '../internal/diagnostics-engine'
import { CommandHelpRenderer } from '../internal/help/command-help-renderer'
import { CommandOptionParser } from '../internal/parse/command-option-parser'
import {
  CommandPresetProfileParser,
  PRESET_FILE_FLAG,
  PRESET_PROFILE_FLAG,
} from '../internal/preset/preset-profile-parser'
import {
  type ICommandOptionPolicy,
  buildOptionPolicyMap,
  mustGetOptionPolicy,
  resolveOptionPolicy,
} from '../internal/stages/builtin-resolve'
import { runControl, scanControl } from '../internal/stages/control'
import { parseStage } from '../internal/stages/parse'
import { runPresetStage } from '../internal/stages/preset'
import { resolveStage } from '../internal/stages/resolve'
import { findCommandByPath, resolveHelpCommand, routeCommandChain } from '../internal/stages/route'
import { runStage } from '../internal/stages/run'
import { tokenizeArgv } from '../internal/stages/tokenize'
import { getDefaultCommandRuntime } from '../runtime'
import { CommanderError } from './types'
import type {
  ICommand,
  ICommandAction,
  ICommandArgumentConfig,
  ICommandBuiltinResolved,
  ICommandConfig,
  ICommandContext,
  ICommandControlScanResult,
  ICommandExample,
  ICommandInputSources,
  ICommandOptionConfig,
  ICommandParseResult,
  ICommandPresetConfig,
  ICommandPresetResult,
  ICommandResolveResult,
  ICommandRouteResult,
  ICommandRunParams,
  ICommandRuntime,
  ICommandToken,
  ICompletionMeta,
  IHelpData,
  ISubcommandEntry,
} from './types'

// ==================== Command Class ====================

export class Command implements ICommand {
  #name: string
  readonly #desc: string
  readonly #version: string | undefined
  readonly #builtinConfig: ICommandConfig['builtin'] | undefined
  readonly #builtin: ICommandBuiltinResolved
  readonly #presetConfig: ICommandPresetConfig | undefined
  readonly #reporter: IReporter | undefined
  readonly #runtime: ICommandRuntime
  readonly #contextAdapter = new CommandContextAdapter()
  readonly #diagnostics = new CommandDiagnosticsEngine()
  readonly #helpRenderer = new CommandHelpRenderer()
  readonly #optionParser = new CommandOptionParser()
  readonly #presetProfileParser: CommandPresetProfileParser
  readonly #kernel: CommandKernel<Command, ICommandOptionPolicy>
  #parent: Command | undefined

  readonly #options: ICommandOptionConfig[] = []
  readonly #arguments: ICommandArgumentConfig[] = []
  readonly #examples: ICommandExample[] = []
  readonly #subcommandsList: Array<ISubcommandEntry<Command>> = []
  readonly #subcommandsMap = new Map<string, Command>()
  #action: ICommandAction | undefined = undefined

  constructor(config: ICommandConfig) {
    this.#name = config.name ?? ''
    this.#desc = config.desc
    this.#version = config.version
    this.#builtinConfig = config.builtin
    this.#builtin = normalizeBuiltinConfig(config.builtin)
    this.#presetConfig = config.preset
    this.#reporter = config.reporter
    this.#runtime = config.runtime ?? getDefaultCommandRuntime()
    this.#presetProfileParser = new CommandPresetProfileParser({
      resolvePresetFileAbsolutePath: (filepath, baseDirectory) =>
        resolvePresetFileAbsolutePath({
          runtime: this.#runtime,
          filepath,
          baseDirectory,
        }),
      resolvePath: (...paths) => this.#runtime.resolve(...paths),
      readPresetFile: async (file, commandPath) =>
        readPresetFile({ runtime: this.#runtime, file, commandPath }),
    })
    this.#kernel = new CommandKernel({
      port: {
        route: argv => this.#route(argv),
        createContext: params => this.#createContext(params),
        controlScan: (tailArgv, leafCommand) => this.#controlScan(tailArgv, leafCommand),
        controlRun: (leafCommand, controlScanResult) =>
          this.#controlRun(leafCommand, controlScanResult),
        preset: async (tailArgv, ctx) => this.#preset(tailArgv, ctx),
        tokenize: (segments, commandPath) => tokenizeArgv(segments, commandPath),
        getCommandPath: command => command.#getCommandPath(),
        buildOptionPolicyMap: chain => this.#buildOptionPolicyMap(chain),
        resolve: (chain, optionTokens, optionPolicyMap) =>
          this.#resolve(chain, optionTokens, optionPolicyMap),
        parse: (chain, resolveResult, optionPolicyMap, ctx, restArgs) =>
          this.#parse(chain, resolveResult, optionPolicyMap, ctx, restArgs),
        run: async ({ leafCommand, parseResult, presetResult, ctx }) =>
          runStage({
            leafCommand,
            actionParams: this.#contextAdapter.toActionParams(parseResult),
            tailArgv: presetResult.tailArgv,
            envs: ctx.envs,
            hasAction: command => command.#action !== undefined,
            runAction: async (command, actionParams) =>
              runCommandAction({
                action: command.#action,
                actionParams,
                commandPath: command.#getCommandPath(),
              }),
            hasSubcommands: command => command.#subcommandsList.length > 0,
            renderHelpForDisplay: (command, options) => {
              const helpColor = command.#resolveHelpColorFromTailArgv(
                options.tailArgv,
                options.envs,
              )
              return command.#formatHelpForDisplay({ color: helpColor })
            },
            print: content => {
              console.log(content)
            },
            getCommandPath: command => command.#getCommandPath(),
          }),
        issueScopeFromErrorKind: kind => errorKindToIssueScope(kind),
      },
      diagnostics: this.#diagnostics,
      contextAdapter: this.#contextAdapter,
    })
  }

  // ==================== ICommand Properties ====================

  public get name(): string | undefined {
    return this.#name || undefined
  }

  public get description(): string {
    return this.#desc
  }

  public get version(): string | undefined {
    return this.#version
  }

  public get builtin(): ICommandConfig['builtin'] | undefined {
    return this.#builtinConfig
  }

  public get preset(): ICommandPresetConfig | undefined {
    return this.#presetConfig === undefined ? undefined : { ...this.#presetConfig }
  }

  public get parent(): Command | undefined {
    return this.#parent
  }

  public get options(): ICommandOptionConfig[] {
    return [...this.#options]
  }

  public get arguments(): ICommandArgumentConfig[] {
    return [...this.#arguments]
  }

  public get examples(): ICommandExample[] {
    return this.#examples.map(example => ({ ...example }))
  }

  public get subcommands(): Map<string, ICommand> {
    return new Map(this.#subcommandsMap)
  }

  // ==================== Definition Methods ====================

  public option<T>(opt: ICommandOptionConfig<T>): this {
    const commandPath = this.#getCommandPath()
    validateOptionConfig({ opt, commandPath })
    checkOptionUniqueness({ opt, options: this.#options, commandPath })
    this.#options.push(opt as ICommandOptionConfig)
    return this
  }

  public argument<T>(arg: ICommandArgumentConfig<T>): this {
    validateArgumentConfig({
      arg: arg as ICommandArgumentConfig,
      arguments_: this.#arguments,
      commandPath: this.#getCommandPath(),
    })
    this.#arguments.push(arg as ICommandArgumentConfig)
    return this
  }

  public action(fn: ICommandAction): this {
    this.#action = fn
    return this
  }

  public example(title: string, usage: string, desc: string): this {
    this.#examples.push(
      normalizeExample({
        example: { title, usage, desc },
        commandPath: this.#getCommandPath(),
      }),
    )
    return this
  }

  // ==================== Assembly Methods ====================

  public subcommand(name: string, cmd: Command): this {
    if (name === 'help') {
      throw new CommanderError(
        'ConfigurationError',
        '"help" is a reserved subcommand name',
        this.#getCommandPath(),
      )
    }

    if (cmd.#parent && cmd.#parent !== this) {
      throw new CommanderError(
        'ConfigurationError',
        `command "${cmd.#name}" already has a parent`,
        this.#getCommandPath(),
      )
    }

    const occupied = this.#subcommandsMap.get(name)
    if (occupied && occupied !== cmd) {
      throw new CommanderError(
        'ConfigurationError',
        `subcommand name/alias "${name}" conflicts with an existing command`,
        this.#getCommandPath(),
      )
    }

    // Check if cmd is already registered
    const existing = this.#subcommandsList.find(e => e.command === cmd)
    if (existing) {
      if (existing.name === name || existing.aliases.includes(name)) {
        return this
      }
      // Add name as alias
      existing.aliases.push(name)
      this.#subcommandsMap.set(name, cmd)
    } else {
      // New registration
      /* eslint-disable no-param-reassign */
      cmd.#name = name
      cmd.#parent = this
      /* eslint-enable no-param-reassign */
      this.#subcommandsList.push({ name, aliases: [], command: cmd })
      this.#subcommandsMap.set(name, cmd)
    }
    return this
  }

  // ==================== Execution Methods ====================

  public async run(params: ICommandRunParams): Promise<void> {
    const outcome = await this.#execute(params, 'run')

    handleRunOutcome({
      outcome,
      argv: params.argv,
      envs: params.envs,
      route: argv => this.#route(argv),
      controlScan: (tailArgv, leafCommand) => this.#controlScan(tailArgv, leafCommand),
      findCommandByPath: commandPath => this.#findCommandByPath(commandPath),
      resolveHelpCommand: (leafCommand, helpTarget) =>
        this.#resolveHelpCommand(leafCommand, helpTarget),
      resolveHelpColor: (command, tailArgv, envs) =>
        command.#resolveHelpColorFromTailArgv(tailArgv, envs),
      formatHelpForDisplay: (command, color) => command.#formatHelpForDisplay({ color }),
      print: content => {
        console.log(content)
      },
      printError: content => {
        console.error(content)
      },
      exit: code => this.#exit(code),
      normalizeControlRunError: error => {
        const enrichedError = this.#diagnostics.withErrorIssue(error, {
          stage: 'control-run',
          scope: 'control',
        })
        return this.#diagnostics.normalizeCommanderError(enrichedError, {
          fallbackStage: 'control-run',
          fallbackScope: 'control',
        })
      },
    })
  }

  #exit(code: number): void {
    ;(process.exit as (code?: number) => void)(code)
  }

  public async parse(params: ICommandRunParams): Promise<ICommandParseResult> {
    const outcome = await this.#execute(params, 'parse')
    return unwrapParseOutcome({
      outcome,
      commandPath: this.#getCommandPath(),
    })
  }

  async #execute(
    params: ICommandRunParams,
    mode: ICommandExecutionMode,
  ): Promise<IExecutionOutcome> {
    return this.#kernel.execute(params, mode)
  }

  #controlRun(
    leafCommand: Command,
    controlScanResult: ICommandControlScanResult,
  ): ICommandExecutionTermination | undefined {
    return runControl({
      leafCommand,
      controlScanResult,
      resolveHelpCommand: (leaf, helpTarget) => this.#resolveHelpCommand(leaf, helpTarget),
      getCommandPath: command => command.#getCommandPath(),
      getCommandVersion: command => command.#version,
    })
  }

  #findCommandByPath(commandPath: string): Command | undefined {
    return findCommandByPath<Command>({
      root: this,
      commandPath,
      getCommandName: command => command.#name || undefined,
      getSubcommandEntries: command => command.#subcommandsList,
    })
  }

  public formatHelp(): string {
    return this.#helpRenderer.formatHelp(this.#buildHelpData())
  }

  #formatHelpForDisplay(params: { color?: boolean } = {}): string {
    const { color = true } = params
    return this.#helpRenderer.formatHelpForDisplay(this.#buildHelpData(), color)
  }

  #buildHelpData(): IHelpData {
    const subcommands = buildHelpSubcommands({
      entries: this.#subcommandsList,
      getDescription: command => command.#desc,
    })

    return this.#helpRenderer.buildHelpData({
      desc: this.#desc,
      commandPath: this.#getCommandPath(),
      arguments: this.#arguments,
      options: this.#resolveOptionPolicy().mergedOptions,
      supportsBuiltinVersion: this.#supportsBuiltinVersion(),
      subcommands,
      examples: this.#examples,
      builtinHelpOption: BUILTIN_HELP_OPTION,
      builtinVersionOption: BUILTIN_VERSION_OPTION,
    })
  }

  public getCompletionMeta(): ICompletionMeta {
    return buildCompletionMeta({
      name: this.#name,
      desc: this.#desc,
      mergedOptions: this.#resolveOptionPolicy().mergedOptions,
      arguments_: this.#arguments,
      supportsBuiltinVersion: this.#supportsBuiltinVersion(),
      builtinHelpOption: BUILTIN_HELP_OPTION,
      builtinVersionOption: BUILTIN_VERSION_OPTION,
      subcommands: this.#subcommandsList,
      resolveSubcommandMeta: command => command.getCompletionMeta(),
    })
  }

  // ==================== Stage 0: ROUTE ====================

  /**
   * Route and return the full command chain (root → leaf).
   */
  #route(argv: string[]): ICommandRouteResult<Command> {
    return routeCommandChain<Command>({
      root: this,
      argv,
      getSubcommandEntries: command => command.#subcommandsList,
    })
  }

  #controlScan(tailArgv: string[], leafCommand: Command): ICommandControlScanResult {
    return scanControl({
      tailArgv,
      supportsBuiltinVersion: leafCommand.#supportsBuiltinVersion(),
    })
  }

  #createContext(params: {
    chain: Command[]
    cmds: string[]
    envs: Record<string, string | undefined>
    reporter?: IReporter
  }): ICommandContext {
    const { chain, cmds, envs, reporter } = params
    const leafCommand = chain[chain.length - 1]
    return createCommandContext({
      leafCommand,
      chain,
      cmds,
      envs,
      reporter: reporter ?? this.#reporter ?? new Reporter(),
    })
  }

  #resolveHelpCommand(leafCommand: Command, helpTarget: string | undefined): Command {
    return resolveHelpCommand<Command>({
      leafCommand,
      helpTarget,
      getSubcommandEntries: command => command.#subcommandsList,
    })
  }

  async #preset(
    controlTailArgv: string[],
    ctx: ICommandContext,
  ): Promise<ICommandPresetResult & { sources: ICommandInputSources }> {
    const commandPath = (ctx.chain[ctx.chain.length - 1] as Command).#getCommandPath()
    return runPresetStage({
      controlTailArgv,
      chain: ctx.chain as Command[],
      commandPath,
      presetFileFlag: PRESET_FILE_FLAG,
      presetProfileFlag: PRESET_PROFILE_FLAG,
      runtime: this.#runtime,
      userCmds: ctx.sources.user.cmds,
      userEnvs: ctx.sources.user.envs,
      getPresetConfig: command => command.#presetConfig,
      assertPresetProfileSelectorValue: (value, sourceName, path) =>
        this.#presetProfileParser.assertPresetProfileSelectorValue(value, sourceName, path),
      resolvePresetProfile: params => this.#presetProfileParser.resolvePresetProfile(params),
      validatePresetOptionTokens: (tokens, filepath, path) =>
        this.#presetProfileParser.validatePresetOptionTokens(tokens, filepath, path),
    })
  }

  // ==================== Stage 6: RESOLVE ====================

  /**
   * Resolve: bottom-up option consumption through command chain.
   */
  #resolve(
    chain: Command[],
    tokens: ICommandToken[],
    optionPolicyMap: Map<Command, ICommandOptionPolicy>,
  ): ICommandResolveResult {
    return resolveStage({
      chain,
      tokens,
      optionPolicyMap,
      mustGetOptionPolicy: (map, command) => this.#mustGetOptionPolicy(map, command),
      getLocalOptions: command => command.#options,
      getCommandPath: command => command.#getCommandPath(),
      withUnknownOptionIssue: (error, token) =>
        this.#diagnostics.withErrorIssue(error, {
          stage: 'resolve',
          scope: 'option',
          token,
        }),
    })
  }

  // ==================== Stage 7: PARSE ====================

  /**
   * Parse: top-down tokens → opts, call apply callbacks.
   */
  #parse(
    chain: Command[],
    resolveResult: ICommandResolveResult,
    optionPolicyMap: Map<Command, ICommandOptionPolicy>,
    ctx: ICommandContext,
    restArgs: string[],
  ): ICommandParseResult {
    return parseStage({
      chain,
      resolveResult,
      optionPolicyMap,
      ctx,
      restArgs,
      rootCommandPath: this.#getCommandPath(),
      mustGetOptionPolicy: (map, command) => this.#mustGetOptionPolicy(map, command),
      parseOptions: ({ command, tokens, allOptions, envs, commandPath }) =>
        command.#optionParser.parseOptions({
          tokens,
          allOptions,
          envs,
          commandPath,
        }),
      applyBuiltinDevmodeLogLevel: ({ command, opts, explicitOptionLongs }) => {
        command.#optionParser.applyBuiltinDevmodeLogLevel({
          opts,
          explicitOptionLongs,
          builtinOption: command.#builtin.option,
          hasUserOption: long => command.#hasUserOption(long),
        })
      },
      resolveBuiltinParsedOptions: ({ command, opts }) =>
        command.#optionParser.resolveBuiltinParsedOptions({
          opts,
          builtinOption: command.#builtin.option,
          hasUserOption: long => command.#hasUserOption(long),
        }),
      applyOptionCallbacks: ({ opts, allOptions, ctx }) => {
        for (const option of allOptions) {
          if (option.apply && opts[option.long] !== undefined) {
            option.apply(opts[option.long], ctx)
          }
        }
      },
      getLocalOptions: command => command.#options,
      getSubcommands: command => command.#subcommandsList,
      getArguments: command => command.#arguments,
      getCommandPath: command => command.#getCommandPath(),
      withUnknownSubcommandIssue: error =>
        this.#diagnostics.withErrorIssue(error, {
          stage: 'parse',
          scope: 'command',
          source: { primary: 'user' },
        }),
      freezeInputSources: sources => this.#freezeInputSources(sources),
    })
  }

  // ==================== Private: Option Merging ====================

  #hasUserOption(long: string): boolean {
    return this.#options.some(option => option.long === long)
  }

  #supportsBuiltinVersion(): boolean {
    return this.#version !== undefined && this.#builtin.option.version
  }

  #resolveOptionPolicy(): ICommandOptionPolicy {
    return resolveOptionPolicy({
      builtinOption: this.#builtin.option,
      localOptions: this.#options,
    })
  }

  #buildOptionPolicyMap(chain: Command[]): Map<Command, ICommandOptionPolicy> {
    return buildOptionPolicyMap({
      chain,
      resolveOptionPolicy: command => command.#resolveOptionPolicy(),
    })
  }

  #mustGetOptionPolicy(
    optionPolicyMap: Map<Command, ICommandOptionPolicy>,
    cmd: Command,
  ): ICommandOptionPolicy {
    return mustGetOptionPolicy({
      optionPolicyMap,
      command: cmd,
      resolveOptionPolicy: command => command.#resolveOptionPolicy(),
    })
  }

  // ==================== Private: Utilities ====================

  #resolveHelpColorFromTailArgv(
    tailArgv: string[],
    envs: Record<string, string | undefined>,
    policy: ICommandOptionPolicy = this.#resolveOptionPolicy(),
  ): boolean {
    return this.#helpRenderer.resolveHelpColorFromTailArgv({
      tailArgv,
      envs,
      options: policy.mergedOptions,
      commandPath: this.#getCommandPath(),
    })
  }

  #freezeInputSources(sources: ICommandInputSources): ICommandInputSources {
    return freezeInputSources(sources)
  }

  #getCommandPath(): string {
    const parts: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: Command | undefined = this
    while (current) {
      if (current.#name) {
        parts.unshift(current.#name)
      }
      current = current.#parent
    }
    return parts.join(' ') || this.#name
  }
}
