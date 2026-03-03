/**
 * Command class - CLI command builder with fluent API
 *
 * Execution flow: route → control-scan → run-control(run) → preset → tokenize → resolve → parse → run
 *
 * @module @guanghechen/commander
 */

import { parse as parseEnv } from '@guanghechen/env'
import type { IReporter } from '@guanghechen/reporter'
import { Reporter } from '@guanghechen/reporter'
import { TERMINAL_STYLE, styleText } from './chalk'
import { logColorfulOption, logDateOption, logLevelOption, silentOption } from './options'
import { getDefaultCommandRuntime } from './runtime'
import type {
  ICommand,
  ICommandAction,
  ICommandActionParams,
  ICommandArgumentConfig,
  ICommandBuiltinConfig,
  ICommandBuiltinOptionResolved,
  ICommandBuiltinResolved,
  ICommandConfig,
  ICommandContext,
  ICommandControlScanResult,
  ICommandControls,
  ICommandExample,
  ICommandInputSources,
  ICommandOptionConfig,
  ICommandParseResult,
  ICommandParsedArgs,
  ICommandParsedOpts,
  ICommandPresetConfig,
  ICommandPresetResult,
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

const PRESET_OPTS_FLAG = '--preset-opts'
const PRESET_ENVS_FLAG = '--preset-envs'
const PRESET_ROOT_FLAG = '--preset-root'
const DEFAULT_PRESET_OPTS_FILENAME = '.opt.local'
const DEFAULT_PRESET_ENVS_FILENAME = '.env.local'

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

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEX, '')
}

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

// ==================== Tokenize ====================

/**
 * Tokenize a single long option argument.
 * Validates format and converts kebab-case to camelCase.
 * Handles --no-xxx → --xxx=false transformation.
 */
function tokenizeLongOption(arg: string, commandPath: string): ICommandToken {
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
  }
}

/**
 * Tokenize short option(s). Handles:
 * - Single short: -v → [{ name: 'v', type: 'short' }]
 * - Combined: -abc → [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
 */
function tokenizeShortOptions(arg: string, commandPath: string): ICommandToken[] {
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
  }))
}

/**
 * Tokenize argv into ICommandToken[].
 * - Long options: validate kebab-case format, convert to camelCase
 * - --no-xxx: transform to --xxx=false
 * - Short options: expand -abc to -a -b -c
 * - Positional args: pass through unchanged
 */
function tokenize(argv: string[], commandPath: string): ICommandTokenizeResult {
  const optionTokens: ICommandToken[] = []
  const restArgs: string[] = []
  let passThrough = false

  for (const arg of argv) {
    // After '--': pass through unchanged
    if (arg === '--') {
      passThrough = true
      continue
    }

    if (passThrough) {
      restArgs.push(arg)
      continue
    }

    // Long option
    if (arg.startsWith('--')) {
      optionTokens.push(tokenizeLongOption(arg, commandPath))
      continue
    }

    // Short option(s)
    if (arg.startsWith('-') && arg.length > 1) {
      optionTokens.push(...tokenizeShortOptions(arg, commandPath))
      continue
    }

    // Positional argument (including bare '-')
    optionTokens.push({
      original: arg,
      resolved: arg,
      name: '',
      type: 'none',
    })
  }

  return { optionTokens, restArgs }
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

function createBuiltinOptionState(enabled: boolean): ICommandBuiltinOptionResolved {
  return {
    version: enabled,
    color: enabled,
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

    // Check if cmd is already registered
    const existing = this.#subcommandsList.find(e => e.command === cmd)
    if (existing) {
      if (existing.aliases.includes(name)) {
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

      // 2. RUN CONTROL
      if (ctx.controls.help) {
        const helpCommand = this.#resolveHelpCommand(leafCommand, controlScanResult.helpTarget)
        const helpColor = helpCommand.#resolveHelpColorFromTailArgv(
          controlScanResult.remaining,
          ctx.envs,
        )
        console.log(helpCommand.#formatHelpForDisplay({ color: helpColor }))
        return
      }
      if (ctx.controls.version) {
        console.log(leafCommand.#version)
        return
      }

      const optionPolicyMap = this.#buildOptionPolicyMap(chain)

      // 3. PRESET
      const presetResult = await this.#preset(controlScanResult.remaining, ctx, optionPolicyMap)
      ctx.sources = presetResult.sources
      ctx.envs = presetResult.envs

      // 4. TOKENIZE
      const tokenizeResult = tokenize(presetResult.tailArgv, leafCommand.#getCommandPath())
      const { optionTokens, restArgs } = tokenizeResult

      // 5. RESOLVE
      const resolveResult = this.#resolve(chain, optionTokens, optionPolicyMap)

      // 6. PARSE
      const parseResult = this.#parse(chain, resolveResult, optionPolicyMap, ctx, restArgs)

      // 7. RUN
      const actionParams: ICommandActionParams = {
        ctx: parseResult.ctx,
        opts: parseResult.opts,
        args: parseResult.args,
        rawArgs: parseResult.rawArgs,
      }

      if (leafCommand.#action) {
        await leafCommand.#runAction(actionParams)
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

    const optionPolicyMap = this.#buildOptionPolicyMap(chain)

    // 2. PRESET
    const presetResult = await this.#preset(controlScanResult.remaining, ctx, optionPolicyMap)
    ctx.sources = presetResult.sources
    ctx.envs = presetResult.envs

    // 3. TOKENIZE
    const tokenizeResult = tokenize(presetResult.tailArgv, leafCommand.#getCommandPath())
    const { optionTokens, restArgs } = tokenizeResult

    // 4. RESOLVE
    const resolveResult = this.#resolve(chain, optionTokens, optionPolicyMap)

    // 5. PARSE
    return this.#parse(chain, resolveResult, optionPolicyMap, ctx, restArgs)
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

    const options: IHelpOptionLine[] = []
    for (const opt of allOptions) {
      const kebabLong = camelToKebabCase(opt.long)
      let sig = opt.short ? `-${opt.short}, ` : '    '
      sig += `--${kebabLong}`
      if (opt.args !== 'none') {
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

      if (
        opt.type === 'boolean' &&
        opt.args === 'none' &&
        opt.long !== 'help' &&
        opt.long !== 'version'
      ) {
        options.push({
          sig: `    --no-${kebabLong}`,
          desc: `Negate --${kebabLong}`,
        })
      }
    }

    const commands: IHelpCommandLine[] = []
    if (this.#subcommandsList.length > 0) {
      commands.push({ name: 'help', desc: 'Show help for a command' })
    }
    for (const entry of this.#subcommandsList) {
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
    const allOptions = this.#resolveOptionPolicy().mergedOptions
    const options: ICompletionOptionMeta[] = []
    const argumentsMeta: ICompletionArgumentMeta[] = []

    for (const opt of allOptions) {
      options.push({
        long: opt.long,
        short: opt.short,
        desc: opt.desc,
        takesValue: opt.args !== 'none',
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

  // ==================== Stage 1: ROUTE ====================

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
    optionPolicyMap: Map<Command, ICommandOptionPolicy>,
  ): Promise<ICommandPresetResult & { sources: ICommandInputSources }> {
    const commandPath = (ctx.chain[ctx.chain.length - 1] as Command).#getCommandPath()
    const separatorIndex = controlTailArgv.indexOf('--')
    const beforeSeparator =
      separatorIndex === -1 ? controlTailArgv : controlTailArgv.slice(0, separatorIndex)
    const afterSeparator = separatorIndex === -1 ? [] : controlTailArgv.slice(separatorIndex + 1)

    const rootScanResult = this.#scanPresetRootDirectives(beforeSeparator, commandPath)

    const commandPreset = this.#resolveCommandPresetFromChain(ctx.chain as Command[])
    const presetRoot = await this.#resolveEffectivePresetRoot(
      rootScanResult.cliPresetRoots,
      commandPreset,
      commandPath,
    )

    const fileScanResult = this.#scanPresetFileDirectives(rootScanResult.cleanArgv, commandPath)
    const cleanArgv =
      separatorIndex === -1
        ? fileScanResult.cleanArgv
        : [...fileScanResult.cleanArgv, '--', ...afterSeparator]

    const presetOptsFiles = this.#resolvePresetFileSources({
      cliFiles: fileScanResult.cliPresetOptsFiles,
      commandPresetFile: this.#normalizeCommandPresetFile(commandPreset?.opt),
      presetRoot,
      defaultFilename: DEFAULT_PRESET_OPTS_FILENAME,
    })
    const presetEnvsFiles = this.#resolvePresetFileSources({
      cliFiles: fileScanResult.cliPresetEnvsFiles,
      commandPresetFile: this.#normalizeCommandPresetFile(commandPreset?.env),
      presetRoot,
      defaultFilename: DEFAULT_PRESET_ENVS_FILENAME,
    })

    const userSources: ICommandInputSources['user'] = {
      cmds: [...ctx.sources.user.cmds],
      argv: [...cleanArgv],
      envs: { ...ctx.sources.user.envs },
    }

    const presetArgv: string[] = []
    for (const file of presetOptsFiles) {
      const content = await this.#readPresetFile(file, commandPath)
      if (content === undefined) {
        continue
      }
      const tokens = this.#tokenizePresetOptions(content)
      this.#validatePresetOptionTokens(tokens, file.displayPath, commandPath)
      this.#assertPresetOptionFragments(
        tokens,
        file.displayPath,
        ctx.chain as Command[],
        optionPolicyMap,
      )
      presetArgv.push(...tokens)
    }

    const presetEnvs: Record<string, string> = {}
    for (const file of presetEnvsFiles) {
      const content = await this.#readPresetFile(file, commandPath)
      if (content === undefined) {
        continue
      }
      let parsed: Record<string, string>
      try {
        parsed = parseEnv(content)
      } catch (error) {
        throw new CommanderError(
          'ConfigurationError',
          `failed to parse preset envs file "${file.displayPath}": ${(error as Error).message}`,
          commandPath,
        )
      }
      Object.assign(presetEnvs, parsed)
    }

    const sources: ICommandInputSources = {
      user: userSources,
      preset: {
        argv: presetArgv,
        envs: presetEnvs,
      },
    }

    const envs = { ...sources.user.envs, ...sources.preset.envs }
    const tailArgv = [...sources.preset.argv, ...sources.user.argv]

    return { tailArgv, envs, sources }
  }

  #resolveCommandPresetFromChain(chain: Command[]): ICommandPresetConfig | undefined {
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const preset = chain[index].#presetConfig
      if (preset?.root !== undefined) {
        return preset
      }
    }

    return undefined
  }

  async #resolveEffectivePresetRoot(
    cliPresetRoots: string[],
    commandPreset: ICommandPresetConfig | undefined,
    commandPath: string,
  ): Promise<string | undefined> {
    if (cliPresetRoots.length > 0) {
      const root = cliPresetRoots[cliPresetRoots.length - 1]
      return await this.#assertPresetRoot(root, PRESET_ROOT_FLAG, commandPath)
    }

    if (commandPreset?.root === undefined) {
      return undefined
    }

    return await this.#assertPresetRoot(commandPreset.root, 'command.preset.root', commandPath)
  }

  async #assertPresetRoot(root: string, sourceName: string, commandPath: string): Promise<string> {
    if (!this.#runtime.isAbsolute(root)) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset root from "${sourceName}": "${root}" is not an absolute directory`,
        commandPath,
      )
    }

    let stats
    try {
      stats = await this.#runtime.stat(root)
    } catch (error) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset root from "${sourceName}": "${root}" cannot be accessed (${(error as Error).message})`,
        commandPath,
      )
    }

    if (!stats.isDirectory()) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset root from "${sourceName}": "${root}" is not a directory`,
        commandPath,
      )
    }

    return root
  }

  #normalizeCommandPresetFile(filepath: string | undefined): string | undefined {
    if (filepath === undefined) {
      return undefined
    }

    if (!this.#isValidPresetFileValue(filepath)) {
      return undefined
    }

    return filepath
  }

  #resolvePresetFileSources(params: {
    cliFiles: string[]
    commandPresetFile: string | undefined
    presetRoot: string | undefined
    defaultFilename: string
  }): IPresetFileSource[] {
    const { cliFiles, commandPresetFile, presetRoot, defaultFilename } = params

    if (cliFiles.length > 0) {
      return cliFiles.map(filepath => ({
        displayPath: filepath,
        absolutePath: this.#resolvePresetFileAbsolutePath(filepath, presetRoot),
        explicit: true,
      }))
    }

    if (presetRoot === undefined) {
      return []
    }

    if (commandPresetFile !== undefined) {
      return [
        {
          displayPath: commandPresetFile,
          absolutePath: this.#resolvePresetFileAbsolutePath(commandPresetFile, presetRoot),
          explicit: true,
        },
      ]
    }

    const absolutePath = this.#runtime.resolve(presetRoot, defaultFilename)
    return [
      {
        displayPath: absolutePath,
        absolutePath,
        explicit: false,
      },
    ]
  }

  #resolvePresetFileAbsolutePath(filepath: string, presetRoot: string | undefined): string {
    if (this.#runtime.isAbsolute(filepath)) {
      return filepath
    }

    if (presetRoot !== undefined) {
      return this.#runtime.resolve(presetRoot, filepath)
    }

    return this.#runtime.resolve(this.#runtime.cwd(), filepath)
  }

  #assertPresetOptionFragments(
    tokens: string[],
    filepath: string,
    chain: Command[],
    optionPolicyMap: Map<Command, ICommandOptionPolicy>,
  ): void {
    if (tokens.length === 0) {
      return
    }

    const commandPath = chain[chain.length - 1].#getCommandPath()

    try {
      const { optionTokens, restArgs } = tokenize(tokens, commandPath)
      void restArgs

      const { argTokens } = this.#resolve(chain, optionTokens, optionPolicyMap)
      if (argTokens.length > 0) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset options in "${filepath}": token "${argTokens[0].original}" cannot be resolved as an option fragment`,
          commandPath,
        )
      }
    } catch (error) {
      if (error instanceof CommanderError) {
        if (error.kind === 'ConfigurationError') {
          throw error
        }

        throw new CommanderError(
          'ConfigurationError',
          `invalid preset options in "${filepath}": ${error.message}`,
          commandPath,
        )
      }

      throw error
    }
  }

  #scanPresetRootDirectives(
    argv: string[],
    commandPath: string,
  ): { cleanArgv: string[]; cliPresetRoots: string[] } {
    const cleanArgv: string[] = []
    const cliPresetRoots: string[] = []

    let index = 0
    while (index < argv.length) {
      const token = argv[index]

      if (token === PRESET_ROOT_FLAG) {
        const value = argv[index + 1]
        if (value === undefined || value.length === 0) {
          throw new CommanderError(
            'ConfigurationError',
            `missing value for "${PRESET_ROOT_FLAG}"`,
            commandPath,
          )
        }
        cliPresetRoots.push(value)
        index += 2
        continue
      }

      if (token.startsWith(`${PRESET_ROOT_FLAG}=`)) {
        const value = token.slice(PRESET_ROOT_FLAG.length + 1)
        if (value.length === 0) {
          throw new CommanderError(
            'ConfigurationError',
            `missing value for "${PRESET_ROOT_FLAG}"`,
            commandPath,
          )
        }
        cliPresetRoots.push(value)
        index += 1
        continue
      }

      cleanArgv.push(token)
      index += 1
    }

    return { cleanArgv, cliPresetRoots }
  }

  #scanPresetFileDirectives(
    argv: string[],
    commandPath: string,
  ): { cleanArgv: string[]; cliPresetOptsFiles: string[]; cliPresetEnvsFiles: string[] } {
    const cleanArgv: string[] = []
    const cliPresetOptsFiles: string[] = []
    const cliPresetEnvsFiles: string[] = []

    const assertAndPush = (
      flag: typeof PRESET_OPTS_FLAG | typeof PRESET_ENVS_FLAG,
      value: string,
    ): void => {
      this.#assertPresetFileValue(value, flag, commandPath)
      if (flag === PRESET_OPTS_FLAG) {
        cliPresetOptsFiles.push(value)
      } else {
        cliPresetEnvsFiles.push(value)
      }
    }

    let index = 0
    while (index < argv.length) {
      const token = argv[index]

      if (token === PRESET_OPTS_FLAG || token === PRESET_ENVS_FLAG) {
        const value = argv[index + 1]
        if (value === undefined || value.length === 0) {
          throw new CommanderError(
            'ConfigurationError',
            `missing value for "${token}"`,
            commandPath,
          )
        }
        assertAndPush(token, value)
        index += 2
        continue
      }

      if (token.startsWith(`${PRESET_OPTS_FLAG}=`)) {
        const value = token.slice(PRESET_OPTS_FLAG.length + 1)
        if (value.length === 0) {
          throw new CommanderError(
            'ConfigurationError',
            `missing value for "${PRESET_OPTS_FLAG}"`,
            commandPath,
          )
        }
        assertAndPush(PRESET_OPTS_FLAG, value)
        index += 1
        continue
      }

      if (token.startsWith(`${PRESET_ENVS_FLAG}=`)) {
        const value = token.slice(PRESET_ENVS_FLAG.length + 1)
        if (value.length === 0) {
          throw new CommanderError(
            'ConfigurationError',
            `missing value for "${PRESET_ENVS_FLAG}"`,
            commandPath,
          )
        }
        assertAndPush(PRESET_ENVS_FLAG, value)
        index += 1
        continue
      }

      cleanArgv.push(token)
      index += 1
    }

    return { cleanArgv, cliPresetOptsFiles, cliPresetEnvsFiles }
  }

  #isValidPresetFileValue(filepath: string): boolean {
    return filepath.length > 0 && !filepath.startsWith('..')
  }

  #assertPresetFileValue(
    filepath: string,
    directive: typeof PRESET_OPTS_FLAG | typeof PRESET_ENVS_FLAG,
    commandPath: string,
  ): void {
    if (this.#isValidPresetFileValue(filepath)) {
      return
    }

    throw new CommanderError(
      'ConfigurationError',
      `invalid value for "${directive}": "${filepath}" (must be non-empty and must not start with "..")`,
      commandPath,
    )
  }

  async #readPresetFile(file: IPresetFileSource, commandPath: string): Promise<string | undefined> {
    try {
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

  #tokenizePresetOptions(content: string): string[] {
    return content
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length > 0)
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
        token === PRESET_ROOT_FLAG ||
        token.startsWith(`${PRESET_ROOT_FLAG}=`) ||
        token === PRESET_OPTS_FLAG ||
        token.startsWith(`${PRESET_OPTS_FLAG}=`) ||
        token === PRESET_ENVS_FLAG ||
        token.startsWith(`${PRESET_ENVS_FLAG}=`)
      ) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset options in "${filepath}": preset directive "${token}" is not allowed`,
          commandPath,
        )
      }
    }
  }

  // ==================== Stage 3: RESOLVE ====================

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
        throw new CommanderError(
          'UnknownOption',
          `unknown option "${token.original}" for command "${leafCommand.#getCommandPath()}"`,
          leafCommand.#getCommandPath(),
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
          // Consume additional tokens for required/variadic
          if (opt.args === 'required') {
            // Check for inline value (--foo=bar)
            if (!token.resolved.includes('=') && i + 1 < tokens.length) {
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
          // Consume additional tokens for required/variadic
          if (opt.args === 'required') {
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

  // ==================== Stage 4: PARSE ====================

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

    for (const cmd of chain) {
      const policy = this.#mustGetOptionPolicy(optionPolicyMap, cmd)
      const tokens = consumedTokens.get(cmd) ?? []
      const opts = cmd.#parseOptions(tokens, policy.mergedOptions, ctx.envs)
      optsMap.set(cmd, opts)

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

    // Parse arguments
    const rawArgStrings = [...argTokens.map(t => t.original), ...restArgs]
    const { args, rawArgs } = leafCommand.#parseArguments(rawArgStrings)

    const parseCtx: ICommandContext = {
      ...ctx,
      sources: this.#freezeInputSources(ctx.sources),
    }

    return { ctx: parseCtx, opts: leafLocalOpts, args, rawArgs }
  }

  /**
   * Parse tokens into options for this command.
   */
  #parseOptions(
    tokens: ICommandToken[],
    allOptions: ICommandOptionConfig[],
    envs: Record<string, string | undefined>,
  ): ICommandParsedOpts {
    const opts: ICommandParsedOpts = {}
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

      i += 1
    }

    // Validate required options
    for (const opt of allOptions) {
      if (opt.required && opts[opt.long] === undefined) {
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

    return opts
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
        if (rest.length === 0) {
          throw new CommanderError(
            'MissingRequiredArgument',
            `missing required argument(s): ${def.name}`,
            this.#getCommandPath(),
          )
        }
        args[def.name] = rest.map(raw => this.#convertArgument(def, raw))
        index = rawArgs.length
        break
      }

      const raw = rawArgs[index]
      if (raw === undefined) {
        if (def.kind === 'optional') {
          args[def.name] = def.default ?? undefined
          continue
        }
        throw new CommanderError(
          'MissingRequiredArgument',
          `missing required argument(s): ${def.name}`,
          this.#getCommandPath(),
        )
      } else {
        args[def.name] = this.#convertArgument(def, raw)
        index += 1
      }
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
    const policy = optionPolicyMap.get(cmd)
    if (policy !== undefined) {
      return policy
    }

    throw new CommanderError(
      'ConfigurationError',
      `missing option policy for command "${cmd.#getCommandPath()}"`,
      this.#getCommandPath(),
    )
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
    if (opt.long === 'help' || opt.long === 'version') {
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
        `${opt.type} option "--${opt.long}" must have args: 'required' or 'variadic'`,
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
      if (err instanceof Error) {
        console.error(`Error: ${err.message}`)
      } else {
        console.error('Error: action failed')
      }
      process.exit(1)
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
        argv: Object.freeze([...sources.preset.argv]),
        envs: Object.freeze({ ...sources.preset.envs }),
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
