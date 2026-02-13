/**
 * Command class - CLI command builder with fluent API
 *
 * Execution flow: route → tokenize → resolve → parse → run
 *
 * @module @guanghechen/commander
 */

import type {
  ICommand,
  ICommandAction,
  ICommandActionParams,
  ICommandArgumentConfig,
  ICommandContext,
  ICommandOptionConfig,
  ICommandParseResult,
  ICommandParsedArgs,
  ICommandParsedOpts,
  ICommandResolveResult,
  ICommandRunParams,
  ICommandShiftResult,
  ICommandToken,
  ICommandTokenizeResult,
  ICompletionMeta,
  ICompletionOptionMeta,
  IReporter,
} from './types'
import { CommanderError } from './types'

// ==================== Default Reporter ====================

class DefaultReporter implements IReporter {
  public debug(message: string, ...args: unknown[]): void {
    console.debug(message, ...args)
  }
  public info(message: string, ...args: unknown[]): void {
    console.info(message, ...args)
  }
  public warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args)
  }
  public error(message: string, ...args: unknown[]): void {
    console.error(message, ...args)
  }
}

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
  short: 'h',
  type: 'boolean',
  args: 'none',
  description: 'Show help information',
}

const BUILTIN_VERSION_OPTION: ICommandOptionConfig = {
  long: 'version',
  short: 'V',
  type: 'boolean',
  args: 'none',
  description: 'Show version number',
}

// ==================== Command Configuration ====================

interface ICommandConfigInternal {
  name?: string
  description: string
  version?: string
  help?: boolean
  reporter?: IReporter
}

/** Subcommand registration entry (internal) */
interface ISubcommandEntry {
  name: string
  aliases: string[]
  command: Command
}

/** Internal route result with Command[] */
interface IInternalRouteResult {
  chain: Command[]
  remaining: string[]
}

// ==================== Command Class ====================

export class Command implements ICommand {
  #name: string
  readonly #description: string
  readonly #version: string | undefined
  readonly #helpSubcommandEnabled: boolean
  readonly #reporter: IReporter | undefined
  #parent: Command | undefined

  readonly #options: ICommandOptionConfig[] = []
  readonly #arguments: ICommandArgumentConfig[] = []
  readonly #subcommandsList: ISubcommandEntry[] = []
  readonly #subcommandsMap = new Map<string, Command>()
  #action: ICommandAction | undefined = undefined

  constructor(config: ICommandConfigInternal) {
    this.#name = config.name ?? ''
    this.#description = config.description
    this.#version = config.version
    this.#helpSubcommandEnabled = config.help ?? false
    this.#reporter = config.reporter
  }

  // ==================== ICommand Properties ====================

  public get name(): string | undefined {
    return this.#name || undefined
  }

  public get description(): string {
    return this.#description
  }

  public get version(): string | undefined {
    return this.#version
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

  // ==================== Assembly Methods ====================

  public subcommand(name: string, cmd: Command): this {
    // Check for reserved name conflict
    if (this.#helpSubcommandEnabled && name === 'help') {
      throw new CommanderError(
        'ConfigurationError',
        '"help" is a reserved subcommand name when help subcommand is enabled',
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
      // 0. Handle "help <subcommand>" syntax if enabled
      const processedArgv = this.#processHelpSubcommand(argv)

      // 1. ROUTE: determine command chain
      const routeResult = this.#route(processedArgv)
      const { chain, remaining } = routeResult
      const leafCommand = chain[chain.length - 1]
      const rootCommand = chain[0]

      // 2. TOKENIZE: remaining → ICommandToken[]
      const tokenizeResult = tokenize(remaining, leafCommand.#getCommandPath())
      const { optionTokens, restArgs } = tokenizeResult

      // 3. Check for built-in --help / --version BEFORE parsing
      const hasUserHelp = leafCommand.#options.some(o => o.long === 'help')
      const hasUserVersion = leafCommand.#options.some(o => o.long === 'version')

      if (!hasUserHelp && this.#hasFlag(optionTokens, 'help', 'h')) {
        console.log(leafCommand.formatHelp())
        return
      }

      if (!hasUserVersion && leafCommand === rootCommand && leafCommand.#version) {
        if (this.#hasFlag(optionTokens, 'version', 'V')) {
          console.log(leafCommand.#version)
          return
        }
      }

      // 4. RESOLVE: bottom-up option consumption
      const resolveResult = this.#resolve(chain, optionTokens)

      // 5. Build context
      const ctx: ICommandContext = {
        cmd: leafCommand,
        envs,
        reporter: reporter ?? this.#reporter ?? new DefaultReporter(),
        argv,
      }

      // 6. PARSE: top-down tokens → opts, call apply
      const parseResult = this.#parse(chain, resolveResult, ctx, restArgs)

      // 7. RUN: execute leaf command action
      const actionParams: ICommandActionParams = {
        ctx: parseResult.ctx,
        opts: parseResult.opts,
        args: parseResult.args,
        rawArgs: parseResult.rawArgs,
      }

      if (leafCommand.#action) {
        await leafCommand.#runAction(actionParams)
      } else if (leafCommand.#subcommandsList.length > 0) {
        console.log(leafCommand.formatHelp())
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

  public parse(params: ICommandRunParams): ICommandParseResult {
    const { argv, envs, reporter } = params

    // 0. Handle "help <subcommand>" syntax if enabled
    const processedArgv = this.#processHelpSubcommand(argv)

    // 1. ROUTE
    const routeResult = this.#route(processedArgv)
    const { chain, remaining } = routeResult
    const leafCommand = chain[chain.length - 1]

    // 2. TOKENIZE
    const tokenizeResult = tokenize(remaining, leafCommand.#getCommandPath())
    const { optionTokens, restArgs } = tokenizeResult

    // 3. RESOLVE
    const resolveResult = this.#resolve(chain, optionTokens)

    // 4. Build context
    const ctx: ICommandContext = {
      cmd: leafCommand,
      envs,
      reporter: reporter ?? this.#reporter ?? new DefaultReporter(),
      argv,
    }

    // 5. PARSE
    return this.#parse(chain, resolveResult, ctx, restArgs)
  }

  public formatHelp(): string {
    const lines: string[] = []
    const allOptions = this.#getMergedOptions()

    // Description
    lines.push(this.#description)
    lines.push('')

    // Usage line
    const commandPath = this.#getCommandPath()
    let usage = `Usage: ${commandPath}`
    if (allOptions.length > 0) usage += ' [options]'
    if (this.#subcommandsList.length > 0) usage += ' [command]'
    for (const arg of this.#arguments) {
      if (arg.kind === 'required') {
        usage += ` <${arg.name}>`
      } else if (arg.kind === 'optional') {
        usage += ` [${arg.name}]`
      } else {
        usage += ` [${arg.name}...]`
      }
    }
    lines.push(usage)
    lines.push('')

    // Options
    if (allOptions.length > 0) {
      lines.push('Options:')
      const optLines: Array<{ sig: string; desc: string }> = []

      for (const opt of allOptions) {
        const kebabLong = camelToKebabCase(opt.long)
        let sig = opt.short ? `-${opt.short}, ` : '    '
        sig += `--${kebabLong}`
        if (opt.args !== 'none') {
          sig += ' <value>'
        }

        let desc = opt.description
        if (opt.default !== undefined && opt.type !== 'boolean') {
          desc += ` (default: ${JSON.stringify(opt.default)})`
        }
        if (opt.choices) {
          desc += ` [choices: ${opt.choices.join(', ')}]`
        }

        optLines.push({ sig, desc })

        // Add --no-{kebab-long} for boolean options
        if (opt.type === 'boolean' && opt.args === 'none') {
          optLines.push({
            sig: `    --no-${kebabLong}`,
            desc: `Negate --${kebabLong}`,
          })
        }
      }

      const maxSigLen = Math.max(...optLines.map(l => l.sig.length))
      for (const { sig, desc } of optLines) {
        const padding = ' '.repeat(maxSigLen - sig.length + 2)
        lines.push(`  ${sig}${padding}${desc}`)
      }
      lines.push('')
    }

    // Commands
    const showHelpSubcommand = this.#helpSubcommandEnabled && this.#subcommandsList.length > 0
    if (this.#subcommandsList.length > 0) {
      lines.push('Commands:')
      const cmdLines: Array<{ name: string; desc: string }> = []

      // Add help subcommand if enabled and has subcommands
      if (showHelpSubcommand) {
        cmdLines.push({ name: 'help', desc: 'Show help for a command' })
      }

      for (const entry of this.#subcommandsList) {
        let name = entry.name
        if (entry.aliases.length > 0) {
          name += `, ${entry.aliases.join(', ')}`
        }
        cmdLines.push({ name, desc: entry.command.#description })
      }
      const maxNameLen = Math.max(...cmdLines.map(l => l.name.length))
      for (const { name, desc } of cmdLines) {
        const padding = ' '.repeat(maxNameLen - name.length + 2)
        lines.push(`  ${name}${padding}${desc}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  public getCompletionMeta(): ICompletionMeta {
    const allOptions = this.#getMergedOptions()
    const options: ICompletionOptionMeta[] = []

    for (const opt of allOptions) {
      options.push({
        long: opt.long,
        short: opt.short,
        description: opt.description,
        takesValue: opt.args !== 'none',
        choices: opt.choices as string[] | undefined,
      })
    }

    return {
      name: this.#name,
      description: this.#description,
      aliases: [],
      options,
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

  #processHelpSubcommand(argv: string[]): string[] {
    if (!this.#helpSubcommandEnabled) return argv
    if (argv.length < 1 || argv[0] !== 'help') return argv

    if (argv.length === 1 || this.#subcommandsList.length === 0) {
      return ['--help']
    }

    const subName = argv[1]
    const entry = this.#subcommandsList.find(e => e.name === subName || e.aliases.includes(subName))
    if (entry) {
      return [subName, '--help', ...argv.slice(2)]
    }

    return argv
  }

  /**
   * Route and return the full command chain (root → leaf).
   */
  #route(argv: string[]): IInternalRouteResult {
    const chain: Command[] = [this]
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: Command = this
    let idx = 0

    while (idx < argv.length) {
      const token = argv[idx]

      // Stop routing on option-like token
      if (token.startsWith('-')) break

      // Try to match subcommand
      const entry = current.#subcommandsList.find(
        e => e.name === token || e.aliases.includes(token),
      )
      if (!entry) break

      current = entry.command
      chain.push(current)
      idx += 1
    }

    return { chain, remaining: argv.slice(idx) }
  }

  // ==================== Stage 3: RESOLVE ====================

  /**
   * Resolve: bottom-up option consumption through command chain.
   */
  #resolve(chain: Command[], tokens: ICommandToken[]): ICommandResolveResult {
    const consumedTokens = new Map<Command, ICommandToken[]>()
    let remaining = [...tokens]

    // Build shadowed set: options defined by child commands
    const shadowed = new Set<string>()

    // Process from leaf to root
    for (let i = chain.length - 1; i >= 0; i--) {
      const cmd = chain[i]
      const includeVersion = i === 0 // Only root includes --version

      const result = cmd.#shift(remaining, shadowed, includeVersion)
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
    includeVersion: boolean,
  ): ICommandShiftResult {
    const allOptions = this.#getMergedOptions(includeVersion)
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
    ctx: ICommandContext,
    restArgs: string[],
  ): ICommandParseResult {
    const { consumedTokens, argTokens } = resolveResult
    const leafCommand = chain[chain.length - 1]

    // Validate merged short options
    this.#validateMergedShortOptions(chain)

    // Parse options for each command in chain (top-down)
    const optsMap = new Map<Command, ICommandParsedOpts>()

    for (let i = 0; i < chain.length; i++) {
      const cmd = chain[i]
      const includeVersion = i === 0
      const tokens = consumedTokens.get(cmd) ?? []
      const opts = cmd.#parseOptions(tokens, includeVersion)
      optsMap.set(cmd, opts)

      // Call apply callbacks
      for (const opt of cmd.#getMergedOptions(includeVersion)) {
        if (opt.apply && opts[opt.long] !== undefined) {
          opt.apply(opts[opt.long], ctx)
        }
      }
    }

    // Merge options (root → leaf)
    const mergedOpts: ICommandParsedOpts = {}
    for (const cmd of chain) {
      Object.assign(mergedOpts, optsMap.get(cmd) ?? {})
    }

    // Parse arguments
    const rawArgStrings = [...argTokens.map(t => t.original), ...restArgs]
    const { args, rawArgs } = leafCommand.#parseArguments(rawArgStrings)

    return { ctx, opts: mergedOpts, args, rawArgs }
  }

  /**
   * Parse tokens into options for this command.
   */
  #parseOptions(tokens: ICommandToken[], includeVersion: boolean): ICommandParsedOpts {
    const allOptions = this.#getMergedOptions(includeVersion)
    const opts: ICommandParsedOpts = {}

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
      const num = Number(rawValue)
      if (Number.isNaN(num)) {
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
    const requiredCount = argumentDefs.filter(a => a.kind === 'required').length
    if (rawArgs.length < requiredCount) {
      const missing = argumentDefs
        .filter(a => a.kind === 'required')
        .slice(rawArgs.length)
        .map(a => a.name)
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

      const raw = rawArgs[index]
      if (raw === undefined) {
        if (def.kind === 'optional') {
          args[def.name] = def.default ?? undefined
          continue
        }
      } else {
        args[def.name] = this.#convertArgument(def, raw)
        index += 1
      }
    }

    // Too many arguments check (non-variadic)
    const hasVariadic = argumentDefs.some(a => a.kind === 'variadic')
    if (!hasVariadic && index < rawArgs.length) {
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
    if (def.coerce) {
      try {
        return def.coerce(raw)
      } catch {
        throw new CommanderError(
          'InvalidType',
          `invalid value "${raw}" for argument "${def.name}"`,
          this.#getCommandPath(),
        )
      }
    }

    if (def.type === 'number') {
      const n = Number(raw)
      if (Number.isNaN(n)) {
        throw new CommanderError(
          'InvalidType',
          `invalid number "${raw}" for argument "${def.name}"`,
          this.#getCommandPath(),
        )
      }
      return n
    }

    return raw
  }

  // ==================== Private: Option Merging ====================

  #getMergedOptions(includeVersion = !this.#parent): ICommandOptionConfig[] {
    const optionMap = new Map<string, ICommandOptionConfig>()

    // Add built-in options first (can be overridden)
    const hasUserHelp = this.#options.some(o => o.long === 'help')
    const hasUserVersion = this.#options.some(o => o.long === 'version')

    if (!hasUserHelp) {
      optionMap.set('help', BUILTIN_HELP_OPTION)
    }
    if (!hasUserVersion && includeVersion) {
      optionMap.set('version', BUILTIN_VERSION_OPTION)
    }

    // Add this command's options
    for (const opt of this.#options) {
      optionMap.set(opt.long, opt)
    }

    return Array.from(optionMap.values())
  }

  #validateMergedShortOptions(chain: Command[]): void {
    const mergedByLong = new Map<string, ICommandOptionConfig>()

    for (let i = 0; i < chain.length; i++) {
      const cmd = chain[i]
      const includeVersion = i === 0
      for (const opt of cmd.#getMergedOptions(includeVersion)) {
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
    if (arg.kind === 'required' && arg.default !== undefined) {
      throw new CommanderError(
        'ConfigurationError',
        `required argument "${arg.name}" cannot have a default value`,
        this.#getCommandPath(),
      )
    }

    if (arg.kind === 'variadic') {
      if (this.#arguments.some(a => a.kind === 'variadic')) {
        throw new CommanderError(
          'ConfigurationError',
          'only one variadic argument is allowed',
          this.#getCommandPath(),
        )
      }
    }

    if (this.#arguments.length > 0) {
      const last = this.#arguments[this.#arguments.length - 1]
      if (last.kind === 'variadic') {
        throw new CommanderError(
          'ConfigurationError',
          'variadic argument must be the last argument',
          this.#getCommandPath(),
        )
      }
    }

    if (arg.kind === 'required') {
      const hasOptional = this.#arguments.some(a => a.kind === 'optional' || a.kind === 'variadic')
      if (hasOptional) {
        throw new CommanderError(
          'ConfigurationError',
          `required argument "${arg.name}" cannot come after optional/variadic arguments`,
          this.#getCommandPath(),
        )
      }
    }
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

  #hasFlag(tokens: ICommandToken[], longName: string, shortName: string): boolean {
    for (const token of tokens) {
      if (token.type === 'long' && token.name === longName) {
        return true
      }
      if (token.type === 'short' && token.name === shortName) {
        return true
      }
    }
    return false
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
