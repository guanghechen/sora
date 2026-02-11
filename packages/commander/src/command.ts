/**
 * Command class - CLI command builder with fluent API
 *
 * @module @guanghechen/commander
 */

import type {
  IAction,
  IActionParams,
  IArgument,
  ICommand,
  ICommandConfig,
  ICommandContext,
  ICompletionMeta,
  ICompletionOptionMeta,
  IOption,
  IParseResult,
  IReporter,
  IRunParams,
  IShiftResult,
  ISubcommandEntry,
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

// ==================== Built-in Options ====================

const BUILTIN_HELP_OPTION: IOption = {
  long: 'help',
  short: 'h',
  type: 'boolean',
  description: 'Show help information',
}

const BUILTIN_VERSION_OPTION: IOption = {
  long: 'version',
  short: 'V',
  type: 'boolean',
  description: 'Show version number',
}

// ==================== Command Class ====================

export class Command implements ICommand {
  #name: string
  readonly #description: string
  readonly #version: string | undefined
  readonly #helpSubcommandEnabled: boolean
  readonly #reporter: IReporter | undefined
  #parent: Command | undefined

  #options: IOption[] = []
  #arguments: IArgument[] = []
  #subcommands: ISubcommandEntry[] = []
  #action: IAction | undefined

  constructor(config: ICommandConfig) {
    this.#name = config.name ?? ''
    this.#description = config.description
    this.#version = config.version
    this.#helpSubcommandEnabled = config.help ?? false
    this.#reporter = config.reporter
  }

  // ==================== Properties ====================

  public get name(): string {
    return this.#name
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

  public get options(): IOption[] {
    return [...this.#options]
  }

  public get arguments(): IArgument[] {
    return [...this.#arguments]
  }

  // ==================== Definition Methods ====================

  public option(opt: IOption): this {
    this.#validateOptionConfig(opt)
    this.#checkOptionUniqueness(opt)
    this.#options.push(opt)
    return this
  }

  public argument(arg: IArgument): this {
    this.#validateArgumentConfig(arg)
    this.#arguments.push(arg)
    return this
  }

  public action(fn: IAction): this {
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
    const existing = this.#subcommands.find(e => e.command === cmd)
    if (existing) {
      // Add name as alias
      existing.aliases.push(name)
    } else {
      // New registration
      /* eslint-disable no-param-reassign */
      cmd.#name = name
      cmd.#parent = this
      /* eslint-enable no-param-reassign */
      this.#subcommands.push({ name, aliases: [], command: cmd })
    }
    return this
  }

  // ==================== Execution Methods ====================

  public async run(params: IRunParams): Promise<void> {
    const { argv, envs, reporter } = params

    try {
      // 0. Handle "help <subcommand>" syntax if enabled
      const processedArgv = this.#processHelpSubcommand(argv)

      // 1. Route: determine command chain
      const { chain, remaining } = this.#routeChain(processedArgv)
      const leafCommand = chain[chain.length - 1]
      const rootCommand = chain[0]
      const includeRootVersion = chain.length === 1

      this.#validateMergedShortOptions(chain, includeRootVersion)

      // 2. Split options and arguments at '--'
      const { optionTokens, restArgs } = this.#splitAtDoubleDash(remaining)

      // 3. Check for built-in --help / --version BEFORE parsing
      const leafOptions = leafCommand.#getMergedOptions(leafCommand === rootCommand)
      const hasUserHelp = leafCommand.#options.some(o => o.long === 'help')
      const hasUserVersion = leafCommand.#options.some(o => o.long === 'version')

      if (!hasUserHelp && leafCommand.#hasHelpFlag(optionTokens, leafOptions)) {
        console.log(leafCommand.formatHelp())
        return
      }

      if (!hasUserVersion && leafCommand === rootCommand) {
        if (leafCommand.#hasVersionFlag(optionTokens, leafOptions)) {
          console.log(leafCommand.version ?? 'unknown')
          return
        }
      }

      // 4. Shift: bottom-up option consumption
      const { optsMap, positionalArgs } = this.#shiftChain(chain, optionTokens, includeRootVersion)

      // 5. Build context
      const ctx: ICommandContext = {
        cmd: leafCommand,
        envs,
        reporter: reporter ?? this.#reporter ?? new DefaultReporter(),
        argv,
      }

      // 6. Apply: top-down context building
      this.#applyChain(chain, optsMap, ctx)

      // 7. Merge options (root → leaf, later overwrites earlier)
      const mergedOpts = this.#mergeOpts(chain, optsMap)

      // 8. Parse arguments (combine positional args from before '--' with args after '--')
      const allArgs = [...positionalArgs, ...restArgs]
      const { args, rawArgs } = leafCommand.#parseArguments(allArgs)

      // 9. Execute action
      const actionParams: IActionParams = { ctx, opts: mergedOpts, args, rawArgs }

      if (leafCommand.#action) {
        try {
          await leafCommand.#action(actionParams)
        } catch (err) {
          if (err instanceof Error) {
            console.error(`Error: ${err.message}`)
          } else {
            console.error('Error: action failed')
          }
          process.exit(1)
        }
      } else if (leafCommand.#subcommands.length > 0) {
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

  public parse(argv: string[]): IParseResult {
    const processedArgv = this.#processHelpSubcommand(argv)
    const { chain, remaining } = this.#routeChain(processedArgv)
    const leafCommand = chain[chain.length - 1]
    const includeRootVersion = chain.length === 1

    this.#validateMergedShortOptions(chain, includeRootVersion)

    // Split options and arguments at '--'
    const { optionTokens, restArgs } = this.#splitAtDoubleDash(remaining)

    // Shift: bottom-up option consumption
    const { optsMap, positionalArgs } = this.#shiftChain(chain, optionTokens, includeRootVersion)

    // Merge options (root → leaf, later overwrites earlier)
    const mergedOpts = this.#mergeOpts(chain, optsMap)

    // Parse arguments (combine positional args from before '--' with args after '--')
    const allArgs = [...positionalArgs, ...restArgs]
    const { args, rawArgs } = leafCommand.#parseArguments(allArgs)

    return { opts: mergedOpts, args, rawArgs }
  }

  /**
   * Shift options from tokens that this command recognizes.
   * Unrecognized tokens are returned in `remaining` for parent commands.
   */
  public shift(tokens: string[]): IShiftResult {
    return this.#shiftWithShadowed(tokens, new Set())
  }

  /**
   * Shift options with shadowed set support.
   * Options in the shadowed set are excluded from processing.
   */
  #shiftWithShadowed(
    tokens: string[],
    shadowed: Set<string>,
    includeVersion = !this.#parent,
  ): IShiftResult {
    const allDirectOptions = this.#getMergedOptions(includeVersion)
    // Filter out shadowed options (already handled by child commands)
    const directOptions = allDirectOptions.filter(o => !shadowed.has(o.long))
    const opts: Record<string, unknown> = {}

    // Initialize defaults for effective options only
    for (const opt of directOptions) {
      if (opt.default !== undefined) {
        opts[opt.long] = opt.default
      } else if (opt.type === 'boolean') {
        opts[opt.long] = false
      } else if (opt.type === 'string[]' || opt.type === 'number[]') {
        opts[opt.long] = []
      }
    }

    // Process resolver options first (only non-shadowed)
    let remaining = [...tokens]
    const resolverOptions = directOptions.filter(o => o.resolver)
    for (const opt of resolverOptions) {
      const result = opt.resolver!(remaining)
      opts[opt.long] = result.value
      remaining = result.remaining
    }

    // Build option maps (excluding resolver options)
    const { optionByLong, optionByShort, booleanOptions } = this.#buildOptionMaps(
      directOptions,
      true,
    )

    // Normalize --no-* to --*=false
    const normalizedTokens = this.#normalizeArgv(remaining, booleanOptions)

    const finalRemaining: string[] = []
    let i = 0
    while (i < normalizedTokens.length) {
      const token = normalizedTokens[i]

      // Long option
      if (token.startsWith('--')) {
        const consumed = this.#tryConsumeLongOption(normalizedTokens, i, optionByLong, opts)
        if (consumed > 0) {
          i += consumed
          continue
        }
        // Unknown option - pass to parent
        finalRemaining.push(token)
        i += 1
        continue
      }

      // Short option
      if (token.startsWith('-') && token.length > 1) {
        const result = this.#tryConsumeShortOption(normalizedTokens, i, optionByShort, opts)
        if (result.consumed) {
          i = result.nextIdx
          if (result.remainingToken) {
            finalRemaining.push(result.remainingToken)
          }
          continue
        }
        // Unknown option - pass to parent
        finalRemaining.push(token)
        i += 1
        continue
      }

      // Non-option token
      finalRemaining.push(token)
      i += 1
    }

    // Validate required options (only for non-shadowed options)
    for (const opt of directOptions) {
      if (opt.required && opts[opt.long] === undefined) {
        throw new CommanderError(
          'MissingRequired',
          `missing required option "--${opt.long}" for command "${this.#getCommandPath()}"`,
          this.#getCommandPath(),
        )
      }
    }

    // Validate choices (only for non-shadowed options)
    for (const opt of directOptions) {
      if (opt.choices && opts[opt.long] !== undefined) {
        const value = opts[opt.long]
        const values = Array.isArray(value) ? value : [value]
        const choices: ReadonlyArray<unknown> = opt.choices
        for (const v of values) {
          if (!choices.includes(v)) {
            throw new CommanderError(
              'InvalidChoice',
              `invalid value "${v}" for option "--${opt.long}". Allowed: ${opt.choices.join(', ')}`,
              this.#getCommandPath(),
            )
          }
        }
      }
    }

    return { opts, remaining: finalRemaining }
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
    if (this.#subcommands.length > 0) usage += ' [command]'
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
        let sig = opt.short ? `-${opt.short}, ` : '    '
        sig += `--${opt.long}`
        // type defaults to 'string' when undefined (per spec)
        const effectiveType = opt.type ?? 'string'
        if (effectiveType !== 'boolean') {
          sig += ' <value>'
        }

        let desc = opt.description
        if (opt.default !== undefined && effectiveType !== 'boolean') {
          desc += ` (default: ${JSON.stringify(opt.default)})`
        }
        if (opt.choices) {
          desc += ` [choices: ${opt.choices.join(', ')}]`
        }

        optLines.push({ sig, desc })

        // Add --no-{long} for boolean options
        if (effectiveType === 'boolean') {
          optLines.push({
            sig: `    --no-${opt.long}`,
            desc: `Negate --${opt.long}`,
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
    const showHelpSubcommand = this.#helpSubcommandEnabled && this.#subcommands.length > 0
    if (this.#subcommands.length > 0) {
      lines.push('Commands:')
      const cmdLines: Array<{ name: string; desc: string }> = []

      // Add help subcommand if enabled and has subcommands
      if (showHelpSubcommand) {
        cmdLines.push({ name: 'help', desc: 'Show help for a command' })
      }

      for (const entry of this.#subcommands) {
        let name = entry.name
        if (entry.aliases.length > 0) {
          name += `, ${entry.aliases.join(', ')}`
        }
        cmdLines.push({ name, desc: (entry.command as Command).#description })
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
      // type defaults to 'string' when undefined (per spec)
      const effectiveType = opt.type ?? 'string'
      options.push({
        long: opt.long,
        short: opt.short,
        description: opt.description,
        takesValue: effectiveType !== 'boolean',
        choices: opt.choices as string[] | undefined,
      })
    }

    return {
      name: this.#name,
      description: this.#description,
      aliases: [],
      options,
      subcommands: this.#subcommands.map(entry => {
        const subMeta = (entry.command as Command).getCompletionMeta()
        return {
          ...subMeta,
          name: entry.name,
          aliases: entry.aliases,
        }
      }),
    }
  }

  // ==================== Private: Routing ====================

  #processHelpSubcommand(argv: string[]): string[] {
    // Only process if help subcommand is enabled
    if (!this.#helpSubcommandEnabled) return argv
    if (argv.length < 1 || argv[0] !== 'help') return argv

    // "help" alone or no subcommands -> show current command's help
    if (argv.length === 1 || this.#subcommands.length === 0) {
      return ['--help']
    }

    // "help <subcommand>" -> "<subcommand> --help"
    const subName = argv[1]
    const entry = this.#subcommands.find(e => e.name === subName || e.aliases.includes(subName))
    if (entry) {
      return [subName, '--help', ...argv.slice(2)]
    }

    // Unknown subcommand, let normal routing handle the error
    return argv
  }

  /**
   * Route and return the full command chain (root → leaf).
   */
  #routeChain(argv: string[]): { chain: Command[]; remaining: string[] } {
    const chain: Command[] = [this]
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: Command = this
    let idx = 0

    while (idx < argv.length) {
      const token = argv[idx]

      // Stop routing on option-like token
      if (token.startsWith('-')) break

      // Try to match subcommand
      const entry = current.#subcommands.find(e => e.name === token || e.aliases.includes(token))
      if (!entry) break

      current = entry.command as Command
      chain.push(current)
      idx += 1
    }

    return { chain, remaining: argv.slice(idx) }
  }

  /**
   * Split tokens at '--' separator.
   * Before '--': options for shift chain
   * After '--': args passed directly to action (not parsed)
   */
  #splitAtDoubleDash(tokens: string[]): { optionTokens: string[]; restArgs: string[] } {
    const ddIdx = tokens.indexOf('--')
    if (ddIdx === -1) {
      // No '--': all tokens are options, no positional args
      return { optionTokens: tokens, restArgs: [] }
    }

    return {
      optionTokens: tokens.slice(0, ddIdx),
      restArgs: tokens.slice(ddIdx + 1),
    }
  }

  /**
   * Shift options bottom-up through the command chain.
   * Returns a map of command → parsed options, plus any remaining positional arguments.
   */
  #shiftChain(
    chain: Command[],
    tokens: string[],
    includeRootVersion: boolean,
  ): { optsMap: Map<Command, Record<string, unknown>>; positionalArgs: string[] } {
    const optsMap = new Map<Command, Record<string, unknown>>()
    let remaining = [...tokens]
    const rootCommand = chain[0]

    // Build shadowed set: options defined by child commands
    // Child options shadow parent options with the same name
    const shadowed = new Set<string>()

    // Process from leaf to root
    for (let i = chain.length - 1; i >= 0; i--) {
      const cmd = chain[i]
      const includeVersion = cmd === rootCommand && includeRootVersion
      const result = cmd.#shiftWithShadowed(remaining, shadowed, includeVersion)
      optsMap.set(cmd, result.opts)
      remaining = result.remaining

      // Add this command's options to shadowed set for parent commands
      for (const opt of cmd.#options) {
        shadowed.add(opt.long)
      }
    }

    // Remaining tokens: unknown options are errors, non-options are positional args
    const positionalArgs: string[] = []
    for (const token of remaining) {
      if (token.startsWith('-')) {
        const leafCommand = chain[chain.length - 1]
        if (!token.startsWith('--') && token.length > 2) {
          const flag = token[1]
          throw new CommanderError(
            'UnknownOption',
            `unknown option "-${flag}" for command "${leafCommand.#getCommandPath()}"`,
            leafCommand.#getCommandPath(),
          )
        }
        throw new CommanderError(
          'UnknownOption',
          `unknown option "${token}" for command "${leafCommand.#getCommandPath()}"`,
          leafCommand.#getCommandPath(),
        )
      }
      positionalArgs.push(token)
    }

    return { optsMap, positionalArgs }
  }

  /**
   * Apply option callbacks top-down through the command chain.
   */
  #applyChain(
    chain: Command[],
    optsMap: Map<Command, Record<string, unknown>>,
    ctx: ICommandContext,
  ): void {
    for (const cmd of chain) {
      const opts = optsMap.get(cmd) ?? {}
      for (const opt of cmd.#getMergedOptions()) {
        if (opt.apply && opts[opt.long] !== undefined) {
          opt.apply(opts[opt.long], ctx)
        }
      }
    }
  }

  /**
   * Merge options from all commands in chain (root → leaf, later overwrites earlier).
   */
  #mergeOpts(
    chain: Command[],
    optsMap: Map<Command, Record<string, unknown>>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {}
    for (const cmd of chain) {
      Object.assign(merged, optsMap.get(cmd) ?? {})
    }
    return merged
  }

  // ==================== Private: Option Parsing ====================

  /* eslint-disable no-param-reassign */
  #applyValue(opt: IOption, rawValue: string, opts: Record<string, unknown>): void {
    const type = opt.type ?? 'string'

    // Apply coerce if present
    let parsedValue: unknown = rawValue
    if (opt.coerce) {
      parsedValue = opt.coerce(rawValue)
    } else {
      // Built-in parsing
      switch (type) {
        case 'string':
        case 'string[]':
          parsedValue = rawValue
          break

        case 'number':
        case 'number[]': {
          const num = Number(rawValue)
          if (Number.isNaN(num)) {
            throw new CommanderError(
              'InvalidType',
              `invalid number "${rawValue}" for option "--${opt.long}"`,
              this.#getCommandPath(),
            )
          }
          parsedValue = num
          break
        }
      }
    }

    // Handle array types (append) vs scalar types (overwrite)
    if (type === 'string[]' || type === 'number[]') {
      const currentValue = opts[opt.long]
      const current: unknown[] = Array.isArray(currentValue) ? currentValue : []
      opts[opt.long] = [...current, parsedValue]
    } else {
      opts[opt.long] = parsedValue
    }
  }
  /* eslint-enable no-param-reassign */

  // ==================== Private: Option Merging ====================

  #getMergedOptions(includeVersion = !this.#parent): IOption[] {
    // No parent inheritance - just return this command's options with builtins
    const optionMap = new Map<string, IOption>()

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

  #validateMergedShortOptions(chain: Command[], includeRootVersion: boolean): void {
    const mergedByLong = new Map<string, IOption>()
    const rootCommand = chain[0]

    for (const cmd of chain) {
      const includeVersion = cmd === rootCommand && includeRootVersion
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

  #validateOptionConfig(opt: IOption): void {
    // No no- prefix allowed
    if (opt.long.startsWith('no-')) {
      throw new CommanderError(
        'ConfigurationError',
        `option long name cannot start with "no-": "${opt.long}"`,
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

  #checkOptionUniqueness(opt: IOption): void {
    // Check long uniqueness in current command
    if (this.#options.some(o => o.long === opt.long)) {
      throw new CommanderError(
        'OptionConflict',
        `option "--${opt.long}" is already defined`,
        this.#getCommandPath(),
      )
    }

    // Check short uniqueness in current command
    if (opt.short && this.#options.some(o => o.short === opt.short)) {
      throw new CommanderError(
        'OptionConflict',
        `short option "-${opt.short}" is already defined`,
        this.#getCommandPath(),
      )
    }
  }

  #validateArgumentConfig(arg: IArgument): void {
    // Check required + default conflict
    if (arg.kind === 'required' && arg.default !== undefined) {
      throw new CommanderError(
        'ConfigurationError',
        `required argument "${arg.name}" cannot have a default value`,
        this.#getCommandPath(),
      )
    }

    // Check variadic is last and unique
    if (arg.kind === 'variadic') {
      if (this.#arguments.some(a => a.kind === 'variadic')) {
        throw new CommanderError(
          'ConfigurationError',
          'only one variadic argument is allowed',
          this.#getCommandPath(),
        )
      }
    }

    // Check variadic must be last
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

    // Check required before optional
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

  /**
   * Parse raw positional arguments into typed values based on argument definitions.
   */
  #parseArguments(rawArgs: string[]): { args: Record<string, unknown>; rawArgs: string[] } {
    const argumentDefs = this.#arguments
    const args: Record<string, unknown> = {}

    // 1) Required count check
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

    // 2) Consume rawArgs in declaration order
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
        // Required arguments are already validated above
      } else {
        args[def.name] = this.#convertArgument(def, raw)
        index += 1
      }
    }

    // 3) Too many arguments check (non-variadic)
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
   * Convert a single raw argument value based on its definition.
   */
  #convertArgument(def: IArgument, raw: string): unknown {
    // Coerce takes precedence
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

    // No coerce: use built-in type conversion
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

    return raw // Default: string
  }

  #buildOptionMaps(
    allOptions: IOption[],
    excludeResolver = false,
  ): {
    optionByLong: Map<string, IOption>
    optionByShort: Map<string, IOption>
    booleanOptions: Set<string>
  } {
    const optionByLong = new Map<string, IOption>()
    const optionByShort = new Map<string, IOption>()
    const booleanOptions = new Set<string>()

    for (const opt of allOptions) {
      if (excludeResolver && opt.resolver) continue

      optionByLong.set(opt.long, opt)
      if (opt.short) {
        optionByShort.set(opt.short, opt)
      }
      if (opt.type === 'boolean') {
        booleanOptions.add(opt.long)
      }
    }

    return { optionByLong, optionByShort, booleanOptions }
  }

  #hasHelpFlag(argv: string[], allOptions: IOption[]): boolean {
    return this.#hasBuiltinFlag(argv, 'help', 'h', allOptions)
  }

  #hasVersionFlag(argv: string[], allOptions: IOption[]): boolean {
    return this.#hasBuiltinFlag(argv, 'version', 'V', allOptions)
  }

  #hasBuiltinFlag(
    argv: string[],
    flagLong: string,
    flagShort: string | undefined,
    allOptions: IOption[],
  ): boolean {
    const { optionByLong, optionByShort, booleanOptions } = this.#buildOptionMaps(allOptions)
    const normalizedArgv = this.#normalizeArgv(argv, booleanOptions)

    for (let i = 0; i < normalizedArgv.length; i++) {
      const arg = normalizedArgv[i]
      if (arg === '--') {
        break
      }

      if (arg === `--${flagLong}` || (flagShort && arg === `-${flagShort}`)) {
        return true
      }

      if (this.#optionConsumesNextValue(arg, optionByLong, optionByShort)) {
        i += 1
      }
    }

    return false
  }

  #optionConsumesNextValue(
    arg: string,
    optionByLong: Map<string, IOption>,
    optionByShort: Map<string, IOption>,
  ): boolean {
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx !== -1) {
        return false
      }

      const optName = arg.slice(2)
      const opt = optionByLong.get(optName)
      if (!opt) {
        return false
      }

      const type = opt.type ?? 'string'
      return type !== 'boolean'
    }

    if (arg.startsWith('-') && arg.length === 2) {
      const opt = optionByShort.get(arg[1])
      if (!opt) {
        return false
      }

      const type = opt.type ?? 'string'
      return type !== 'boolean'
    }

    return false
  }

  #normalizeArgv(argv: string[], booleanOptions: Set<string>): string[] {
    const result: string[] = []
    let seenDoubleDash = false

    for (const arg of argv) {
      if (arg === '--') {
        seenDoubleDash = true
        result.push(arg)
        continue
      }

      if (!seenDoubleDash && arg.startsWith('--no-')) {
        const eqIdx = arg.indexOf('=')
        if (eqIdx !== -1) {
          // --no-foo=value: check if it's a boolean option and throw error
          const optName = arg.slice(5, eqIdx)
          if (booleanOptions.has(optName)) {
            throw new CommanderError(
              'InvalidBooleanValue',
              `"--no-${optName}" does not accept a value`,
              this.#getCommandPath(),
            )
          }
        } else {
          // --no-foo: normalize to --foo=false if it's a boolean option
          const optName = arg.slice(5)
          if (booleanOptions.has(optName)) {
            result.push(`--${optName}=false`)
            continue
          }
        }
      }

      result.push(arg)
    }

    return result
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

  /**
   * Try to consume a long option token.
   * Returns the number of tokens consumed (0 if not recognized).
   */
  /* eslint-disable no-param-reassign */
  #tryConsumeLongOption(
    tokens: string[],
    idx: number,
    optionByLong: Map<string, IOption>,
    opts: Record<string, unknown>,
  ): number {
    const token = tokens[idx]
    const eqIdx = token.indexOf('=')
    let optName: string
    let inlineValue: string | undefined

    if (eqIdx !== -1) {
      optName = token.slice(2, eqIdx)
      inlineValue = token.slice(eqIdx + 1)
    } else {
      optName = token.slice(2)
    }

    const opt = optionByLong.get(optName)
    if (!opt) {
      return 0 // Not recognized
    }

    // Boolean option
    if (opt.type === 'boolean') {
      if (inlineValue !== undefined) {
        if (inlineValue === 'true') {
          opts[optName] = true
        } else if (inlineValue === 'false') {
          opts[optName] = false
        } else {
          throw new CommanderError(
            'InvalidBooleanValue',
            `invalid value "${inlineValue}" for boolean option "--${optName}". Use "true" or "false"`,
            this.#getCommandPath(),
          )
        }
      } else {
        opts[optName] = true
      }
      return 1
    }

    // Value option
    let value: string
    let consumed = 1
    if (inlineValue !== undefined) {
      value = inlineValue
    } else if (idx + 1 < tokens.length) {
      value = tokens[idx + 1]
      consumed = 2
    } else {
      throw new CommanderError(
        'MissingValue',
        `option "--${optName}" requires a value`,
        this.#getCommandPath(),
      )
    }

    this.#applyValue(opt, value, opts)
    return consumed
  }
  /* eslint-enable no-param-reassign */

  /**
   * Try to consume a short option token.
   * Returns consumption info including any remaining portion to pass to parent.
   */
  /* eslint-disable no-param-reassign */
  #tryConsumeShortOption(
    tokens: string[],
    idx: number,
    optionByShort: Map<string, IOption>,
    opts: Record<string, unknown>,
  ): { consumed: boolean; nextIdx: number; remainingToken?: string } {
    const token = tokens[idx]

    // Check for unsupported syntax: -o=value
    if (token.includes('=')) {
      // If we don't recognize the first flag, pass it to parent
      const firstFlag = token[1]
      if (!optionByShort.has(firstFlag)) {
        return { consumed: false, nextIdx: idx + 1 }
      }
      throw new CommanderError(
        'UnsupportedShortSyntax',
        `"-${token.slice(1)}" is not supported. Use "-${token[1]} ${token.slice(3)}" instead`,
        this.#getCommandPath(),
      )
    }

    const flags = token.slice(1)
    let j = 0
    const consumedFlags: string[] = []
    const unconsumedFlags: string[] = []
    let nextIdx = idx + 1

    while (j < flags.length) {
      const flag = flags[j]
      const opt = optionByShort.get(flag)

      if (!opt) {
        // Unknown flag - collect remaining flags for parent
        unconsumedFlags.push(...flags.slice(j).split(''))
        break
      }

      consumedFlags.push(flag)

      // Boolean option
      if (opt.type === 'boolean') {
        opts[opt.long] = true
        j += 1
        continue
      }

      // Value option - must be last in group
      if (j < flags.length - 1) {
        // Not the last flag - this is an error
        throw new CommanderError(
          'UnsupportedShortSyntax',
          `"-${flags}" is not supported. Use "-${flags.slice(0, j + 1)} ${flags.slice(j + 1)}" or separate options`,
          this.#getCommandPath(),
        )
      }

      // Last flag, get value from next token
      if (idx + 1 < tokens.length && !tokens[idx + 1].startsWith('-')) {
        const value = tokens[idx + 1]
        this.#applyValue(opt, value, opts)
        nextIdx = idx + 2
      } else {
        throw new CommanderError(
          'MissingValue',
          `option "-${flag}" requires a value`,
          this.#getCommandPath(),
        )
      }

      j += 1
    }

    // If we consumed some flags, report success
    if (consumedFlags.length > 0) {
      const remainingToken = unconsumedFlags.length > 0 ? `-${unconsumedFlags.join('')}` : undefined
      return { consumed: true, nextIdx, remainingToken }
    }

    return { consumed: false, nextIdx: idx + 1 }
  }
  /* eslint-enable no-param-reassign */
}
