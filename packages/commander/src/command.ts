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
import { TERMINAL_STYLE, styleText } from './chalk'
import {
  devmodeOption,
  logColorfulOption,
  logDateOption,
  logLevelOption,
  silentOption,
} from './options'
import { getDefaultCommandRuntime } from './runtime'
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
  ICommandErrorIssueCode,
  ICommandExample,
  ICommandHintIssue,
  ICommandInputSources,
  ICommandIssueScope,
  ICommandOptionConfig,
  ICommandParseResult,
  ICommandParsedArgs,
  ICommandParsedOpts,
  ICommandPresetConfig,
  ICommandPresetIssueMeta,
  ICommandPresetProfileItem,
  ICommandPresetProfileManifest,
  ICommandPresetProfileOptionValue,
  ICommandPresetProfileVariantItem,
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
  IHelpArgumentLine,
  IHelpCommandLine,
  IHelpData,
  IHelpExampleLine,
  IHelpOptionLine,
  ISubcommandEntry,
} from './types'
import { CommanderError } from './types'

// ==================== Naming Convention Utilities ====================

/** Format validation regex for long options (lowercase kebab-case) */
const LONG_OPTION_REGEX = /^--[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
/** Format validation regex for negative options (lowercase kebab-case) */
const NEGATIVE_OPTION_REGEX = /^--no-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

const PRESET_FILE_FLAG = '--preset-file'
const PRESET_PROFILE_FLAG = '--preset-profile'
const PRESET_SELECTOR_DELIMITER = ':'

/** Convert kebab-case to camelCase. Input should be lowercase. */
function kebabToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

/** Convert camelCase to kebab-case. */
function camelToKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}

const ANSI_ESCAPE_REGEX = new RegExp(String.raw`\\x1B\\[[0-?]*[ -/]*[@-~]`, 'g')
const DECIMAL_INTEGER_REGEX = /^\d(?:_?\d)*$/
const DECIMAL_FRACTION_REGEX = /^\d(?:_?\d)*$/
const DECIMAL_EXPONENT_REGEX = /^[eE][+-]?\d(?:_?\d)*$/
const BINARY_LITERAL_REGEX = /^0[bB][01](?:_?[01])*$/
const OCTAL_LITERAL_REGEX = /^0[oO][0-7](?:_?[0-7])*$/
const HEX_LITERAL_REGEX = /^0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*$/
const PRESET_PROFILE_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const PRESET_VARIANT_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEX, '')
}

/* v8 ignore start */
function isCombiningMark(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  )
}

function isWideCodePoint(codePoint: number): boolean {
  if (codePoint < 0x1100) {
    return false
  }

  return (
    codePoint <= 0x115f ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0x3247 && codePoint !== 0x303f) ||
    (codePoint >= 0x3250 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0xa4c6) ||
    (codePoint >= 0xa960 && codePoint <= 0xa97c) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6b) ||
    (codePoint >= 0xff01 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1b000 && codePoint <= 0x1b001) ||
    (codePoint >= 0x1f200 && codePoint <= 0x1f251) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  )
}

function getDisplayWidth(value: string): number {
  const normalized = stripAnsi(value).normalize('NFC')
  let width = 0

  for (const char of normalized) {
    const codePoint = char.codePointAt(0)
    if (codePoint === undefined || isCombiningMark(codePoint)) {
      continue
    }

    width += isWideCodePoint(codePoint) ? 2 : 1
  }

  return width
}
/* v8 ignore stop */

function padDisplayEnd(value: string, targetWidth: number): string {
  const width = getDisplayWidth(value)
  if (width >= targetWidth) {
    return value
  }
  return value + ' '.repeat(targetWidth - width)
}

function isValidPrimitiveNumberLiteral(rawValue: string): boolean {
  if (rawValue.trim() !== rawValue || rawValue.length === 0) {
    return false
  }

  if (rawValue === 'NaN' || rawValue === 'Infinity' || rawValue === '-Infinity') {
    return false
  }

  if (BINARY_LITERAL_REGEX.test(rawValue)) {
    return true
  }
  if (OCTAL_LITERAL_REGEX.test(rawValue)) {
    return true
  }
  if (HEX_LITERAL_REGEX.test(rawValue)) {
    return true
  }

  const sign = rawValue[0] === '+' || rawValue[0] === '-' ? rawValue[0] : ''
  const body = sign ? rawValue.slice(1) : rawValue

  if (body.length === 0) {
    return false
  }

  const expIndex = body.search(/[eE]/)
  const basePart = expIndex === -1 ? body : body.slice(0, expIndex)
  const expPart = expIndex === -1 ? '' : body.slice(expIndex)

  if (expPart && !DECIMAL_EXPONENT_REGEX.test(expPart)) {
    return false
  }

  if (basePart.includes('.')) {
    const decimalParts = basePart.split('.')
    if (decimalParts.length !== 2) {
      return false
    }

    const [intPart, fracPart] = decimalParts
    const intOk = intPart.length === 0 || DECIMAL_INTEGER_REGEX.test(intPart)
    const fracOk = fracPart.length === 0 || DECIMAL_FRACTION_REGEX.test(fracPart)

    if (!intOk || !fracOk) {
      return false
    }

    return intPart.length > 0 || fracPart.length > 0
  }

  return DECIMAL_INTEGER_REGEX.test(basePart)
}

function parsePrimitiveNumber(rawValue: string): number | undefined {
  if (!isValidPrimitiveNumberLiteral(rawValue)) {
    return undefined
  }

  const normalized = rawValue.replaceAll('_', '')
  const value = Number(normalized)
  if (!Number.isFinite(value)) {
    return undefined
  }

  return value
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

function errorKindToIssueCode(kind: CommanderError['kind']): ICommandErrorIssueCode {
  switch (kind) {
    case 'InvalidOptionFormat':
      return 'invalid_option_format'
    case 'InvalidNegativeOption':
      return 'invalid_negative_option'
    case 'NegativeOptionWithValue':
      return 'negative_option_with_value'
    case 'NegativeOptionType':
      return 'negative_option_type'
    case 'UnknownOption':
      return 'unknown_option'
    case 'UnknownSubcommand':
      return 'unknown_subcommand'
    case 'UnexpectedArgument':
      return 'unexpected_argument'
    case 'MissingValue':
      return 'missing_value'
    case 'InvalidType':
      return 'invalid_type'
    case 'UnsupportedShortSyntax':
      return 'unsupported_short_syntax'
    case 'OptionConflict':
      return 'option_conflict'
    case 'MissingRequired':
      return 'missing_required'
    case 'InvalidChoice':
      return 'invalid_choice'
    case 'InvalidBooleanValue':
      return 'invalid_boolean_value'
    case 'MissingRequiredArgument':
      return 'missing_required_argument'
    case 'TooManyArguments':
      return 'too_many_arguments'
    case 'ConfigurationError':
      return 'configuration_error'
    case 'ActionFailed':
      return 'action_failed'
    default: {
      const neverKind: never = kind
      throw new Error(`unsupported commander error kind: ${neverKind}`)
    }
  }
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

interface IPresetFileSource {
  displayPath: string
  absolutePath: string
  explicit: boolean
}

interface IResolvedPresetProfile {
  profileName: string
  variantName: string | undefined
  optsArgv: string[]
  optsSourceLabel: string
  issueMeta: ICommandPresetIssueMeta
  profileInlineEnvs: Record<string, string>
  variantInlineEnvs: Record<string, string>
  profileEnvFileSource?: IPresetFileSource
  variantEnvFileSource?: IPresetFileSource
}

interface IPresetProfileSelector {
  profileName: string
  variantName?: string
}

interface IParseOptionsResult {
  opts: ICommandParsedOpts
  explicitOptionLongs: Set<string>
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

function isNoColorEnabled(envs: Record<string, string | undefined>): boolean {
  return envs['NO_COLOR'] !== undefined
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
    const { argv, envs, reporter } = params

    try {
      // 0. ROUTE
      const routeResult = this.#route(argv)
      const { chain } = routeResult
      const leafCommand = chain[chain.length - 1]

      const ctx = this.#createContext({
        chain,
        cmds: routeResult.cmds,
        envs,
        reporter,
      })

      // 1. CONTROL SCAN
      const controlScanResult = this.#controlScan(routeResult.remaining, leafCommand)
      ctx.controls = controlScanResult.controls
      ctx.sources.user.argv = [...controlScanResult.remaining]

      // 2. control-run
      if (ctx.controls.help) {
        ctx.sources.preset.state = 'skipped'
        const helpCommand = this.#resolveHelpCommand(leafCommand, controlScanResult.helpTarget)
        const helpColor = helpCommand.#resolveHelpColorFromTailArgv(
          controlScanResult.remaining,
          ctx.envs,
        )
        console.log(helpCommand.#formatHelpForDisplay({ color: helpColor }))
        return
      }
      if (ctx.controls.version) {
        ctx.sources.preset.state = 'skipped'
        console.log(leafCommand.#version)
        return
      }

      // 3. PRESET
      const presetResult = await this.#preset(controlScanResult.remaining, ctx)
      ctx.sources = presetResult.sources
      ctx.envs = presetResult.envs
      const sourceSegments = presetResult.segments

      // 4. TOKENIZE
      let optionTokens: ICommandToken[]
      let restArgs: string[]
      try {
        const tokenizeResult = tokenize(presetResult.segments, leafCommand.#getCommandPath())
        optionTokens = tokenizeResult.optionTokens
        restArgs = tokenizeResult.restArgs
      } catch (err) {
        if (err instanceof CommanderError) {
          const enriched = this.#withErrorIssue(
            err,
            this.#buildErrorIssue({
              error: err,
              stage: 'tokenize',
              scope: errorKindToIssueScope(err.kind),
            }),
          )
          throw this.#withPresetInjectedHint(enriched, sourceSegments)
        }
        throw err
      }

      // 5. BUILTIN RESOLVE
      let optionPolicyMap: Map<Command, ICommandOptionPolicy>
      try {
        optionPolicyMap = this.#buildOptionPolicyMap(chain)
      } catch (err) {
        if (err instanceof CommanderError) {
          const enriched = this.#withErrorIssue(
            err,
            this.#buildErrorIssue({
              error: err,
              stage: 'builtin-resolve',
              scope: errorKindToIssueScope(err.kind),
            }),
          )
          throw this.#withPresetInjectedHint(enriched, sourceSegments)
        }
        throw err
      }

      // 6. RESOLVE
      let resolveResult: ICommandResolveResult
      try {
        resolveResult = this.#resolve(chain, optionTokens, optionPolicyMap)
      } catch (err) {
        if (err instanceof CommanderError) {
          const enriched = this.#withErrorIssue(
            err,
            this.#buildErrorIssue({
              error: err,
              stage: 'resolve',
              scope: errorKindToIssueScope(err.kind),
            }),
          )
          throw this.#withPresetInjectedHint(enriched, sourceSegments)
        }
        throw err
      }

      // 7. PARSE
      let parseResult: ICommandParseResult
      try {
        parseResult = this.#parse(chain, resolveResult, optionPolicyMap, ctx, restArgs)
      } catch (err) {
        if (err instanceof CommanderError) {
          const optionConflictSource = this.#resolveOptionConflictSourceAttribution(
            err,
            sourceSegments,
          )
          const optionConflictPreset = this.#resolveOptionConflictPresetAttribution(
            err,
            sourceSegments,
            optionConflictSource,
          )
          const enriched = this.#withErrorIssue(
            err,
            this.#buildErrorIssue({
              error: err,
              stage: 'parse',
              scope: errorKindToIssueScope(err.kind),
              source: optionConflictSource,
              preset: optionConflictPreset,
            }),
          )
          throw this.#withPresetInjectedHint(enriched, sourceSegments)
        }
        throw err
      }

      // 8. RUN
      const actionParams: ICommandActionParams = {
        ctx: parseResult.ctx,
        builtin: parseResult.builtin,
        opts: parseResult.opts,
        args: parseResult.args,
        rawArgs: parseResult.rawArgs,
      }

      if (leafCommand.#action) {
        try {
          await leafCommand.#runAction(actionParams)
        } catch (err) {
          if (err instanceof CommanderError) {
            throw this.#withErrorIssue(
              err,
              this.#buildErrorIssue({
                error: err,
                stage: 'run',
                scope: errorKindToIssueScope(err.kind),
              }),
            )
          }
          throw err
        }
      } else if (leafCommand.#subcommandsList.length > 0) {
        const helpColor = leafCommand.#resolveHelpColorFromTailArgv(presetResult.tailArgv, ctx.envs)
        console.log(leafCommand.#formatHelpForDisplay({ color: helpColor }))
      } else {
        throw new CommanderError(
          'ConfigurationError',
          `no action defined for command "${leafCommand.#getCommandPath()}"`,
          leafCommand.#getCommandPath(),
        )
      }
    } catch (err) {
      if (err instanceof CommanderError) {
        if (err.kind === 'ActionFailed') {
          console.error(err.format())
          process.exit(1)
          return
        }
        console.error(err.format())
        process.exit(2)
        return
      }
      throw err
    }
  }

  public async parse(params: ICommandRunParams): Promise<ICommandParseResult> {
    const { argv, envs, reporter } = params

    // 0. ROUTE
    const routeResult = this.#route(argv)
    const { chain } = routeResult
    const leafCommand = chain[chain.length - 1]

    const ctx = this.#createContext({
      chain,
      cmds: routeResult.cmds,
      envs,
      reporter,
    })

    // 1. CONTROL SCAN
    const controlScanResult = this.#controlScan(routeResult.remaining, leafCommand)
    ctx.controls = controlScanResult.controls
    ctx.sources.user.argv = [...controlScanResult.remaining]

    // 2. PRESET
    const presetResult = await this.#preset(controlScanResult.remaining, ctx)
    ctx.sources = presetResult.sources
    ctx.envs = presetResult.envs
    const sourceSegments = presetResult.segments

    // 3. TOKENIZE
    let optionTokens: ICommandToken[]
    let restArgs: string[]
    try {
      const tokenizeResult = tokenize(presetResult.segments, leafCommand.#getCommandPath())
      optionTokens = tokenizeResult.optionTokens
      restArgs = tokenizeResult.restArgs
    } catch (err) {
      if (err instanceof CommanderError) {
        const enriched = this.#withErrorIssue(
          err,
          this.#buildErrorIssue({
            error: err,
            stage: 'tokenize',
            scope: errorKindToIssueScope(err.kind),
          }),
        )
        throw this.#withPresetInjectedHint(enriched, sourceSegments)
      }
      throw err
    }

    // 4. BUILTIN RESOLVE
    let optionPolicyMap: Map<Command, ICommandOptionPolicy>
    try {
      optionPolicyMap = this.#buildOptionPolicyMap(chain)
    } catch (err) {
      if (err instanceof CommanderError) {
        const enriched = this.#withErrorIssue(
          err,
          this.#buildErrorIssue({
            error: err,
            stage: 'builtin-resolve',
            scope: errorKindToIssueScope(err.kind),
          }),
        )
        throw this.#withPresetInjectedHint(enriched, sourceSegments)
      }
      throw err
    }

    // 5. RESOLVE
    let resolveResult: ICommandResolveResult
    try {
      resolveResult = this.#resolve(chain, optionTokens, optionPolicyMap)
    } catch (err) {
      if (err instanceof CommanderError) {
        const enriched = this.#withErrorIssue(
          err,
          this.#buildErrorIssue({
            error: err,
            stage: 'resolve',
            scope: errorKindToIssueScope(err.kind),
          }),
        )
        throw this.#withPresetInjectedHint(enriched, sourceSegments)
      }
      throw err
    }

    // 6. PARSE
    try {
      return this.#parse(chain, resolveResult, optionPolicyMap, ctx, restArgs)
    } catch (err) {
      if (err instanceof CommanderError) {
        const optionConflictSource = this.#resolveOptionConflictSourceAttribution(
          err,
          sourceSegments,
        )
        const optionConflictPreset = this.#resolveOptionConflictPresetAttribution(
          err,
          sourceSegments,
          optionConflictSource,
        )
        const enriched = this.#withErrorIssue(
          err,
          this.#buildErrorIssue({
            error: err,
            stage: 'parse',
            scope: errorKindToIssueScope(err.kind),
            source: optionConflictSource,
            preset: optionConflictPreset,
          }),
        )
        throw this.#withPresetInjectedHint(enriched, sourceSegments)
      }
      throw err
    }
  }

  #buildErrorIssue(params: {
    error: CommanderError
    stage: ICommandErrorIssue['stage']
    scope: ICommandIssueScope
    token?: ICommandToken
    source?: ICommandErrorIssue['source']
    preset?: ICommandPresetIssueMeta
    originStage?: ICommandErrorIssue['originStage']
    details?: Record<string, unknown>
  }): ICommandErrorIssue {
    const { error, stage, scope, token, source, preset, originStage, details } = params
    const tokenSource: ICommandErrorIssue['source'] =
      token === undefined
        ? undefined
        : {
            primary: token.source,
          }
    const defaultSource: ICommandErrorIssue['source'] =
      error.kind === 'MissingRequiredArgument' || error.kind === 'UnknownSubcommand'
        ? { primary: 'user' as const }
        : undefined
    const issueSource = source ?? tokenSource ?? defaultSource
    const issuePreset = preset ?? token?.preset
    const presetSource =
      issueSource?.primary === 'preset' || issueSource?.related?.includes('preset')
    const resolvedOriginStage =
      originStage ?? (presetSource && stage !== 'preset' ? 'preset' : undefined)

    return {
      kind: 'error',
      stage,
      originStage: resolvedOriginStage,
      source: issueSource,
      scope,
      reason: {
        code: errorKindToIssueCode(error.kind),
        message: error.message,
        details,
      },
      preset: issuePreset,
    }
  }

  #withErrorIssue(error: CommanderError, issue: ICommandErrorIssue): CommanderError {
    if (error.meta?.issues.some(existing => existing.kind === 'error')) {
      return error
    }

    return error.withIssue(issue)
  }

  #withPresetInjectedHint(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
  ): CommanderError {
    const presetSegments = sourceSegments.filter(segment => segment.source === 'preset')
    if (presetSegments.length === 0) {
      return error
    }
    if (error.kind === 'ConfigurationError') {
      return error
    }

    let nextError = error
    const primaryIssue = nextError.meta?.issues.find(issue => issue.kind === 'error')
    const conflictSources =
      primaryIssue?.reason.code === 'option_conflict'
        ? this.#inferOptionConflictSources(primaryIssue.reason.message, sourceSegments)
        : undefined
    const hasMixedConflictAttribution =
      primaryIssue?.source?.related?.includes('user') === true &&
      primaryIssue.source.related.includes('preset')
    const isMixedConflict =
      hasMixedConflictAttribution ||
      (conflictSources?.has('user') === true && conflictSources.has('preset'))

    if (
      isMixedConflict &&
      primaryIssue?.reason.code === 'option_conflict' &&
      !nextError.meta?.issues.some(
        issue => issue.kind === 'hint' && issue.reason.code === 'mixed_source_conflict',
      )
    ) {
      const mixedHint: ICommandHintIssue = {
        kind: 'hint',
        stage: primaryIssue.stage,
        originStage: primaryIssue.originStage,
        scope: 'option',
        source: {
          related: ['user', 'preset'],
        },
        reason: {
          code: 'mixed_source_conflict',
          message: 'option conflict involves both user input and preset-injected tokens',
        },
        preset: this.#resolveOptionConflictPresetByMessage(
          primaryIssue.reason.message,
          sourceSegments,
          { related: ['user', 'preset'] },
        ),
      }
      nextError = nextError.withIssue(mixedHint)
    }

    const shouldAttachPresetTokenHint =
      primaryIssue?.source?.primary === 'preset' || isMixedConflict

    if (!shouldAttachPresetTokenHint) {
      return nextError
    }

    if (
      nextError.meta?.issues.some(
        issue => issue.kind === 'hint' && issue.reason.code === 'preset_token_injected',
      )
    ) {
      return nextError
    }

    const firstSegment = presetSegments[0]
    const moreCount = presetSegments.length - 1
    const moreText = moreCount > 0 ? ` (+${moreCount} more)` : ''
    const currentPrimaryIssue = nextError.meta?.issues.find(issue => issue.kind === 'error')

    const hint: ICommandHintIssue = {
      kind: 'hint',
      stage: currentPrimaryIssue?.stage ?? 'parse',
      originStage: 'preset',
      scope: 'preset',
      source: { primary: 'preset' },
      reason: {
        code: 'preset_token_injected',
        message: `token ${JSON.stringify(firstSegment.value)} was injected from preset profile opts${moreText}`,
      },
      preset: firstSegment.preset,
    }

    return nextError.withIssue(hint)
  }

  #resolveOptionConflictSourceAttribution(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
  ): ICommandErrorIssue['source'] | undefined {
    if (error.kind !== 'OptionConflict') {
      return undefined
    }

    const sources = this.#inferOptionConflictSources(error.message, sourceSegments)
    if (sources.has('user') && sources.has('preset')) {
      return {
        related: ['user', 'preset'],
      }
    }
    if (sources.has('preset')) {
      return { primary: 'preset' }
    }
    if (sources.has('user')) {
      return { primary: 'user' }
    }
    return undefined
  }

  #resolveOptionConflictPresetAttribution(
    error: CommanderError,
    sourceSegments: ICommandArgvSegment[],
    source: ICommandErrorIssue['source'],
  ): ICommandPresetIssueMeta | undefined {
    if (error.kind !== 'OptionConflict') {
      return undefined
    }

    return this.#resolveOptionConflictPresetByMessage(error.message, sourceSegments, source)
  }

  #resolveOptionConflictPresetByMessage(
    message: string,
    sourceSegments: ICommandArgvSegment[],
    source: ICommandErrorIssue['source'],
  ): ICommandPresetIssueMeta | undefined {
    const relevantSegments = this.#collectOptionConflictSegments(message, sourceSegments)
    const relevantPresetSegment = relevantSegments.find(
      segment => segment.source === 'preset' && segment.preset !== undefined,
    )
    if (relevantPresetSegment?.preset !== undefined) {
      return { ...relevantPresetSegment.preset }
    }

    const hasPresetSource =
      source?.primary === 'preset' || source?.related?.includes('preset') === true
    if (!hasPresetSource) {
      return undefined
    }

    const fallbackPresetSegment = sourceSegments.find(
      segment => segment.source === 'preset' && segment.preset !== undefined,
    )
    return fallbackPresetSegment?.preset === undefined
      ? undefined
      : { ...fallbackPresetSegment.preset }
  }

  #inferOptionConflictSources(
    message: string,
    sourceSegments: ICommandArgvSegment[],
  ): Set<ICommandArgvSegment['source']> {
    const relevantSegments = this.#collectOptionConflictSegments(message, sourceSegments)

    const sources = new Set<ICommandArgvSegment['source']>()
    for (const segment of relevantSegments) {
      sources.add(segment.source)
    }

    return sources
  }

  #collectOptionConflictSegments(
    message: string,
    sourceSegments: ICommandArgvSegment[],
  ): ICommandArgvSegment[] {
    const matchedLongs = Array.from(
      message.matchAll(/"(--[a-z][a-z0-9]*(?:-[a-z0-9]+)*)"/g),
      match => match[1],
    )
    const matchedShorts = Array.from(message.matchAll(/"(-[A-Za-z0-9])"/g), match => match[1])
    const optionLiterals = new Set<string>([...matchedLongs, ...matchedShorts])

    const optionSegments = sourceSegments.filter(segment => segment.value.startsWith('-'))
    const relevantSegments =
      optionLiterals.size === 0
        ? optionSegments
        : optionSegments.filter(segment => {
            for (const literal of optionLiterals) {
              if (segment.value === literal || segment.value.startsWith(`${literal}=`)) {
                return true
              }
            }
            return false
          })

    return relevantSegments
  }

  public formatHelp(): string {
    return this.#renderHelpPlain(this.#buildHelpData())
  }

  #formatHelpForDisplay(params: { color?: boolean } = {}): string {
    const { color = true } = params
    const helpData = this.#buildHelpData()
    if (!this.#shouldRenderStyledHelp(color)) {
      return this.#renderHelpPlain(helpData)
    }
    return this.#renderHelpTerminal(helpData)
  }

  #shouldRenderStyledHelp(color: boolean): boolean {
    return color && process.stdout.isTTY === true
  }

  #buildHelpData(): IHelpData {
    const parseOptions = this.#resolveOptionPolicy().mergedOptions
    const allOptions: ICommandOptionConfig[] = [...parseOptions, BUILTIN_HELP_OPTION]
    if (this.#supportsBuiltinVersion()) {
      allOptions.push(BUILTIN_VERSION_OPTION)
    }
    const commandPath = this.#getCommandPath()

    let usage = `Usage: ${commandPath}`
    if (allOptions.length > 0) usage += ' [options]'
    if (this.#subcommandsList.length > 0) usage += ' [command]'
    for (const arg of this.#arguments) {
      if (arg.kind === 'required') {
        usage += ` <${arg.name}>`
      } else if (arg.kind === 'optional') {
        usage += ` [${arg.name}]`
      } else if (arg.kind === 'some') {
        usage += ` <${arg.name}...>`
      } else {
        usage += ` [${arg.name}...]`
      }
    }

    const argumentsLines: IHelpArgumentLine[] = []
    for (const arg of this.#arguments) {
      const sig =
        arg.kind === 'required'
          ? `<${arg.name}>`
          : arg.kind === 'optional'
            ? `[${arg.name}]`
            : arg.kind === 'some'
              ? `<${arg.name}...>`
              : `[${arg.name}...]`

      const metadata: string[] = [`[type: ${arg.type}]`]
      if (arg.kind === 'optional' && arg.default !== undefined) {
        metadata.push(`[default: ${JSON.stringify(arg.default)}]`)
      }
      if (arg.choices && arg.choices.length > 0) {
        metadata.push(`[choices: ${arg.choices.map(choice => JSON.stringify(choice)).join(', ')}]`)
      }

      const desc = metadata.length > 0 ? `${arg.desc} ${metadata.join(' ')}` : arg.desc
      argumentsLines.push({ sig, desc })
    }

    const sortedOptions = [...allOptions].sort((a, b) => {
      const optionRank = (option: ICommandOptionConfig): number => {
        if (option.long === 'help') {
          return 0
        }
        if (option.long === 'version') {
          return 1
        }
        if (option.required === true) {
          return 2
        }
        return 3
      }

      const rankA = optionRank(a)
      const rankB = optionRank(b)
      if (rankA !== rankB) {
        return rankA - rankB
      }

      return camelToKebabCase(a.long).localeCompare(camelToKebabCase(b.long))
    })

    const options: IHelpOptionLine[] = []
    for (const opt of sortedOptions) {
      const kebabLong = camelToKebabCase(opt.long)
      let sig = opt.short ? `-${opt.short}, ` : '    '
      sig += `--${kebabLong}`
      if (opt.args === 'optional') {
        sig += ' [value]'
      } else if (opt.args !== 'none') {
        sig += ' <value>'
      }

      let desc = opt.desc
      if (opt.default !== undefined && opt.type !== 'boolean') {
        desc += ` (default: ${JSON.stringify(opt.default)})`
      }
      if (opt.choices) {
        desc += ` [choices: ${opt.choices.map(choice => JSON.stringify(choice)).join(', ')}]`
      }

      options.push({ sig, desc })
    }

    const commands: IHelpCommandLine[] = []
    if (this.#subcommandsList.length > 0) {
      commands.push({ name: 'help', desc: 'Show help for a command' })
    }
    const sortedSubcommands = [...this.#subcommandsList].sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    for (const entry of sortedSubcommands) {
      let name = entry.name
      if (entry.aliases.length > 0) {
        name += `, ${entry.aliases.join(', ')}`
      }
      commands.push({ name, desc: entry.command.#desc })
    }

    const examples: IHelpExampleLine[] = this.#examples.map(example => ({
      title: example.title,
      usage: commandPath ? `${commandPath} ${example.usage}` : example.usage,
      desc: example.desc,
    }))

    return {
      desc: this.#desc,
      usage,
      arguments: argumentsLines,
      options,
      commands,
      examples,
    }
  }

  #renderHelpPlain(helpData: IHelpData): string {
    const lines: string[] = []
    const labelWidth = this.#getHelpLabelWidth(helpData)

    lines.push(helpData.desc)
    lines.push('')

    lines.push(helpData.usage)
    lines.push('')

    if (helpData.arguments.length > 0) {
      lines.push('Arguments:')
      for (const { sig, desc } of helpData.arguments) {
        lines.push(this.#renderAlignedHelpLine(sig, desc, labelWidth))
      }
      lines.push('')
    }

    if (helpData.options.length > 0) {
      lines.push('Options:')
      for (const { sig, desc } of helpData.options) {
        lines.push(this.#renderAlignedHelpLine(sig, desc, labelWidth))
      }
      lines.push('')
    }

    if (helpData.commands.length > 0) {
      lines.push('Commands:')
      for (const { name, desc } of helpData.commands) {
        lines.push(this.#renderAlignedHelpLine(name, desc, labelWidth))
      }
      lines.push('')
    }

    if (helpData.examples.length > 0) {
      lines.push('Examples:')
      for (const example of helpData.examples) {
        lines.push(`  - ${example.title}`)
        lines.push(`    ${example.usage}`)
        lines.push(`    ${example.desc}`)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  #renderHelpTerminal(helpData: IHelpData): string {
    const lines: string[] = []
    const labelWidth = this.#getHelpLabelWidth(helpData)

    lines.push(helpData.desc)
    lines.push('')

    lines.push(styleText(helpData.usage, TERMINAL_STYLE.bold))
    lines.push('')

    if (helpData.arguments.length > 0) {
      lines.push(styleText('Arguments:', TERMINAL_STYLE.bold, TERMINAL_STYLE.underline))
      for (const { sig, desc } of helpData.arguments) {
        lines.push(
          this.#renderAlignedHelpLine(sig, desc, labelWidth, value =>
            styleText(value, TERMINAL_STYLE.cyan),
          ),
        )
      }
      lines.push('')
    }

    if (helpData.options.length > 0) {
      lines.push(styleText('Options:', TERMINAL_STYLE.bold, TERMINAL_STYLE.underline))
      for (const { sig, desc } of helpData.options) {
        lines.push(
          this.#renderAlignedHelpLine(sig, desc, labelWidth, value =>
            styleText(value, TERMINAL_STYLE.cyan),
          ),
        )
      }
      lines.push('')
    }

    if (helpData.commands.length > 0) {
      lines.push(styleText('Commands:', TERMINAL_STYLE.bold, TERMINAL_STYLE.underline))
      for (const { name, desc } of helpData.commands) {
        lines.push(
          this.#renderAlignedHelpLine(name, desc, labelWidth, value =>
            styleText(value, TERMINAL_STYLE.cyan),
          ),
        )
      }
      lines.push('')
    }

    if (helpData.examples.length > 0) {
      lines.push(styleText('Examples:', TERMINAL_STYLE.bold, TERMINAL_STYLE.underline))
      for (const example of helpData.examples) {
        lines.push(`  - ${styleText(example.title, TERMINAL_STYLE.bold)}`)
        lines.push(`    ${styleText(example.usage, TERMINAL_STYLE.cyan)}`)
        lines.push(`    ${styleText(example.desc, TERMINAL_STYLE.italic, TERMINAL_STYLE.dim)}`)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  #getHelpLabelWidth(helpData: IHelpData): number {
    const labels = [
      ...helpData.arguments.map(line => line.sig),
      ...helpData.options.map(line => line.sig),
      ...helpData.commands.map(line => line.name),
    ]
    if (labels.length === 0) {
      return 0
    }

    return Math.max(...labels.map(getDisplayWidth))
  }

  #renderAlignedHelpLine(
    label: string,
    desc: string,
    labelWidth: number,
    styleLabel?: (value: string) => string,
  ): string {
    const paddedLabel = padDisplayEnd(label, labelWidth)
    const outputLabel = styleLabel ? styleLabel(paddedLabel) : paddedLabel
    return `  ${outputLabel}  ${desc}`
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
      this.#assertPresetProfileSelectorValue(
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
      this.#validatePresetOptionTokens(
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
    const { presetFile, presetProfile, presetProfileSourceName, commandPath } = params

    if (presetFile === undefined) {
      if (presetProfile !== undefined) {
        throw new CommanderError(
          'ConfigurationError',
          `cannot use "${PRESET_PROFILE_FLAG}" without "${PRESET_FILE_FLAG}"`,
          commandPath,
        )
      }
      return undefined
    }

    const profileFile = {
      displayPath: presetFile,
      absolutePath: this.#resolvePresetFileAbsolutePath(presetFile),
      explicit: true,
    }

    const content = await this.#readPresetFile(profileFile, commandPath)
    if (content === undefined) {
      return undefined
    }
    const manifest = this.#parsePresetProfileManifest(content, profileFile.displayPath, commandPath)

    const resolvedProfileSelector = presetProfile ?? manifest.defaults?.profile
    if (resolvedProfileSelector === undefined) {
      throw new CommanderError(
        'ConfigurationError',
        `missing profile for preset file "${profileFile.displayPath}": provide "${PRESET_PROFILE_FLAG}" or defaults.profile`,
        commandPath,
      )
    }

    const { profileName: resolvedProfileName, variantName: explicitVariantName } =
      this.#parsePresetProfileSelector(
        resolvedProfileSelector,
        presetProfileSourceName ?? 'defaults.profile',
        commandPath,
      )
    const profile = manifest.profiles[resolvedProfileName]
    if (profile === undefined) {
      throw new CommanderError(
        'ConfigurationError',
        `unknown preset profile "${resolvedProfileName}" in "${profileFile.displayPath}"`,
        commandPath,
      )
    }

    const selectedVariantName = explicitVariantName ?? profile.defaultVariant
    let selectedVariant: ICommandPresetProfileVariantItem | undefined
    if (selectedVariantName !== undefined) {
      const variants = profile.variants ?? {}
      selectedVariant = variants[selectedVariantName]
      if (selectedVariant === undefined) {
        const availableVariants = Object.keys(variants)
        const availableText = availableVariants.length > 0 ? availableVariants.join(', ') : '<none>'
        throw new CommanderError(
          'ConfigurationError',
          `unknown preset variant "${selectedVariantName}" for profile "${resolvedProfileName}" in "${profileFile.displayPath}" (available: ${availableText})`,
          commandPath,
        )
      }
    }

    const profileSelectorLabel =
      selectedVariantName === undefined
        ? resolvedProfileName
        : `${resolvedProfileName}${PRESET_SELECTOR_DELIMITER}${selectedVariantName}`

    const mergedOpts = { ...(profile.opts ?? {}), ...(selectedVariant?.opts ?? {}) }

    const optsArgv = this.#buildPresetArgvFromProfileOptions(
      mergedOpts,
      profileSelectorLabel,
      commandPath,
    )
    const profileInlineEnvs = this.#normalizePresetProfileEnvs(
      profile.envs,
      profileSelectorLabel,
      commandPath,
    )
    const variantInlineEnvs = this.#normalizePresetProfileEnvs(
      selectedVariant?.envs,
      profileSelectorLabel,
      commandPath,
    )

    const profileDir = this.#runtime.resolve(profileFile.absolutePath, '..')
    let profileEnvFileSource: IPresetFileSource | undefined
    if (profile.envFile !== undefined) {
      profileEnvFileSource = {
        displayPath: profile.envFile,
        absolutePath: this.#resolvePresetFileAbsolutePath(profile.envFile, profileDir),
        explicit: true,
      }
    }
    let variantEnvFileSource: IPresetFileSource | undefined
    if (selectedVariant?.envFile !== undefined) {
      variantEnvFileSource = {
        displayPath: selectedVariant.envFile,
        absolutePath: this.#resolvePresetFileAbsolutePath(selectedVariant.envFile, profileDir),
        explicit: true,
      }
    }

    return {
      profileName: resolvedProfileName,
      variantName: selectedVariantName,
      optsArgv,
      optsSourceLabel: `${profileFile.displayPath}#${profileSelectorLabel}.opts`,
      issueMeta: {
        file: profileFile.displayPath,
        profile: resolvedProfileName,
        variant: selectedVariantName,
      },
      profileInlineEnvs,
      variantInlineEnvs,
      profileEnvFileSource,
      variantEnvFileSource,
    }
  }

  #parsePresetProfileManifest(
    content: string,
    filepath: string,
    commandPath: string,
  ): ICommandPresetProfileManifest {
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch (error) {
      throw new CommanderError(
        'ConfigurationError',
        `failed to parse preset file "${filepath}": ${(error as Error).message}`,
        commandPath,
      )
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset file "${filepath}": root must be an object`,
        commandPath,
      )
    }

    const root = parsed as Record<string, unknown>
    if (root.version !== 1) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset file "${filepath}": "version" must be 1`,
        commandPath,
      )
    }

    let defaults: ICommandPresetProfileManifest['defaults']
    const rawDefaults = root.defaults
    if (rawDefaults !== undefined) {
      if (typeof rawDefaults !== 'object' || rawDefaults === null || Array.isArray(rawDefaults)) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset file "${filepath}": "defaults" must be an object`,
          commandPath,
        )
      }
      const defaultsRecord = rawDefaults as Record<string, unknown>
      if (defaultsRecord.profile !== undefined) {
        if (typeof defaultsRecord.profile !== 'string') {
          throw new CommanderError(
            'ConfigurationError',
            `invalid preset file "${filepath}": "defaults.profile" must be a string`,
            commandPath,
          )
        }
        this.#assertPresetProfileSelectorValue(
          defaultsRecord.profile,
          'defaults.profile',
          commandPath,
        )
      }
      defaults = { profile: defaultsRecord.profile as string | undefined }
    }

    const rawProfiles = root.profiles
    if (typeof rawProfiles !== 'object' || rawProfiles === null || Array.isArray(rawProfiles)) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset file "${filepath}": "profiles" must be an object`,
        commandPath,
      )
    }

    const profilesRecord: Record<string, ICommandPresetProfileItem> = {}
    for (const [profileName, profileValue] of Object.entries(rawProfiles)) {
      this.#assertPresetProfileName(profileName, `profiles["${profileName}"]`, commandPath)
      if (
        typeof profileValue !== 'object' ||
        profileValue === null ||
        Array.isArray(profileValue)
      ) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset file "${filepath}": profile "${profileName}" must be an object`,
          commandPath,
        )
      }
      profilesRecord[profileName] = this.#parsePresetProfileItem(
        profileValue as Record<string, unknown>,
        profileName,
        filepath,
        commandPath,
      )
    }

    return {
      version: 1,
      defaults,
      profiles: profilesRecord,
    }
  }

  #parsePresetProfileItem(
    profileValue: Record<string, unknown>,
    profileName: string,
    filepath: string,
    commandPath: string,
  ): ICommandPresetProfileItem {
    const labelPrefix = `invalid preset file "${filepath}": profile "${profileName}"`

    const envFile = profileValue.envFile
    if (envFile !== undefined) {
      if (typeof envFile !== 'string') {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.envFile must be a string`,
          commandPath,
        )
      }
    }

    const rawEnvs = profileValue.envs
    let envs: Record<string, string> | undefined
    if (rawEnvs !== undefined) {
      if (typeof rawEnvs !== 'object' || rawEnvs === null || Array.isArray(rawEnvs)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.envs must be an object`,
          commandPath,
        )
      }
      envs = {}
      for (const [key, value] of Object.entries(rawEnvs as Record<string, unknown>)) {
        if (typeof value !== 'string') {
          throw new CommanderError(
            'ConfigurationError',
            `${labelPrefix}.envs["${key}"] must be a string`,
            commandPath,
          )
        }
        envs[key] = value
      }
    }

    const rawOpts = profileValue.opts
    let opts: Record<string, ICommandPresetProfileOptionValue> | undefined
    if (rawOpts !== undefined) {
      if (typeof rawOpts !== 'object' || rawOpts === null || Array.isArray(rawOpts)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.opts must be an object`,
          commandPath,
        )
      }
      opts = {}
      for (const [key, value] of Object.entries(rawOpts as Record<string, unknown>)) {
        opts[key] = this.#parsePresetProfileOptionValue(
          value,
          `${labelPrefix}.opts["${key}"]`,
          commandPath,
        )
      }
    }

    const rawDefaultVariant = profileValue.defaultVariant
    let defaultVariant: string | undefined
    if (rawDefaultVariant !== undefined) {
      if (typeof rawDefaultVariant !== 'string') {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.defaultVariant must be a string`,
          commandPath,
        )
      }
      this.#assertPresetVariantName(rawDefaultVariant, `${labelPrefix}.defaultVariant`, commandPath)
      defaultVariant = rawDefaultVariant
    }

    const rawVariants = profileValue.variants
    let variants: Record<string, ICommandPresetProfileVariantItem> | undefined
    if (rawVariants !== undefined) {
      if (typeof rawVariants !== 'object' || rawVariants === null || Array.isArray(rawVariants)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.variants must be an object`,
          commandPath,
        )
      }

      variants = {}
      for (const [variantName, variantValue] of Object.entries(
        rawVariants as Record<string, unknown>,
      )) {
        this.#assertPresetVariantName(
          variantName,
          `${labelPrefix}.variants["${variantName}"]`,
          commandPath,
        )
        if (
          typeof variantValue !== 'object' ||
          variantValue === null ||
          Array.isArray(variantValue)
        ) {
          throw new CommanderError(
            'ConfigurationError',
            `${labelPrefix}.variants["${variantName}"] must be an object`,
            commandPath,
          )
        }
        variants[variantName] = this.#parsePresetProfileVariantItem(
          variantValue as Record<string, unknown>,
          `${labelPrefix}.variants["${variantName}"]`,
          commandPath,
        )
      }
    }

    if (
      defaultVariant !== undefined &&
      (variants === undefined || variants[defaultVariant] === undefined)
    ) {
      throw new CommanderError(
        'ConfigurationError',
        `${labelPrefix}.defaultVariant "${defaultVariant}" is not found in variants`,
        commandPath,
      )
    }

    return {
      envFile,
      envs,
      opts,
      defaultVariant,
      variants,
    }
  }

  #parsePresetProfileVariantItem(
    variantValue: Record<string, unknown>,
    labelPrefix: string,
    commandPath: string,
  ): ICommandPresetProfileVariantItem {
    const envFile = variantValue.envFile
    if (envFile !== undefined) {
      if (typeof envFile !== 'string') {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.envFile must be a string`,
          commandPath,
        )
      }
    }

    const rawEnvs = variantValue.envs
    let envs: Record<string, string> | undefined
    if (rawEnvs !== undefined) {
      if (typeof rawEnvs !== 'object' || rawEnvs === null || Array.isArray(rawEnvs)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.envs must be an object`,
          commandPath,
        )
      }
      envs = {}
      for (const [key, value] of Object.entries(rawEnvs as Record<string, unknown>)) {
        if (typeof value !== 'string') {
          throw new CommanderError(
            'ConfigurationError',
            `${labelPrefix}.envs["${key}"] must be a string`,
            commandPath,
          )
        }
        envs[key] = value
      }
    }

    const rawOpts = variantValue.opts
    let opts: Record<string, ICommandPresetProfileOptionValue> | undefined
    if (rawOpts !== undefined) {
      if (typeof rawOpts !== 'object' || rawOpts === null || Array.isArray(rawOpts)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.opts must be an object`,
          commandPath,
        )
      }
      opts = {}
      for (const [key, value] of Object.entries(rawOpts as Record<string, unknown>)) {
        opts[key] = this.#parsePresetProfileOptionValue(
          value,
          `${labelPrefix}.opts["${key}"]`,
          commandPath,
        )
      }
    }

    return {
      envFile,
      envs,
      opts,
    }
  }

  #parsePresetProfileOptionValue(
    value: unknown,
    valueLabel: string,
    commandPath: string,
  ): ICommandPresetProfileOptionValue {
    if (typeof value === 'boolean' || typeof value === 'string') {
      return value
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new CommanderError(
          'ConfigurationError',
          `${valueLabel} must be a finite number`,
          commandPath,
        )
      }
      return value
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        if (typeof item === 'string') {
          return item
        }
        if (typeof item === 'number' && Number.isFinite(item)) {
          return item
        }
        throw new CommanderError(
          'ConfigurationError',
          `${valueLabel}[${index}] must be a string or finite number`,
          commandPath,
        )
      })
    }

    throw new CommanderError(
      'ConfigurationError',
      `${valueLabel} must be boolean|string|number|(string|number)[]`,
      commandPath,
    )
  }

  #normalizePresetProfileEnvs(
    envs: Record<string, string> | undefined,
    _profileName: string,
    _commandPath: string,
  ): Record<string, string> {
    return envs === undefined ? {} : { ...envs }
  }

  #normalizePresetOptionName(rawName: string, profileName: string, commandPath: string): string {
    const value = rawName.trim()
    if (value.length === 0) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid option name "" in preset profile "${profileName}"`,
        commandPath,
      )
    }

    const stripped = value.startsWith('--') ? value.slice(2) : value
    if (stripped.length === 0) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid option name "${rawName}" in preset profile "${profileName}"`,
        commandPath,
      )
    }

    if (stripped.includes('-')) {
      const lowered = stripped.toLowerCase()
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(lowered)) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid option name "${rawName}" in preset profile "${profileName}"`,
          commandPath,
        )
      }
      return kebabToCamelCase(lowered)
    }

    if (!/^[a-z][a-zA-Z0-9]*$/.test(stripped)) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid option name "${rawName}" in preset profile "${profileName}"`,
        commandPath,
      )
    }

    return stripped
  }

  #buildPresetArgvFromProfileOptions(
    opts: Record<string, ICommandPresetProfileOptionValue>,
    profileName: string,
    commandPath: string,
  ): string[] {
    const argv: string[] = []

    for (const [rawName, rawValue] of Object.entries(opts)) {
      const optionName = this.#normalizePresetOptionName(rawName, profileName, commandPath)
      const kebabName = camelToKebabCase(optionName)
      const positiveFlag = `--${kebabName}`
      const negativeFlag = `--no-${kebabName}`

      if (typeof rawValue === 'boolean') {
        argv.push(rawValue ? positiveFlag : negativeFlag)
        continue
      }

      if (typeof rawValue === 'string') {
        argv.push(positiveFlag, rawValue)
        continue
      }

      if (typeof rawValue === 'number') {
        argv.push(positiveFlag, String(rawValue))
        continue
      }

      if (rawValue.length === 0) {
        continue
      }

      argv.push(positiveFlag, ...rawValue.map(value => String(value)))
    }

    return argv
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
        this.#assertPresetProfileSelectorValue(value, PRESET_PROFILE_FLAG, commandPath)
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

  #assertPresetProfileSelectorValue(
    selector: string,
    sourceName: string,
    commandPath: string,
  ): void {
    void this.#parsePresetProfileSelector(selector, sourceName, commandPath)
  }

  #parsePresetProfileSelector(
    selector: string,
    sourceName: string,
    commandPath: string,
  ): IPresetProfileSelector {
    const normalizedSelector = selector.trim()
    const separatorIndex = normalizedSelector.indexOf(PRESET_SELECTOR_DELIMITER)
    if (separatorIndex < 0) {
      this.#assertPresetProfileName(normalizedSelector, sourceName, commandPath)
      return { profileName: normalizedSelector }
    }

    if (normalizedSelector.indexOf(PRESET_SELECTOR_DELIMITER, separatorIndex + 1) >= 0) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid value for "${sourceName}": "${selector}" (must be "<profile>" or "<profile>:<variant>")`,
        commandPath,
      )
    }

    const profileName = normalizedSelector.slice(0, separatorIndex)
    const variantName = normalizedSelector.slice(separatorIndex + 1)
    if (profileName.length === 0 || variantName.length === 0) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid value for "${sourceName}": "${selector}" (must be "<profile>" or "<profile>:<variant>")`,
        commandPath,
      )
    }

    this.#assertPresetProfileName(profileName, sourceName, commandPath)
    this.#assertPresetVariantName(variantName, sourceName, commandPath)
    return { profileName, variantName }
  }

  #assertPresetProfileName(profileName: string, sourceName: string, commandPath: string): void {
    if (PRESET_PROFILE_NAME_REGEX.test(profileName)) {
      return
    }

    throw new CommanderError(
      'ConfigurationError',
      `invalid profile name for "${sourceName}": "${profileName}" (must match ${PRESET_PROFILE_NAME_REGEX.source})`,
      commandPath,
    )
  }

  #assertPresetVariantName(variantName: string, sourceName: string, commandPath: string): void {
    if (PRESET_VARIANT_NAME_REGEX.test(variantName)) {
      return
    }

    throw new CommanderError(
      'ConfigurationError',
      `invalid variant name for "${sourceName}": "${variantName}" (must match ${PRESET_VARIANT_NAME_REGEX.source})`,
      commandPath,
    )
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

  #validatePresetOptionTokens(tokens: string[], filepath: string, commandPath: string): void {
    if (tokens.length === 0) {
      return
    }

    if (!tokens[0].startsWith('-')) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset options in "${filepath}": bare token "${tokens[0]}" cannot appear before any option token`,
        commandPath,
      )
    }

    for (const token of tokens) {
      if (token === '--') {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset options in "${filepath}": "--" is not allowed`,
          commandPath,
        )
      }

      if (token === 'help' || token === '--help' || token === '--version') {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset options in "${filepath}": control token "${token}" is not allowed`,
          commandPath,
        )
      }

      if (
        token === PRESET_FILE_FLAG ||
        token.startsWith(`${PRESET_FILE_FLAG}=`) ||
        token === PRESET_PROFILE_FLAG ||
        token.startsWith(`${PRESET_PROFILE_FLAG}=`)
      ) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset options in "${filepath}": preset directive "${token}" is not allowed`,
          commandPath,
        )
      }
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
        throw leafCommand.#withErrorIssue(
          error,
          leafCommand.#buildErrorIssue({
            error,
            stage: 'resolve',
            scope: 'option',
            token,
          }),
        )
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
      const parseOptionsResult = cmd.#parseOptions(tokens, policy.mergedOptions, ctx.envs)
      const opts = parseOptionsResult.opts
      cmd.#applyBuiltinDevmodeLogLevel(opts, parseOptionsResult.explicitOptionLongs)
      optsMap.set(cmd, opts)
      builtinMap.set(cmd, cmd.#resolveBuiltinParsedOptions(opts))

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
   * Parse tokens into options for this command.
   */
  #parseOptions(
    tokens: ICommandToken[],
    allOptions: ICommandOptionConfig[],
    envs: Record<string, string | undefined>,
  ): IParseOptionsResult {
    const opts: ICommandParsedOpts = {}
    const explicitOptionLongs = new Set<string>()
    let sawColorToken = false

    // Initialize defaults
    for (const opt of allOptions) {
      if (opt.default !== undefined) {
        opts[opt.long] = opt.default
      } else if (opt.type === 'boolean' && opt.args === 'none') {
        opts[opt.long] = false
      } else if (opt.args === 'variadic') {
        opts[opt.long] = []
      }
    }

    // Build lookup maps
    const optionByLong = new Map<string, ICommandOptionConfig>()
    const optionByShort = new Map<string, ICommandOptionConfig>()
    for (const opt of allOptions) {
      optionByLong.set(opt.long, opt)
      if (opt.short) {
        optionByShort.set(opt.short, opt)
      }
    }

    // Process tokens
    let i = 0
    while (i < tokens.length) {
      const token = tokens[i]
      const opt =
        token.type === 'long' ? optionByLong.get(token.name) : optionByShort.get(token.name)

      if (!opt) {
        // This shouldn't happen as shift() should have filtered unknown options
        i += 1
        continue
      }

      explicitOptionLongs.add(opt.long)

      if (opt.long === 'color') {
        sawColorToken = true
      }

      // Check for negative option used on non-boolean
      const isNegativeToken = token.original.toLowerCase().startsWith('--no-')
      if (isNegativeToken && !(opt.type === 'boolean' && opt.args === 'none')) {
        throw new CommanderError(
          'NegativeOptionType',
          `"--no-${camelToKebabCase(opt.long)}" can only be used with boolean options`,
          this.#getCommandPath(),
        )
      }

      // Boolean option
      if (opt.type === 'boolean' && opt.args === 'none') {
        // Check for inline value in resolved (--foo=true/false)
        const eqIdx = token.resolved.indexOf('=')
        if (eqIdx !== -1) {
          const value = token.resolved.slice(eqIdx + 1)
          if (value === 'true') {
            opts[opt.long] = true
          } else if (value === 'false') {
            opts[opt.long] = false
          } else {
            throw new CommanderError(
              'InvalidBooleanValue',
              `invalid value "${value}" for boolean option "--${camelToKebabCase(opt.long)}". Use "true" or "false"`,
              this.#getCommandPath(),
            )
          }
        } else {
          opts[opt.long] = true
        }
        i += 1
        continue
      }

      // Required option
      if (opt.args === 'required') {
        const eqIdx = token.resolved.indexOf('=')
        let rawValue: string

        if (eqIdx !== -1) {
          rawValue = token.resolved.slice(eqIdx + 1)
        } else if (i + 1 < tokens.length && tokens[i + 1].type === 'none') {
          rawValue = tokens[i + 1].original
          i += 1
        } else {
          throw new CommanderError(
            'MissingValue',
            `option "--${camelToKebabCase(opt.long)}" requires a value`,
            this.#getCommandPath(),
          )
        }

        opts[opt.long] = this.#convertValue(opt, rawValue)
        i += 1
        continue
      }

      // Optional option
      if (opt.args === 'optional') {
        const eqIdx = token.resolved.indexOf('=')

        if (eqIdx !== -1) {
          // --long= and --long=<value>
          opts[opt.long] = this.#convertValue(opt, token.resolved.slice(eqIdx + 1))
          i += 1
          continue
        }

        // Bare --long / -s
        if (i + 1 < tokens.length && tokens[i + 1].type === 'none') {
          opts[opt.long] = this.#convertValue(opt, tokens[i + 1].original)
          i += 1
        } else {
          opts[opt.long] = undefined
        }

        i += 1
        continue
      }

      // Variadic option
      if (opt.args === 'variadic') {
        const values: unknown[] = Array.isArray(opts[opt.long]) ? (opts[opt.long] as unknown[]) : []
        const eqIdx = token.resolved.indexOf('=')

        if (eqIdx !== -1) {
          // Inline value - only take this one
          values.push(this.#convertValue(opt, token.resolved.slice(eqIdx + 1)))
        } else {
          // Greedy consume following none tokens
          while (i + 1 < tokens.length && tokens[i + 1].type === 'none') {
            i += 1
            values.push(this.#convertValue(opt, tokens[i].original))
          }
        }

        opts[opt.long] = values
        i += 1
        continue
      }

      /* c8 ignore next 2 -- option() validation guarantees args are exhausted above */
      i += 1
    }

    // Validate required options
    for (const opt of allOptions) {
      if (opt.required && !Object.prototype.hasOwnProperty.call(opts, opt.long)) {
        throw new CommanderError(
          'MissingRequired',
          `missing required option "--${camelToKebabCase(opt.long)}"`,
          this.#getCommandPath(),
        )
      }
    }

    // Validate choices
    for (const opt of allOptions) {
      if (opt.choices && opts[opt.long] !== undefined) {
        const value = opts[opt.long]
        const values = Array.isArray(value) ? value : [value]
        const choices = opt.choices as unknown[]
        for (const v of values) {
          if (!choices.includes(v)) {
            throw new CommanderError(
              'InvalidChoice',
              `invalid value "${v}" for option "--${camelToKebabCase(opt.long)}". Allowed: ${opt.choices.join(', ')}`,
              this.#getCommandPath(),
            )
          }
        }
      }
    }

    if (isNoColorEnabled(envs) && !sawColorToken && opts['color'] === true) {
      opts['color'] = false
    }

    return {
      opts,
      explicitOptionLongs,
    }
  }

  #applyBuiltinDevmodeLogLevel(opts: ICommandParsedOpts, explicitOptionLongs: Set<string>): void {
    const hasBuiltinDevmode = this.#builtin.option.devmode
    const hasBuiltinLogLevel = this.#builtin.option.logLevel && !this.#hasUserOption('logLevel')

    if (!hasBuiltinDevmode || !hasBuiltinLogLevel) {
      return
    }
    if (opts['devmode'] !== true) {
      return
    }
    if (explicitOptionLongs.has('logLevel')) {
      return
    }

    /* eslint-disable-next-line no-param-reassign */
    opts['logLevel'] = 'debug'
  }

  #resolveBuiltinParsedOptions(opts: ICommandParsedOpts): ICommandBuiltinParsedOptions {
    const builtin: ICommandBuiltinParsedOptions = {
      devmode: this.#builtin.option.devmode ? Boolean(opts['devmode']) : false,
    }

    if (this.#builtin.option.color && !this.#hasUserOption('color')) {
      builtin.color = Boolean(opts['color'])
    }
    if (this.#builtin.option.logLevel && !this.#hasUserOption('logLevel')) {
      const logLevel = opts['logLevel']
      if (typeof logLevel === 'string') {
        builtin.logLevel = logLevel
      }
    }
    if (this.#builtin.option.silent && !this.#hasUserOption('silent')) {
      builtin.silent = Boolean(opts['silent'])
    }
    if (this.#builtin.option.logDate && !this.#hasUserOption('logDate')) {
      builtin.logDate = Boolean(opts['logDate'])
    }
    if (this.#builtin.option.logColorful && !this.#hasUserOption('logColorful')) {
      builtin.logColorful = Boolean(opts['logColorful'])
    }

    return builtin
  }

  /**
   * Convert a raw string value to the appropriate type.
   */
  #convertValue(opt: ICommandOptionConfig, rawValue: string): unknown {
    // Apply coerce if present
    if (opt.coerce) {
      return opt.coerce(rawValue)
    }

    // Built-in type conversion
    if (opt.type === 'number') {
      const num = parsePrimitiveNumber(rawValue)
      if (num === undefined) {
        throw new CommanderError(
          'InvalidType',
          `invalid number "${rawValue}" for option "--${camelToKebabCase(opt.long)}"`,
          this.#getCommandPath(),
        )
      }
      return num
    }

    return rawValue
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

    error = this.#withErrorIssue(
      error,
      this.#buildErrorIssue({
        error,
        stage: 'parse',
        scope: 'command',
        source: { primary: 'user' },
      }),
    )

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
    if (opt.long === 'help' || opt.long === 'version' || opt.long === 'devmode') {
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
    const colorOption = policy.mergedOptions.find(opt => opt.long === 'color')
    let color = !isNoColorEnabled(envs)

    if (!colorOption || colorOption.type !== 'boolean' || colorOption.args !== 'none') {
      return color
    }

    const separatorIndex = tailArgv.indexOf('--')
    const scanTokens = separatorIndex === -1 ? tailArgv : tailArgv.slice(0, separatorIndex)

    for (const token of scanTokens) {
      if (token === '--color') {
        color = true
        continue
      }

      if (token === '--no-color') {
        color = false
        continue
      }

      if (!token.startsWith('--color=')) {
        continue
      }

      const value = token.slice('--color='.length)
      if (value === 'true') {
        color = true
      } else if (value === 'false') {
        color = false
      } else {
        throw new CommanderError(
          'InvalidBooleanValue',
          `invalid value "${value}" for boolean option "--color". Use "true" or "false"`,
          this.#getCommandPath(),
        )
      }
    }

    return color
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
