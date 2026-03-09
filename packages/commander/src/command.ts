/**
 * Command class - CLI command builder with fluent API
 *
 * Execution flow: route → control-scan → control-run(run) → preset → tokenize → builtin-resolve → resolve → parse → run
 *
 * @module @guanghechen/commander
 */

import { parse as parseEnv } from '@guanghechen/env'
import type { IReporter } from '@guanghechen/reporter'
import { Reporter } from '@guanghechen/reporter'
import {
  CommandKernel,
  type ICommandExecutionMode,
  type ICommandExecutionTermination,
  type ICommandKernelPort,
  type IExecutionOutcome,
} from './internal/command-kernel'
import { CommandContextAdapter, type IKernelPresetResult } from './internal/context-adapter'
import { CommandDiagnosticsEngine } from './internal/diagnostics-engine'
import {
  CommandHelpRenderer,
  type IHelpRendererSubcommand,
} from './internal/help/command-help-renderer'
import { CommandOptionParser } from './internal/parse/command-option-parser'
import {
  CommandPresetProfileParser,
  type IPresetFileSource,
  type IResolvedPresetProfile,
  PRESET_FILE_FLAG,
  PRESET_PROFILE_FLAG,
} from './internal/preset/preset-profile-parser'
import {
  devmodeOption,
  logColorfulOption,
  logDateOption,
  logLevelOption,
  silentOption,
} from './options'
import { getDefaultCommandRuntime } from './runtime'
import { CommanderError } from './types'
import type {
  ICommand,
  ICommandAction,
  ICommandActionParams,
  ICommandArgumentConfig,
  ICommandArgvSegment,
  ICommandBuiltinConfig,
  ICommandBuiltinOptionResolved,
  ICommandBuiltinParsedOptions,
  ICommandBuiltinResolved,
  ICommandConfig,
  ICommandContext,
  ICommandControlScanResult,
  ICommandControls,
  ICommandErrorIssue,
  ICommandExample,
  ICommandHintIssue,
  ICommandInputSources,
  ICommandIssueScope,
  ICommandOptionConfig,
  ICommandParseResult,
  ICommandParsedArgs,
  ICommandParsedOpts,
  ICommandPresetConfig,
  ICommandPresetResult,
  ICommandPresetSourceMeta,
  ICommandPresetSourceState,
  ICommandResolveResult,
  ICommandRouteResult,
  ICommandRunParams,
  ICommandRuntime,
  ICommandShiftResult,
  ICommandToken,
  ICommandTokenizeResult,
  ICompletionArgumentMeta,
  ICompletionMeta,
  ICompletionOptionMeta,
  IHelpData,
  ISubcommandEntry,
} from './types'

// ==================== Naming Convention Utilities ====================

/** Format validation regex for long options (lowercase kebab-case) */
const LONG_OPTION_REGEX = /^--[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
/** Format validation regex for negative options (lowercase kebab-case) */
const NEGATIVE_OPTION_REGEX = /^--no-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/** Convert kebab-case to camelCase. Input should be lowercase. */
function kebabToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

/** Convert camelCase to kebab-case. */
function camelToKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}

function normalizeSubcommandNameForDistance(name: string): string {
  return camelToKebabCase(name).toLowerCase()
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  if (left.length === 0) {
    return right.length
  }
  if (right.length === 0) {
    return left.length
  }

  let prev = Array.from({ length: right.length + 1 }, (_, i) => i)
  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1]
    for (let j = 0; j < right.length; j += 1) {
      const substitutionCost = left[i] === right[j] ? 0 : 1
      current[j + 1] = Math.min(current[j] + 1, prev[j + 1] + 1, prev[j] + substitutionCost)
    }
    prev = current
  }
  return prev[right.length]
}

// ==================== Tokenize ====================

/**
 * Tokenize a single long option argument.
 * Validates format and converts kebab-case to camelCase.
 * Handles --no-xxx → --xxx=false transformation.
 */
function tokenizeLongOption(segment: ICommandArgvSegment, commandPath: string): ICommandToken {
  const arg = segment.value
  const eqIdx = arg.indexOf('=')
  const namePart = eqIdx !== -1 ? arg.slice(0, eqIdx) : arg
  const valuePart = eqIdx !== -1 ? arg.slice(eqIdx) : ''

  // Reject underscore
  if (namePart.includes('_')) {
    throw new CommanderError(
      'InvalidOptionFormat',
      `invalid option "${arg}": use '-' instead of '_'`,
      commandPath,
    )
  }

  const lowerName = namePart.toLowerCase()

  // Handle --no and --no- (incomplete negative options)
  if (lowerName === '--no' || lowerName === '--no-') {
    throw new CommanderError(
      'InvalidNegativeOption',
      `invalid negative option syntax "${arg}"`,
      commandPath,
    )
  }

  // Handle negative options (--no-xxx)
  if (lowerName.startsWith('--no-')) {
    if (valuePart !== '') {
      throw new CommanderError(
        'NegativeOptionWithValue',
        `"${namePart}" does not accept a value`,
        commandPath,
      )
    }
    if (!NEGATIVE_OPTION_REGEX.test(lowerName)) {
      throw new CommanderError('InvalidOptionFormat', `invalid option format "${arg}"`, commandPath)
    }
    const camelName = kebabToCamelCase(lowerName.slice(5)) // Remove '--no-'
    return {
      original: arg,
      resolved: `--${camelName}=false`,
      name: camelName,
      type: 'long',
      source: segment.source,
      preset: segment.preset,
    }
  }

  // Handle normal long options (--xxx)
  if (!LONG_OPTION_REGEX.test(lowerName)) {
    throw new CommanderError('InvalidOptionFormat', `invalid option format "${arg}"`, commandPath)
  }
  const camelName = kebabToCamelCase(lowerName.slice(2)) // Remove '--'
  return {
    original: arg,
    resolved: `--${camelName}${valuePart}`,
    name: camelName,
    type: 'long',
    source: segment.source,
    preset: segment.preset,
  }
}

/**
 * Tokenize short option(s). Handles:
 * - Single short: -v → [{ name: 'v', type: 'short' }]
 * - Combined: -abc → [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
 */
function tokenizeShortOptions(segment: ICommandArgvSegment, commandPath: string): ICommandToken[] {
  const arg = segment.value
  // Check for unsupported -o=value syntax
  if (arg.includes('=')) {
    throw new CommanderError(
      'UnsupportedShortSyntax',
      `"${arg}" is not supported. Use "-${arg[1]} ${arg.slice(3)}" instead`,
      commandPath,
    )
  }

  const flags = arg.slice(1)
  return flags.split('').map(flag => ({
    original: `-${flag}`,
    resolved: `-${flag}`,
    name: flag,
    type: 'short' as const,
    source: segment.source,
    preset: segment.preset,
  }))
}

/**
 * Tokenize argv into ICommandToken[].
 * - Long options: validate kebab-case format, convert to camelCase
 * - --no-xxx: transform to --xxx=false
 * - Short options: expand -abc to -a -b -c
 * - Positional args: pass through unchanged
 */
function tokenize(segments: ICommandArgvSegment[], commandPath: string): ICommandTokenizeResult {
  const optionTokens: ICommandToken[] = []
  const restArgs: string[] = []
  let passThrough = false

  for (const segment of segments) {
    const arg = segment.value
    // After '--': pass through unchanged
    if (arg === '--') {
      passThrough = true
      continue
    }

    if (passThrough) {
      restArgs.push(segment.value)
      continue
    }

    // Long option
    if (arg.startsWith('--')) {
      optionTokens.push(tokenizeLongOption(segment, commandPath))
      continue
    }

    // Short option(s)
    if (arg.startsWith('-') && arg.length > 1) {
      optionTokens.push(...tokenizeShortOptions(segment, commandPath))
      continue
    }

    // Positional argument (including bare '-')
    optionTokens.push({
      original: arg,
      resolved: arg,
      name: '',
      type: 'none',
      source: segment.source,
      preset: segment.preset,
    })
  }

  return { optionTokens, restArgs }
}

function errorKindToIssueScope(kind: CommanderError['kind']): ICommandIssueScope {
  switch (kind) {
    case 'UnknownSubcommand':
      return 'command'
    case 'MissingRequiredArgument':
    case 'TooManyArguments':
    case 'UnexpectedArgument':
      return 'argument'
    case 'ActionFailed':
      return 'action'
    case 'ConfigurationError':
      return 'runtime'
    default:
      return 'option'
  }
}

// ==================== Built-in Options ====================

const BUILTIN_HELP_OPTION: ICommandOptionConfig = {
  long: 'help',
  type: 'boolean',
  args: 'none',
  desc: 'Show help information',
}

const BUILTIN_VERSION_OPTION: ICommandOptionConfig = {
  long: 'version',
  type: 'boolean',
  args: 'none',
  desc: 'Show version number',
}

const BUILTIN_COLOR_OPTION: ICommandOptionConfig = {
  long: 'color',
  type: 'boolean',
  args: 'none',
  desc: 'Enable colored help output',
  default: true,
}

interface ICommandOptionPolicy {
  readonly mergedOptions: ICommandOptionConfig[]
}

function createBuiltinOptionState(enabled: boolean): ICommandBuiltinOptionResolved {
  return {
    version: enabled,
    color: enabled,
    devmode: enabled,
    logLevel: enabled,
    silent: enabled,
    logDate: enabled,
    logColorful: enabled,
  }
}

function normalizeBuiltinConfig(
  builtin: boolean | ICommandBuiltinConfig | undefined,
): ICommandBuiltinResolved {
  const resolved: ICommandBuiltinResolved = {
    option: createBuiltinOptionState(true),
  }

  if (builtin === undefined) {
    return resolved
  }

  if (builtin === true) {
    return {
      option: createBuiltinOptionState(true),
    }
  }

  if (builtin === false) {
    return {
      option: createBuiltinOptionState(false),
    }
  }

  if (builtin.option !== undefined) {
    if (builtin.option === false) {
      resolved.option = createBuiltinOptionState(false)
    } else if (builtin.option === true) {
      resolved.option = createBuiltinOptionState(true)
    } else {
      if (builtin.option.version !== undefined) resolved.option.version = builtin.option.version
      if (builtin.option.color !== undefined) resolved.option.color = builtin.option.color
      if (builtin.option.devmode !== undefined) resolved.option.devmode = builtin.option.devmode
      if (builtin.option.logLevel !== undefined) {
        resolved.option.logLevel = builtin.option.logLevel
      }
      if (builtin.option.silent !== undefined) resolved.option.silent = builtin.option.silent
      if (builtin.option.logDate !== undefined) resolved.option.logDate = builtin.option.logDate
      if (builtin.option.logColorful !== undefined) {
        resolved.option.logColorful = builtin.option.logColorful
      }
    }
  }

  return resolved
}

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
        this.#resolvePresetFileAbsolutePath(filepath, baseDirectory),
      resolvePath: (...paths) => this.#runtime.resolve(...paths),
      readPresetFile: async (file, commandPath) => this.#readPresetFile(file, commandPath),
    })
    this.#kernel = new CommandKernel({
      port: this.#createKernelPort(),
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
    this.#validateOptionConfig(opt)
    this.#checkOptionUniqueness(opt)
    this.#options.push(opt as ICommandOptionConfig)
    return this
  }

  public argument<T>(arg: ICommandArgumentConfig<T>): this {
    this.#validateArgumentConfig(arg)
    this.#arguments.push(arg as ICommandArgumentConfig)
    return this
  }

  public action(fn: ICommandAction): this {
    this.#action = fn
    return this
  }

  public example(title: string, usage: string, desc: string): this {
    this.#examples.push(this.#normalizeExample({ title, usage, desc }))
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

    if (outcome.kind === 'parsed') {
      return
    }

    if (outcome.kind === 'terminated') {
      try {
        const { termination } = outcome
        if (termination.kind === 'version') {
          console.log(termination.version)
          return
        }

        const routeResult = this.#route(params.argv)
        const leafCommand = routeResult.chain[routeResult.chain.length - 1]
        const controlScanResult = this.#controlScan(routeResult.remaining, leafCommand)
        const helpCommand =
          this.#findCommandByPath(termination.targetCommandPath) ??
          this.#resolveHelpCommand(leafCommand, controlScanResult.helpTarget)
        const helpColor = helpCommand.#resolveHelpColorFromTailArgv(
          controlScanResult.remaining,
          params.envs,
        )
        console.log(helpCommand.#formatHelpForDisplay({ color: helpColor }))
        return
      } catch (err) {
        if (err instanceof CommanderError) {
          const enrichedError = this.#diagnostics.withErrorIssue(err, {
            stage: 'control-run',
            scope: 'control',
          })
          const normalizedError = this.#diagnostics.normalizeCommanderError(enrichedError, {
            fallbackStage: 'control-run',
            fallbackScope: 'control',
          })
          console.error(normalizedError.format())
          this.#exit(normalizedError.kind === 'ActionFailed' ? 1 : 2)
          return
        }
        throw err
      }
    }

    const exitCode = outcome.error.kind === 'ActionFailed' ? 1 : 2
    console.error(outcome.error.format())
    this.#exit(exitCode)
  }

  #exit(code: number): void {
    ;(process.exit as (code?: number) => void)(code)
  }

  public async parse(params: ICommandRunParams): Promise<ICommandParseResult> {
    const outcome = await this.#execute(params, 'parse')

    if (outcome.kind === 'parsed') {
      return outcome.parseResult
    }

    if (outcome.kind === 'terminated') {
      const commandPath = this.#getCommandPath()
      throw new CommanderError(
        'ConfigurationError',
        'internal invariant violation: parse mode must not produce termination',
        commandPath,
      )
    }

    throw outcome.error
  }

  #createKernelPort(): ICommandKernelPort<Command, ICommandOptionPolicy> {
    return {
      route: argv => this.#route(argv),
      createContext: params => this.#createContext(params),
      controlScan: (tailArgv, leafCommand) => this.#controlScan(tailArgv, leafCommand),
      controlRun: (leafCommand, controlScanResult) =>
        this.#controlRun(leafCommand, controlScanResult),
      preset: async (tailArgv, ctx) => this.#preset(tailArgv, ctx),
      tokenize: (segments, commandPath) => tokenize(segments, commandPath),
      getCommandPath: command => command.#getCommandPath(),
      buildOptionPolicyMap: chain => this.#buildOptionPolicyMap(chain),
      resolve: (chain, optionTokens, optionPolicyMap) =>
        this.#resolve(chain, optionTokens, optionPolicyMap),
      parse: (chain, resolveResult, optionPolicyMap, ctx, restArgs) =>
        this.#parse(chain, resolveResult, optionPolicyMap, ctx, restArgs),
      run: async ({ leafCommand, parseResult, presetResult, ctx }) =>
        this.#runKernelStage(leafCommand, parseResult, presetResult, ctx),
      issueScopeFromErrorKind: kind => errorKindToIssueScope(kind),
    }
  }

  async #execute(
    params: ICommandRunParams,
    mode: ICommandExecutionMode,
  ): Promise<IExecutionOutcome> {
    return this.#kernel.execute(params, mode)
  }

  async #runKernelStage(
    leafCommand: Command,
    parseResult: ICommandParseResult,
    presetResult: IKernelPresetResult,
    ctx: ICommandContext,
  ): Promise<void> {
    const actionParams = this.#contextAdapter.toActionParams(parseResult)

    if (leafCommand.#action) {
      await leafCommand.#runAction(actionParams)
      return
    }

    if (leafCommand.#subcommandsList.length > 0) {
      const helpColor = leafCommand.#resolveHelpColorFromTailArgv(presetResult.tailArgv, ctx.envs)
      console.log(leafCommand.#formatHelpForDisplay({ color: helpColor }))
      return
    }

    throw new CommanderError(
      'ConfigurationError',
      `no action defined for command "${leafCommand.#getCommandPath()}"`,
      leafCommand.#getCommandPath(),
    )
  }

  #controlRun(
    leafCommand: Command,
    controlScanResult: ICommandControlScanResult,
  ): ICommandExecutionTermination | undefined {
    if (controlScanResult.controls.help) {
      const helpCommand = this.#resolveHelpCommand(leafCommand, controlScanResult.helpTarget)
      return {
        kind: 'help',
        targetCommandPath: helpCommand.#getCommandPath(),
      }
    }

    if (controlScanResult.controls.version) {
      return {
        kind: 'version',
        targetCommandPath: leafCommand.#getCommandPath(),
        version: leafCommand.#version as string,
      }
    }

    return undefined
  }

  #findCommandByPath(commandPath: string): Command | undefined {
    if (!commandPath) {
      return this
    }

    const segments = commandPath.split(' ').filter(Boolean)
    if (segments.length === 0) {
      return this
    }

    let startIndex = 0

    if (this.#name && segments[0] === this.#name) {
      startIndex = 1
    }

    return segments.slice(startIndex).reduce<Command | undefined>((command, segment) => {
      if (command === undefined) {
        return undefined
      }
      return command.#findSubcommandEntry(segment)?.command
    }, this)
  }

  public formatHelp(): string {
    return this.#helpRenderer.formatHelp(this.#buildHelpData())
  }

  #formatHelpForDisplay(params: { color?: boolean } = {}): string {
    const { color = true } = params
    return this.#helpRenderer.formatHelpForDisplay(this.#buildHelpData(), color)
  }

  #buildHelpData(): IHelpData {
    const subcommands: IHelpRendererSubcommand[] = this.#subcommandsList.map(entry => ({
      name: entry.name,
      aliases: entry.aliases,
      desc: entry.command.#desc,
    }))

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
    const optionMap = new Map<string, ICommandOptionConfig>()
    for (const option of this.#resolveOptionPolicy().mergedOptions) {
      optionMap.set(option.long, option)
    }
    optionMap.set('help', BUILTIN_HELP_OPTION)
    if (this.#supportsBuiltinVersion()) {
      optionMap.set('version', BUILTIN_VERSION_OPTION)
    }

    const allOptions = Array.from(optionMap.values())
    const options: ICompletionOptionMeta[] = []
    const argumentsMeta: ICompletionArgumentMeta[] = []

    for (const opt of allOptions) {
      options.push({
        long: opt.long,
        short: opt.short,
        desc: opt.desc,
        type: opt.type,
        args: opt.args,
        choices: opt.choices?.map(choice => String(choice)),
      })
    }

    for (const arg of this.#arguments) {
      argumentsMeta.push({
        name: arg.name,
        kind: arg.kind,
        type: arg.type,
        choices: arg.type === 'choice' ? arg.choices?.map(choice => String(choice)) : undefined,
      })
    }

    return {
      name: this.#name,
      desc: this.#desc,
      aliases: [],
      options,
      arguments: argumentsMeta,
      subcommands: this.#subcommandsList.map(entry => {
        const subMeta = entry.command.getCompletionMeta()
        return {
          ...subMeta,
          name: entry.name,
          aliases: entry.aliases,
        }
      }),
    }
  }

  // ==================== Stage 0: ROUTE ====================

  #findSubcommandEntry(token: string): ISubcommandEntry<Command> | undefined {
    return this.#subcommandsList.find(e => e.name === token || e.aliases.includes(token))
  }

  /**
   * Route and return the full command chain (root → leaf).
   */
  #route(argv: string[]): ICommandRouteResult<Command> {
    const chain: Command[] = [this]
    const cmds: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: Command = this
    let idx = 0

    while (idx < argv.length) {
      const token = argv[idx]

      // Stop routing on option-like token
      if (token.startsWith('-')) break

      // Try to match subcommand
      const entry = current.#findSubcommandEntry(token)
      if (!entry) break

      current = entry.command
      cmds.push(token)
      chain.push(current)
      idx += 1
    }

    return { chain, remaining: argv.slice(idx), cmds }
  }

  #controlScan(tailArgv: string[], leafCommand: Command): ICommandControlScanResult {
    const controls: ICommandControls = { help: false, version: false }
    const separatorIndex = tailArgv.indexOf('--')
    const beforeSeparator = separatorIndex === -1 ? tailArgv : tailArgv.slice(0, separatorIndex)
    const afterSeparator = separatorIndex === -1 ? [] : tailArgv.slice(separatorIndex + 1)

    let helpTarget: string | undefined
    let scanStartIndex = 0

    if (beforeSeparator[0] === 'help') {
      controls.help = true
      scanStartIndex = 1
      const candidate = beforeSeparator[1]
      if (candidate !== undefined && !candidate.startsWith('-')) {
        helpTarget = candidate
        scanStartIndex = 2
      }
    }

    const remainingBeforeSeparator: string[] = []
    for (let i = scanStartIndex; i < beforeSeparator.length; i += 1) {
      const token = beforeSeparator[i]

      if (token === '--help') {
        controls.help = true
        continue
      }

      if (token === '--version' && leafCommand.#supportsBuiltinVersion()) {
        controls.version = true
        continue
      }

      remainingBeforeSeparator.push(token)
    }

    const remaining =
      separatorIndex === -1
        ? remainingBeforeSeparator
        : [...remainingBeforeSeparator, '--', ...afterSeparator]

    return {
      controls,
      remaining,
      helpTarget,
    }
  }

  #createContext(params: {
    chain: Command[]
    cmds: string[]
    envs: Record<string, string | undefined>
    reporter?: IReporter
  }): ICommandContext {
    const { chain, cmds, envs, reporter } = params
    const leafCommand = chain[chain.length - 1]
    const envSnapshot = { ...envs }

    return {
      cmd: leafCommand,
      chain,
      envs: envSnapshot,
      controls: { help: false, version: false },
      sources: {
        preset: {
          state: 'none',
          argv: [],
          envs: {},
        },
        user: {
          cmds: [...cmds],
          argv: [],
          envs: envSnapshot,
        },
      },
      reporter: reporter ?? this.#reporter ?? new Reporter(),
    }
  }

  #resolveHelpCommand(leafCommand: Command, helpTarget: string | undefined): Command {
    if (helpTarget === undefined) {
      return leafCommand
    }

    const target = leafCommand.#findSubcommandEntry(helpTarget)
    if (target === undefined) {
      return leafCommand
    }

    return target.command
  }

  async #preset(
    controlTailArgv: string[],
    ctx: ICommandContext,
  ): Promise<ICommandPresetResult & { sources: ICommandInputSources }> {
    const commandPath = (ctx.chain[ctx.chain.length - 1] as Command).#getCommandPath()
    const separatorIndex = controlTailArgv.indexOf('--')
    const beforeSeparator =
      separatorIndex === -1 ? controlTailArgv : controlTailArgv.slice(0, separatorIndex)
    const afterSeparator = separatorIndex === -1 ? [] : controlTailArgv.slice(separatorIndex + 1)

    const profileScanResult = this.#scanPresetProfileDirectives(beforeSeparator, commandPath)
    const cleanArgv =
      separatorIndex === -1
        ? profileScanResult.cleanArgv
        : [...profileScanResult.cleanArgv, '--', ...afterSeparator]
    const commandChain = ctx.chain as Command[]
    const commandPresetFile = this.#resolveCommandPresetFileFromChain(commandChain)
    const effectivePresetFile = profileScanResult.presetFile ?? commandPresetFile

    const commandPresetProfile = this.#resolveCommandPresetProfileFromChain(commandChain)
    const useCommandPresetProfile =
      profileScanResult.presetProfile === undefined && commandPresetProfile !== undefined
    if (useCommandPresetProfile) {
      this.#presetProfileParser.assertPresetProfileSelectorValue(
        commandPresetProfile,
        'command.preset.profile',
        commandPath,
      )
    }
    const effectivePresetProfile = profileScanResult.presetProfile ?? commandPresetProfile
    const effectivePresetProfileSourceName =
      profileScanResult.presetProfile !== undefined
        ? PRESET_PROFILE_FLAG
        : commandPresetProfile !== undefined
          ? 'command.preset.profile'
          : undefined
    if (effectivePresetFile === undefined && useCommandPresetProfile) {
      throw new CommanderError(
        'ConfigurationError',
        'cannot use "command.preset.profile" without "command.preset.file" or "--preset-file"',
        commandPath,
      )
    }

    const resolvedProfile = await this.#resolvePresetProfile({
      presetFile: effectivePresetFile,
      presetProfile: effectivePresetProfile,
      presetProfileSourceName: effectivePresetProfileSourceName,
      commandPath,
    })

    const userSources: ICommandInputSources['user'] = {
      cmds: [...ctx.sources.user.cmds],
      argv: [...cleanArgv],
      envs: { ...ctx.sources.user.envs },
    }

    const presetArgv: string[] = []
    const presetMeta = resolvedProfile?.issueMeta
    const presetSourceMeta: ICommandPresetSourceMeta | undefined =
      presetMeta === undefined
        ? undefined
        : {
            applied: true,
            file: presetMeta.file,
            profile: presetMeta.profile,
            variant: presetMeta.variant,
          }
    const presetState: ICommandPresetSourceState =
      presetSourceMeta === undefined ? 'none' : 'applied'
    if (resolvedProfile !== undefined && resolvedProfile.optsArgv.length > 0) {
      this.#presetProfileParser.validatePresetOptionTokens(
        resolvedProfile.optsArgv,
        resolvedProfile.optsSourceLabel,
        commandPath,
      )
      presetArgv.push(...resolvedProfile.optsArgv)
    }

    const presetEnvs: Record<string, string> = {}
    if (resolvedProfile !== undefined) {
      if (resolvedProfile.profileEnvFileSource !== undefined) {
        const content = await this.#readPresetFile(
          resolvedProfile.profileEnvFileSource,
          commandPath,
        )
        if (content !== undefined) {
          const parsed = this.#parsePresetEnvsContent(
            content,
            resolvedProfile.profileEnvFileSource,
            commandPath,
          )
          Object.assign(presetEnvs, parsed)
        }
      }
      Object.assign(presetEnvs, resolvedProfile.profileInlineEnvs)

      if (resolvedProfile.variantEnvFileSource !== undefined) {
        const content = await this.#readPresetFile(
          resolvedProfile.variantEnvFileSource,
          commandPath,
        )
        if (content !== undefined) {
          const parsed = this.#parsePresetEnvsContent(
            content,
            resolvedProfile.variantEnvFileSource,
            commandPath,
          )
          Object.assign(presetEnvs, parsed)
        }
      }
      Object.assign(presetEnvs, resolvedProfile.variantInlineEnvs)
    }

    const sources: ICommandInputSources = {
      user: userSources,
      preset: {
        state: presetState,
        argv: presetArgv,
        envs: presetEnvs,
        meta: presetSourceMeta === undefined ? undefined : { ...presetSourceMeta },
      },
    }

    const envs = { ...sources.user.envs, ...sources.preset.envs }
    const tailArgv = [...sources.preset.argv, ...sources.user.argv]
    const segments: ICommandArgvSegment[] = [
      ...sources.preset.argv.map(value => ({
        value,
        source: 'preset' as const,
        preset:
          sources.preset.meta === undefined
            ? undefined
            : {
                file: sources.preset.meta.file,
                profile: sources.preset.meta.profile,
                variant: sources.preset.meta.variant,
              },
      })),
      ...sources.user.argv.map(value => ({ value, source: 'user' as const })),
    ]

    return { tailArgv, envs, segments, sources }
  }

  #resolveCommandPresetFileFromChain(chain: Command[]): string | undefined {
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const preset = chain[index].#presetConfig
      if (preset?.file !== undefined) {
        return preset.file
      }
    }

    return undefined
  }

  #resolveCommandPresetProfileFromChain(chain: Command[]): string | undefined {
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const preset = chain[index].#presetConfig
      if (preset?.profile !== undefined) {
        return preset.profile
      }
    }

    return undefined
  }

  #resolvePresetFileAbsolutePath(filepath: string, baseDirectory?: string): string {
    if (this.#runtime.isAbsolute(filepath)) {
      return filepath
    }
    return this.#runtime.resolve(baseDirectory ?? this.#runtime.cwd(), filepath)
  }

  async #resolvePresetProfile(params: {
    presetFile: string | undefined
    presetProfile: string | undefined
    presetProfileSourceName: string | undefined
    commandPath: string
  }): Promise<IResolvedPresetProfile | undefined> {
    return this.#presetProfileParser.resolvePresetProfile(params)
  }

  #scanPresetProfileDirectives(
    argv: string[],
    commandPath: string,
  ): { cleanArgv: string[]; presetFile?: string; presetProfile?: string } {
    const cleanArgv: string[] = []
    let presetFile: string | undefined
    let presetProfile: string | undefined

    const assignDirective = (
      flag: typeof PRESET_FILE_FLAG | typeof PRESET_PROFILE_FLAG,
      value: string,
    ): void => {
      if (flag === PRESET_FILE_FLAG) {
        presetFile = value
      } else {
        this.#presetProfileParser.assertPresetProfileSelectorValue(
          value,
          PRESET_PROFILE_FLAG,
          commandPath,
        )
        presetProfile = value
      }
    }

    let index = 0
    while (index < argv.length) {
      const token = argv[index]

      if (token === PRESET_FILE_FLAG || token === PRESET_PROFILE_FLAG) {
        const value = argv[index + 1]
        if (value === undefined || value.length === 0) {
          throw new CommanderError(
            'ConfigurationError',
            `missing value for "${token}"`,
            commandPath,
          )
        }
        assignDirective(token, value)
        index += 2
        continue
      }

      if (token.startsWith(`${PRESET_FILE_FLAG}=`)) {
        const value = token.slice(PRESET_FILE_FLAG.length + 1)
        if (value.length === 0) {
          throw new CommanderError(
            'ConfigurationError',
            `missing value for "${PRESET_FILE_FLAG}"`,
            commandPath,
          )
        }
        assignDirective(PRESET_FILE_FLAG, value)
        index += 1
        continue
      }

      if (token.startsWith(`${PRESET_PROFILE_FLAG}=`)) {
        const value = token.slice(PRESET_PROFILE_FLAG.length + 1)
        if (value.length === 0) {
          throw new CommanderError(
            'ConfigurationError',
            `missing value for "${PRESET_PROFILE_FLAG}"`,
            commandPath,
          )
        }
        assignDirective(PRESET_PROFILE_FLAG, value)
        index += 1
        continue
      }

      cleanArgv.push(token)
      index += 1
    }

    return { cleanArgv, presetFile, presetProfile }
  }

  async #readPresetFile(file: IPresetFileSource, commandPath: string): Promise<string | undefined> {
    try {
      const stats = await this.#runtime.stat(file.absolutePath)
      if (stats.isDirectory()) {
        throw new Error('target is a directory')
      }
      return await this.#runtime.readFile(file.absolutePath)
    } catch (error) {
      const ioError = error as { code?: string; message?: string }
      if (!file.explicit && ioError.code === 'ENOENT') {
        return undefined
      }

      throw new CommanderError(
        'ConfigurationError',
        `failed to read preset file "${file.displayPath}": ${(error as Error).message}`,
        commandPath,
      )
    }
  }

  #parsePresetEnvsContent(
    content: string,
    file: IPresetFileSource,
    commandPath: string,
  ): Record<string, string> {
    try {
      return parseEnv(content)
    } catch (error) {
      throw new CommanderError(
        'ConfigurationError',
        `failed to parse preset env file "${file.displayPath}": ${(error as Error).message}`,
        commandPath,
      )
    }
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
    const consumedTokens = new Map<Command, ICommandToken[]>()
    let remaining = [...tokens]

    // Build shadowed set: options defined by child commands
    const shadowed = new Set<string>()

    // Process from leaf to root
    for (let i = chain.length - 1; i >= 0; i--) {
      const cmd = chain[i]
      const policy = this.#mustGetOptionPolicy(optionPolicyMap, cmd)

      const result = cmd.#shift(remaining, shadowed, policy.mergedOptions)
      consumedTokens.set(cmd, result.consumed)
      remaining = result.remaining

      // Add this command's options to shadowed set for parent commands
      for (const opt of cmd.#options) {
        shadowed.add(opt.long)
      }
    }

    // Remaining tokens: unknown options are errors, non-options are argTokens
    const argTokens: ICommandToken[] = []
    for (const token of remaining) {
      if (token.type !== 'none') {
        const leafCommand = chain[chain.length - 1]
        const error = new CommanderError(
          'UnknownOption',
          `unknown option "${token.original}" for command "${leafCommand.#getCommandPath()}"`,
          leafCommand.#getCommandPath(),
        )
        throw this.#diagnostics.withErrorIssue(error, {
          stage: 'resolve',
          scope: 'option',
          token,
        })
      }
      argTokens.push(token)
    }

    return { consumedTokens, argTokens }
  }

  /**
   * Shift: consume tokens recognized by this command.
   */
  #shift(
    tokens: ICommandToken[],
    shadowed: Set<string>,
    allOptions: ICommandOptionConfig[],
  ): ICommandShiftResult {
    // Filter out shadowed options
    const effectiveOptions = allOptions.filter(o => !shadowed.has(o.long))

    // Build lookup maps
    const optionByLong = new Map<string, ICommandOptionConfig>()
    const optionByShort = new Map<string, ICommandOptionConfig>()
    for (const opt of effectiveOptions) {
      optionByLong.set(opt.long, opt)
      if (opt.short) {
        optionByShort.set(opt.short, opt)
      }
    }

    const consumed: ICommandToken[] = []
    const remaining: ICommandToken[] = []
    let i = 0

    while (i < tokens.length) {
      const token = tokens[i]

      // Long option
      if (token.type === 'long') {
        const opt = optionByLong.get(token.name)
        if (opt) {
          consumed.push(token)
          // Consume additional tokens for required/optional/variadic
          if (opt.args === 'required') {
            // Check for inline value (--foo=bar)
            if (!token.resolved.includes('=') && i + 1 < tokens.length) {
              i += 1
              consumed.push(tokens[i])
            }
          } else if (opt.args === 'optional') {
            // Prefer one following positional token when value is not inline.
            if (
              !token.resolved.includes('=') &&
              i + 1 < tokens.length &&
              tokens[i + 1].type === 'none'
            ) {
              i += 1
              consumed.push(tokens[i])
            }
          } else if (opt.args === 'variadic') {
            // Check for inline value
            if (!token.resolved.includes('=')) {
              // Greedy consume until next option
              while (i + 1 < tokens.length && tokens[i + 1].type === 'none') {
                i += 1
                consumed.push(tokens[i])
              }
            }
          }
          i += 1
          continue
        }
        // Unknown long option - pass to parent
        remaining.push(token)
        i += 1
        continue
      }

      // Short option
      if (token.type === 'short') {
        const opt = optionByShort.get(token.name)
        if (opt) {
          consumed.push(token)
          // Consume additional tokens for required/optional/variadic
          if (opt.args === 'required') {
            if (i + 1 < tokens.length && tokens[i + 1].type === 'none') {
              i += 1
              consumed.push(tokens[i])
            }
          } else if (opt.args === 'optional') {
            if (i + 1 < tokens.length && tokens[i + 1].type === 'none') {
              i += 1
              consumed.push(tokens[i])
            }
          } else if (opt.args === 'variadic') {
            while (i + 1 < tokens.length && tokens[i + 1].type === 'none') {
              i += 1
              consumed.push(tokens[i])
            }
          }
          i += 1
          continue
        }
        // Unknown short option - pass to parent
        remaining.push(token)
        i += 1
        continue
      }

      // Non-option token
      remaining.push(token)
      i += 1
    }

    return { consumed, remaining }
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
    const { consumedTokens, argTokens } = resolveResult
    const leafCommand = chain[chain.length - 1]

    // Validate merged short options
    this.#validateMergedShortOptions(chain, optionPolicyMap)

    // Parse options for each command in chain (top-down)
    const optsMap = new Map<Command, ICommandParsedOpts>()
    const builtinMap = new Map<Command, ICommandBuiltinParsedOptions>()

    for (const cmd of chain) {
      const policy = this.#mustGetOptionPolicy(optionPolicyMap, cmd)
      const tokens = consumedTokens.get(cmd) ?? []
      const parseOptionsResult = cmd.#optionParser.parseOptions({
        tokens,
        allOptions: policy.mergedOptions,
        envs: ctx.envs,
        commandPath: cmd.#getCommandPath(),
      })
      const opts = parseOptionsResult.opts
      cmd.#optionParser.applyBuiltinDevmodeLogLevel({
        opts,
        explicitOptionLongs: parseOptionsResult.explicitOptionLongs,
        builtinOption: cmd.#builtin.option,
        hasUserOption: long => cmd.#hasUserOption(long),
      })
      optsMap.set(cmd, opts)
      builtinMap.set(
        cmd,
        cmd.#optionParser.resolveBuiltinParsedOptions({
          opts,
          builtinOption: cmd.#builtin.option,
          hasUserOption: long => cmd.#hasUserOption(long),
        }),
      )

      // Call apply callbacks
      for (const opt of policy.mergedOptions) {
        if (opt.apply && opts[opt.long] !== undefined) {
          opt.apply(opts[opt.long], ctx)
        }
      }
    }

    const leafLocalOpts: ICommandParsedOpts = {}
    const leafParsedOpts = optsMap.get(leafCommand) ?? {}
    for (const opt of leafCommand.#options) {
      if (Object.prototype.hasOwnProperty.call(leafParsedOpts, opt.long)) {
        leafLocalOpts[opt.long] = leafParsedOpts[opt.long]
      }
    }

    leafCommand.#assertUnknownSubcommand(ctx.sources.user.argv)

    // Parse arguments
    const rawArgStrings = [...argTokens.map(t => t.original), ...restArgs]
    const { args, rawArgs } = leafCommand.#parseArguments(rawArgStrings)

    const parseCtx: ICommandContext = {
      ...ctx,
      sources: this.#freezeInputSources(ctx.sources),
    }

    return {
      ctx: parseCtx,
      builtin: builtinMap.get(leafCommand) ?? { devmode: false },
      opts: leafLocalOpts,
      args,
      rawArgs,
    }
  }

  /**
   * Parse raw positional arguments into typed values.
   */
  #parseArguments(rawArgs: string[]): { args: ICommandParsedArgs; rawArgs: string[] } {
    const argumentDefs = this.#arguments
    const args: ICommandParsedArgs = {}

    if (argumentDefs.length === 0 && rawArgs.length > 0) {
      throw new CommanderError(
        'UnexpectedArgument',
        `unexpected argument "${rawArgs[0]}"`,
        this.#getCommandPath(),
      )
    }

    // Required count check
    const missing: string[] = []
    let remaining = rawArgs.length
    for (const def of argumentDefs) {
      if (def.kind === 'required') {
        if (remaining === 0) {
          missing.push(def.name)
        } else {
          remaining -= 1
        }
        continue
      }

      if (def.kind === 'optional') {
        if (remaining > 0) {
          remaining -= 1
        }
        continue
      }

      if (def.kind === 'some') {
        if (remaining === 0) {
          missing.push(def.name)
        }
        remaining = 0
        continue
      }

      remaining = 0
    }

    if (missing.length > 0) {
      throw new CommanderError(
        'MissingRequiredArgument',
        `missing required argument(s): ${missing.join(', ')}`,
        this.#getCommandPath(),
      )
    }

    let index = 0

    // Consume rawArgs in declaration order
    for (const def of argumentDefs) {
      if (def.kind === 'variadic') {
        const rest = rawArgs.slice(index)
        args[def.name] = rest.map(raw => this.#convertArgument(def, raw))
        index = rawArgs.length
        break
      }

      if (def.kind === 'some') {
        const rest = rawArgs.slice(index)
        args[def.name] = rest.map(raw => this.#convertArgument(def, raw))
        index = rawArgs.length
        break
      }

      if (def.kind === 'optional') {
        const raw = rawArgs[index]
        if (raw === undefined) {
          args[def.name] = def.default ?? undefined
          continue
        }

        args[def.name] = this.#convertArgument(def, raw)
        index += 1
        continue
      }

      const raw = rawArgs[index] as string
      args[def.name] = this.#convertArgument(def, raw)
      index += 1
    }

    // Too many arguments check (non-variadic)
    const hasRestArgument = argumentDefs.some(a => a.kind === 'variadic' || a.kind === 'some')
    if (!hasRestArgument && index < rawArgs.length) {
      throw new CommanderError(
        'TooManyArguments',
        `too many arguments: expected ${argumentDefs.length}, got ${rawArgs.length}`,
        this.#getCommandPath(),
      )
    }

    return { args, rawArgs }
  }

  /**
   * Convert a single raw argument value.
   */
  #convertArgument(def: ICommandArgumentConfig, raw: string): unknown {
    let value: unknown

    if (def.coerce) {
      try {
        value = def.coerce(raw)
      } catch {
        throw new CommanderError(
          'InvalidType',
          `invalid value "${raw}" for argument "${def.name}"`,
          this.#getCommandPath(),
        )
      }
    } else {
      value = raw
    }

    if (typeof value !== 'string') {
      throw new CommanderError(
        'InvalidType',
        `invalid value for argument "${def.name}": expected ${def.type}`,
        this.#getCommandPath(),
      )
    }

    if (def.type === 'choice') {
      const choices = def.choices ?? []
      if (!choices.includes(value)) {
        throw new CommanderError(
          'InvalidChoice',
          `invalid value "${value}" for argument "${def.name}". Allowed: ${choices
            .map(choice => JSON.stringify(choice))
            .join(', ')}`,
          this.#getCommandPath(),
        )
      }
    }

    return value
  }

  #assertUnknownSubcommand(userTailArgv: string[]): void {
    if (this.#subcommandsList.length === 0) {
      return
    }

    const token = userTailArgv[0]
    if (token === undefined || token.startsWith('-') || token === 'help') {
      return
    }

    if (this.#findSubcommandEntry(token) !== undefined) {
      return
    }

    const commandPath = this.#getCommandPath()
    let error = new CommanderError(
      'UnknownSubcommand',
      `unknown subcommand "${token}" for command "${commandPath}"`,
      commandPath,
    )

    error = this.#diagnostics.withErrorIssue(error, {
      stage: 'parse',
      scope: 'command',
      source: { primary: 'user' },
    })

    if (this.#arguments.length === 0) {
      const hint: ICommandHintIssue = {
        kind: 'hint',
        stage: 'parse',
        scope: 'command',
        reason: {
          code: 'command_does_not_accept_positional_arguments',
          message: `command "${commandPath}" does not accept positional arguments`,
        },
      }
      error = error.withIssue(hint)
    }

    const candidate = this.#resolveDidYouMeanSubcommandName(token)
    if (candidate !== undefined) {
      const hint: ICommandHintIssue = {
        kind: 'hint',
        stage: 'parse',
        scope: 'command',
        reason: {
          code: 'did_you_mean_subcommand',
          message: `did you mean "${candidate}"?`,
          details: { candidate },
        },
      }
      error = error.withIssue(hint)
    }

    throw error
  }

  #resolveDidYouMeanSubcommandName(token: string): string | undefined {
    const source = normalizeSubcommandNameForDistance(token)
    let minDistance = Number.POSITIVE_INFINITY
    let bestName: string | undefined
    let isUniqueBest = false

    for (const entry of this.#subcommandsList) {
      const target = normalizeSubcommandNameForDistance(entry.name)
      const distance = levenshteinDistance(source, target)
      if (distance < minDistance) {
        minDistance = distance
        bestName = entry.name
        isUniqueBest = true
      } else if (distance === minDistance) {
        isUniqueBest = false
      }
    }

    if (minDistance <= 2 && isUniqueBest) {
      return bestName
    }
    return undefined
  }

  // ==================== Private: Option Merging ====================

  #hasUserOption(long: string): boolean {
    return this.#options.some(option => option.long === long)
  }

  #supportsBuiltinVersion(): boolean {
    return this.#version !== undefined && this.#builtin.option.version
  }

  #resolveOptionPolicy(): ICommandOptionPolicy {
    const optionMap = new Map<string, ICommandOptionConfig>()

    const hasUserColor = this.#hasUserOption('color')
    const hasUserLogLevel = this.#hasUserOption('logLevel')
    const hasUserSilent = this.#hasUserOption('silent')
    const hasUserLogDate = this.#hasUserOption('logDate')
    const hasUserLogColorful = this.#hasUserOption('logColorful')

    if (this.#builtin.option.color && !hasUserColor) {
      optionMap.set('color', BUILTIN_COLOR_OPTION)
    }
    if (this.#builtin.option.devmode) {
      optionMap.set('devmode', devmodeOption as ICommandOptionConfig)
    }
    if (this.#builtin.option.logLevel && !hasUserLogLevel) {
      optionMap.set('logLevel', logLevelOption as ICommandOptionConfig)
    }
    // Keep silent after logLevel so it can override level when both are set.
    if (this.#builtin.option.silent && !hasUserSilent) {
      optionMap.set('silent', silentOption as ICommandOptionConfig)
    }
    if (this.#builtin.option.logDate && !hasUserLogDate) {
      optionMap.set('logDate', logDateOption as ICommandOptionConfig)
    }
    if (this.#builtin.option.logColorful && !hasUserLogColorful) {
      optionMap.set('logColorful', logColorfulOption as ICommandOptionConfig)
    }

    // Add this command's options
    for (const opt of this.#options) {
      optionMap.set(opt.long, opt)
    }

    return {
      mergedOptions: Array.from(optionMap.values()),
    }
  }

  #buildOptionPolicyMap(chain: Command[]): Map<Command, ICommandOptionPolicy> {
    const optionPolicyMap = new Map<Command, ICommandOptionPolicy>()

    for (const cmd of chain) {
      optionPolicyMap.set(cmd, cmd.#resolveOptionPolicy())
    }

    return optionPolicyMap
  }

  #mustGetOptionPolicy(
    optionPolicyMap: Map<Command, ICommandOptionPolicy>,
    cmd: Command,
  ): ICommandOptionPolicy {
    const policy = optionPolicyMap.get(cmd) ?? cmd.#resolveOptionPolicy()
    optionPolicyMap.set(cmd, policy)
    return policy
  }

  #validateMergedShortOptions(
    chain: Command[],
    optionPolicyMap: Map<Command, ICommandOptionPolicy>,
  ): void {
    const mergedByLong = new Map<string, ICommandOptionConfig>()

    for (const cmd of chain) {
      const policy = this.#mustGetOptionPolicy(optionPolicyMap, cmd)
      for (const opt of policy.mergedOptions) {
        mergedByLong.set(opt.long, opt)
      }
    }

    const shortMap = new Map<string, string>()
    for (const opt of mergedByLong.values()) {
      if (!opt.short) continue
      const existingLong = shortMap.get(opt.short)
      if (existingLong && existingLong !== opt.long) {
        throw new CommanderError(
          'OptionConflict',
          `short option "-${opt.short}" conflicts with "--${existingLong}"`,
          this.#getCommandPath(),
        )
      }
      shortMap.set(opt.short, opt.long)
    }
  }

  // ==================== Private: Validation ====================

  #validateOptionConfig<T>(opt: ICommandOptionConfig<T>): void {
    if (
      opt.long === 'help' ||
      opt.long === 'version' ||
      opt.long === 'devmode' ||
      opt.long === 'logLevel'
    ) {
      throw new CommanderError(
        'ConfigurationError',
        `option long name "${opt.long}" is reserved`,
        this.#getCommandPath(),
      )
    }

    // Validate type + args combination
    if (opt.type === 'boolean' && opt.args !== 'none') {
      throw new CommanderError(
        'ConfigurationError',
        `boolean option "--${opt.long}" must have args: 'none'`,
        this.#getCommandPath(),
      )
    }
    if ((opt.type === 'string' || opt.type === 'number') && opt.args === 'none') {
      throw new CommanderError(
        'ConfigurationError',
        `${opt.type} option "--${opt.long}" must have args: 'required', 'optional', or 'variadic'`,
        this.#getCommandPath(),
      )
    }
    if (opt.type === 'number' && opt.args === 'optional') {
      throw new CommanderError(
        'ConfigurationError',
        `number option "--${opt.long}" does not support args: 'optional'`,
        this.#getCommandPath(),
      )
    }

    // No no- prefix allowed
    if (opt.long.startsWith('no')) {
      throw new CommanderError(
        'ConfigurationError',
        `option long name cannot start with "no": "${opt.long}"`,
        this.#getCommandPath(),
      )
    }

    // Validate camelCase
    if (!/^[a-z][a-zA-Z0-9]*$/.test(opt.long)) {
      throw new CommanderError(
        'ConfigurationError',
        `option long name must be camelCase: "${opt.long}"`,
        this.#getCommandPath(),
      )
    }

    if (opt.short !== undefined && opt.short.length !== 1) {
      throw new CommanderError(
        'ConfigurationError',
        `option short name must be a single character: "${opt.short}"`,
        this.#getCommandPath(),
      )
    }

    // required + default conflict
    if (opt.required && opt.default !== undefined) {
      throw new CommanderError(
        'ConfigurationError',
        `option "--${opt.long}" cannot be both required and have a default value`,
        this.#getCommandPath(),
      )
    }

    // boolean + required conflict
    if (opt.type === 'boolean' && opt.required) {
      throw new CommanderError(
        'ConfigurationError',
        `boolean option "--${opt.long}" cannot be required`,
        this.#getCommandPath(),
      )
    }

    // required options must always consume exactly one value
    if (opt.required && opt.args !== 'required') {
      throw new CommanderError(
        'ConfigurationError',
        `required option "--${opt.long}" must use args: 'required'`,
        this.#getCommandPath(),
      )
    }
  }

  #checkOptionUniqueness<T>(opt: ICommandOptionConfig<T>): void {
    if (this.#options.some(o => o.long === opt.long)) {
      throw new CommanderError(
        'OptionConflict',
        `option "--${opt.long}" is already defined`,
        this.#getCommandPath(),
      )
    }

    if (opt.short && this.#options.some(o => o.short === opt.short)) {
      throw new CommanderError(
        'OptionConflict',
        `short option "-${opt.short}" is already defined`,
        this.#getCommandPath(),
      )
    }
  }

  #validateArgumentConfig(arg: ICommandArgumentConfig): void {
    if (
      arg.kind !== 'required' &&
      arg.kind !== 'optional' &&
      arg.kind !== 'variadic' &&
      arg.kind !== 'some'
    ) {
      throw new CommanderError(
        'ConfigurationError',
        `argument "${arg.name}" must specify a valid kind`,
        this.#getCommandPath(),
      )
    }

    if (arg.type !== 'string' && arg.type !== 'choice') {
      throw new CommanderError(
        'ConfigurationError',
        `argument "${arg.name}" must specify a valid type`,
        this.#getCommandPath(),
      )
    }

    if (arg.default !== undefined && arg.kind !== 'optional') {
      throw new CommanderError(
        'ConfigurationError',
        `only optional argument "${arg.name}" can have a default value`,
        this.#getCommandPath(),
      )
    }

    if (arg.type === 'string' && arg.choices !== undefined) {
      throw new CommanderError(
        'ConfigurationError',
        `argument "${arg.name}" of type "string" cannot declare choices`,
        this.#getCommandPath(),
      )
    }

    if (arg.type === 'choice') {
      if (!Array.isArray(arg.choices) || arg.choices.length === 0) {
        throw new CommanderError(
          'ConfigurationError',
          `argument "${arg.name}" of type "choice" must declare a non-empty choices array`,
          this.#getCommandPath(),
        )
      }

      if (arg.choices.some(choice => typeof choice !== 'string')) {
        throw new CommanderError(
          'ConfigurationError',
          `argument "${arg.name}" choices must be string[]`,
          this.#getCommandPath(),
        )
      }
    }

    if (arg.default !== undefined) {
      this.#validateArgumentDefaultValue(arg)
    }

    if (arg.kind === 'variadic' || arg.kind === 'some') {
      if (this.#arguments.some(a => a.kind === 'variadic' || a.kind === 'some')) {
        throw new CommanderError(
          'ConfigurationError',
          'only one variadic/some argument is allowed',
          this.#getCommandPath(),
        )
      }
    }

    if (this.#arguments.length > 0) {
      const last = this.#arguments[this.#arguments.length - 1]
      if (last.kind === 'variadic' || last.kind === 'some') {
        throw new CommanderError(
          'ConfigurationError',
          'variadic/some argument must be the last argument',
          this.#getCommandPath(),
        )
      }
    }

    if (arg.kind === 'required') {
      const hasOptional = this.#arguments.some(
        a => a.kind === 'optional' || a.kind === 'variadic' || a.kind === 'some',
      )
      if (hasOptional) {
        throw new CommanderError(
          'ConfigurationError',
          `required argument "${arg.name}" cannot come after optional/variadic/some arguments`,
          this.#getCommandPath(),
        )
      }
    }
  }

  #validateArgumentDefaultValue(arg: ICommandArgumentConfig): void {
    if (typeof arg.default !== 'string') {
      throw new CommanderError(
        'ConfigurationError',
        `default value for argument "${arg.name}" must match type "${arg.type}"`,
        this.#getCommandPath(),
      )
    }

    if (arg.type === 'choice') {
      const choices = arg.choices ?? []
      if (!choices.includes(arg.default)) {
        throw new CommanderError(
          'ConfigurationError',
          `default value for argument "${arg.name}" must be one of declared choices`,
          this.#getCommandPath(),
        )
      }
    }
  }

  #normalizeExample(example: ICommandExample): ICommandExample {
    const title = example.title.trim()
    const usage = example.usage.trim()
    const desc = example.desc.trim()

    if (!title) {
      throw new CommanderError(
        'ConfigurationError',
        'example title cannot be empty',
        this.#getCommandPath(),
      )
    }
    if (!usage) {
      throw new CommanderError(
        'ConfigurationError',
        'example usage cannot be empty',
        this.#getCommandPath(),
      )
    }
    if (!desc) {
      throw new CommanderError(
        'ConfigurationError',
        'example description cannot be empty',
        this.#getCommandPath(),
      )
    }

    return { title, usage, desc }
  }

  // ==================== Private: Utilities ====================

  async #runAction(params: ICommandActionParams): Promise<void> {
    if (!this.#action) return
    try {
      await this.#action(params)
    } catch (err) {
      if (err instanceof CommanderError) {
        throw err
      }

      const issue: ICommandErrorIssue = {
        kind: 'error',
        stage: 'run',
        scope: 'action',
        reason: {
          code: 'action_failed',
          message: err instanceof Error ? err.message : 'action failed',
          details:
            err instanceof Error
              ? {
                  errorName: err.name,
                  errorMessage: err.message,
                }
              : {
                  errorValue: String(err),
                },
        },
      }

      throw new CommanderError(
        'ActionFailed',
        err instanceof Error ? err.message : 'action failed',
        this.#getCommandPath(),
      ).withIssue(issue)
    }
  }

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
    return Object.freeze({
      preset: Object.freeze({
        state: sources.preset.state,
        argv: Object.freeze([...sources.preset.argv]),
        envs: Object.freeze({ ...sources.preset.envs }),
        meta:
          sources.preset.meta === undefined ? undefined : Object.freeze({ ...sources.preset.meta }),
      }),
      user: Object.freeze({
        cmds: Object.freeze([...sources.user.cmds]),
        argv: Object.freeze([...sources.user.argv]),
        envs: Object.freeze({ ...sources.user.envs }),
      }),
    }) as ICommandInputSources
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
