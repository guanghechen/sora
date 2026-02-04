/**
 * Command class - CLI command builder with fluent API
 *
 * @module @guanghechen/commander
 */

import type {
  IAction,
  IActionParams,
  IArgument,
  ICommandConfig,
  ICommandContext,
  ICompletionMeta,
  ICompletionOptionMeta,
  IOption,
  IParseResult,
  IReporter,
  IRunParams,
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

export class Command {
  readonly #name: string
  readonly #description: string
  readonly #version: string | undefined
  readonly #aliases: string[]

  #options: IOption[] = []
  #arguments: IArgument[] = []
  #subcommands: Command[] = []
  #action: IAction | undefined
  #parent: Command | undefined

  constructor(config: ICommandConfig) {
    this.#name = config.name
    this.#description = config.description
    this.#version = config.version
    this.#aliases = config.aliases ?? []
  }

  // ==================== Properties ====================

  public get name(): string {
    return this.#name
  }

  public get aliases(): string[] {
    return this.#aliases
  }

  public get description(): string {
    return this.#description
  }

  public get version(): string | undefined {
    return this.#version ?? this.#parent?.version
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

  public subcommand(cmd: Command): this {
    // eslint-disable-next-line no-param-reassign
    cmd.#parent = this
    this.#subcommands.push(cmd)
    return this
  }

  // ==================== Execution Methods ====================

  public async run(params: IRunParams): Promise<void> {
    const { argv, envs, reporter } = params

    try {
      // 1. Route to target command
      const { command, remaining } = this.#route(argv)

      // 2. Parse options and arguments
      const { opts, args } = command.parse(remaining)

      // 3. Build context
      const ctx: ICommandContext = {
        cmd: command,
        envs,
        reporter: reporter ?? new DefaultReporter(),
        argv,
      }

      // 4. Handle built-in options
      const allOptions = command.#getMergedOptions()
      // Check ancestor chain for user-defined help/version (not just current command)
      const hasUserHelp = allOptions.some(o => o.long === 'help' && !command.#isBuiltinOption(o))
      const hasUserVersion = allOptions.some(
        o => o.long === 'version' && !command.#isBuiltinOption(o),
      )

      if (!hasUserHelp && opts['help'] === true) {
        console.log(command.formatHelp())
        return
      }

      if (!hasUserVersion && opts['version'] === true) {
        console.log(command.version ?? 'unknown')
        return
      }

      // 5. Apply callbacks
      for (const opt of allOptions) {
        if (opt.apply && opts[opt.long] !== undefined) {
          opt.apply(opts[opt.long], ctx)
        }
      }

      // 6. Execute action
      const actionParams: IActionParams = { ctx, opts, args }

      if (command.#action) {
        try {
          await command.#action(actionParams)
        } catch (err) {
          // Action errors exit with code 1 (per spec §8.1)
          if (err instanceof Error) {
            console.error(`Error: ${err.message}`)
          } else {
            console.error('Error: action failed')
          }
          process.exit(1)
        }
      } else if (command.#subcommands.length > 0) {
        // No action but has subcommands: show help
        console.log(command.formatHelp())
      } else {
        throw new CommanderError(
          'ConfigurationError',
          `no action defined for command "${command.#getCommandPath()}"`,
          command.#getCommandPath(),
        )
      }
    } catch (err) {
      // Parsing/configuration errors exit with code 2 (per spec §8.1)
      if (err instanceof CommanderError) {
        console.error(err.format())
        process.exit(2)
        return // For test mocking - exit() mock doesn't terminate execution
      }
      throw err
    }
  }

  public parse(argv: string[]): IParseResult {
    const allOptions = this.#getMergedOptions()
    const opts: Record<string, unknown> = {}
    const args: string[] = []

    // Initialize defaults
    for (const opt of allOptions) {
      if (opt.default !== undefined) {
        opts[opt.long] = opt.default
      } else if (opt.type === 'boolean') {
        opts[opt.long] = false
      } else if (opt.type === 'string[]' || opt.type === 'number[]') {
        opts[opt.long] = []
      }
    }

    // Process resolver options first
    let remaining = [...argv]
    const resolverOptions = allOptions.filter(o => o.resolver)
    for (const opt of resolverOptions) {
      const result = opt.resolver!(remaining)
      opts[opt.long] = result.value
      remaining = result.remaining
    }

    // Create option map for quick lookup
    const optionByLong = new Map<string, IOption>()
    const optionByShort = new Map<string, IOption>()
    for (const opt of allOptions) {
      if (!opt.resolver) {
        optionByLong.set(opt.long, opt)
        if (opt.short) {
          optionByShort.set(opt.short, opt)
        }
      }
    }

    // Parse remaining argv
    let i = 0
    while (i < remaining.length) {
      const token = remaining[i]

      // End-of-options marker
      if (token === '--') {
        args.push(...remaining.slice(i + 1))
        break
      }

      // Long option
      if (token.startsWith('--')) {
        i = this.#parseLongOption(remaining, i, optionByLong, opts)
        continue
      }

      // Short option
      if (token.startsWith('-') && token.length > 1) {
        i = this.#parseShortOption(remaining, i, optionByShort, opts)
        continue
      }

      // Positional argument
      args.push(token)
      i += 1
    }

    // Validate required options
    for (const opt of allOptions) {
      if (opt.required && opts[opt.long] === undefined) {
        throw new CommanderError(
          'MissingRequired',
          `missing required option "--${opt.long}" for command "${this.#getCommandPath()}"`,
          this.#getCommandPath(),
        )
      }
    }

    // Validate choices
    for (const opt of allOptions) {
      if (opt.choices && opts[opt.long] !== undefined) {
        const value = opts[opt.long]
        const values = Array.isArray(value) ? value : [value]
        for (const v of values) {
          if (!(opt.choices as unknown[]).includes(v)) {
            throw new CommanderError(
              'InvalidChoice',
              `invalid value "${v}" for option "--${opt.long}". Allowed: ${opt.choices.join(', ')}`,
              this.#getCommandPath(),
            )
          }
        }
      }
    }

    // Validate required arguments
    const requiredArgs = this.#arguments.filter(a => a.kind === 'required')
    if (args.length < requiredArgs.length) {
      const missing = requiredArgs.slice(args.length).map(a => a.name)
      throw new CommanderError(
        'MissingRequiredArgument',
        `missing required argument(s): ${missing.join(', ')}`,
        this.#getCommandPath(),
      )
    }

    return { opts, args }
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

        // Add --no-{long} for boolean options (reuse original description per spec)
        if (effectiveType === 'boolean') {
          optLines.push({
            sig: `    --no-${opt.long}`,
            desc: opt.description,
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
    if (this.#subcommands.length > 0) {
      lines.push('Commands:')
      const cmdLines: Array<{ name: string; desc: string }> = []
      for (const sub of this.#subcommands) {
        let name = sub.#name
        if (sub.#aliases.length > 0) {
          name += `, ${sub.#aliases.join(', ')}`
        }
        cmdLines.push({ name, desc: sub.#description })
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
      aliases: this.#aliases,
      options,
      subcommands: this.#subcommands.map(sub => sub.getCompletionMeta()),
    }
  }

  // ==================== Private: Routing ====================

  #route(argv: string[]): { command: Command; remaining: string[] } {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: Command = this
    let idx = 0

    while (idx < argv.length) {
      const token = argv[idx]

      // Stop routing on option-like token
      if (token.startsWith('-')) break

      // Try to match subcommand
      const sub = current.#subcommands.find(c => c.#name === token || c.#aliases.includes(token))
      if (!sub) break

      current = sub
      idx += 1
    }

    return { command: current, remaining: argv.slice(idx) }
  }

  // ==================== Private: Option Parsing ====================

  /* eslint-disable no-param-reassign */
  #parseLongOption(
    argv: string[],
    idx: number,
    optionByLong: Map<string, IOption>,
    opts: Record<string, unknown>,
  ): number {
    const token = argv[idx]
    const eqIdx = token.indexOf('=')
    let optName: string
    let inlineValue: string | undefined

    if (eqIdx !== -1) {
      optName = token.slice(2, eqIdx)
      inlineValue = token.slice(eqIdx + 1)
    } else {
      optName = token.slice(2)
    }

    // Handle --no-{name} for boolean options
    if (optName.startsWith('no-')) {
      const actualName = optName.slice(3)
      const opt = optionByLong.get(actualName)
      if (opt && opt.type === 'boolean') {
        if (inlineValue !== undefined) {
          throw new CommanderError(
            'InvalidBooleanValue',
            `"--no-${actualName}" does not accept a value`,
            this.#getCommandPath(),
          )
        }
        opts[actualName] = false
        return idx + 1
      }
      // If not a boolean option, fall through to unknown option error
    }

    const opt = optionByLong.get(optName)
    if (!opt) {
      throw new CommanderError(
        'UnknownOption',
        `unknown option "--${optName}" for command "${this.#getCommandPath()}"`,
        this.#getCommandPath(),
      )
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
      return idx + 1
    }

    // Value option
    let value: string
    let nextIdx = idx
    if (inlineValue !== undefined) {
      value = inlineValue
    } else if (idx + 1 < argv.length) {
      // Long options can accept values starting with '-' (e.g., --opt -1)
      value = argv[idx + 1]
      nextIdx += 1
    } else {
      throw new CommanderError(
        'MissingValue',
        `option "--${optName}" requires a value`,
        this.#getCommandPath(),
      )
    }

    this.#applyValue(opt, value, opts)
    return nextIdx + 1
  }

  #parseShortOption(
    argv: string[],
    idx: number,
    optionByShort: Map<string, IOption>,
    opts: Record<string, unknown>,
  ): number {
    const token = argv[idx]

    // Check for unsupported syntax: -o=value
    if (token.includes('=')) {
      throw new CommanderError(
        'UnsupportedShortSyntax',
        `"-${token.slice(1)}" is not supported. Use "-${token[1]} ${token.slice(3)}" instead`,
        this.#getCommandPath(),
      )
    }

    const flags = token.slice(1)

    for (let j = 0; j < flags.length; j++) {
      const flag = flags[j]
      const opt = optionByShort.get(flag)

      if (!opt) {
        throw new CommanderError(
          'UnknownOption',
          `unknown option "-${flag}" for command "${this.#getCommandPath()}"`,
          this.#getCommandPath(),
        )
      }

      // Boolean option
      if (opt.type === 'boolean') {
        opts[opt.long] = true
        continue
      }

      // Value option - must be last in group or followed by space-separated value
      if (j < flags.length - 1) {
        // Not the last flag - this is an error (value attached like -ovalue)
        throw new CommanderError(
          'UnsupportedShortSyntax',
          `"-${flags}" is not supported. Use "-${flags.slice(0, j + 1)} ${flags.slice(j + 1)}" or separate options`,
          this.#getCommandPath(),
        )
      }

      // Last flag, get value from next token
      if (idx + 1 < argv.length && !argv[idx + 1].startsWith('-')) {
        const value = argv[idx + 1]
        this.#applyValue(opt, value, opts)
        return idx + 2
      }

      throw new CommanderError(
        'MissingValue',
        `option "-${flag}" requires a value`,
        this.#getCommandPath(),
      )
    }

    return idx + 1
  }

  #applyValue(opt: IOption, rawValue: string, opts: Record<string, unknown>): void {
    const type = opt.type ?? 'string'

    // Apply coerce if present
    let parsedValue: unknown
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

        default:
          parsedValue = rawValue
      }
    }

    // Handle array types (append) vs scalar types (overwrite)
    if (type === 'string[]' || type === 'number[]') {
      const current = (opts[opt.long] as unknown[]) ?? []
      opts[opt.long] = [...current, parsedValue]
    } else {
      opts[opt.long] = parsedValue
    }
  }
  /* eslint-enable no-param-reassign */

  // ==================== Private: Option Merging ====================

  #getMergedOptions(): IOption[] {
    // Collect options from ancestor chain (root to current)
    const ancestors: Command[] = []
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    for (let node: Command | undefined = this; node; node = node.#parent) {
      ancestors.unshift(node)
    }

    // Merge with long as key, later overrides earlier
    const optionMap = new Map<string, IOption>()

    // Add built-in options first (can be overridden)
    const hasUserHelp = ancestors.some(c => c.#options.some(o => o.long === 'help'))
    const hasUserVersion = ancestors.some(c => c.#options.some(o => o.long === 'version'))

    if (!hasUserHelp) {
      optionMap.set('help', BUILTIN_HELP_OPTION)
    }
    if (!hasUserVersion) {
      optionMap.set('version', BUILTIN_VERSION_OPTION)
    }

    // Add options from ancestors (root to current)
    for (const ancestor of ancestors) {
      for (const opt of ancestor.#options) {
        optionMap.set(opt.long, opt)
      }
    }

    // Check for short option conflicts
    const shortToLong = new Map<string, string>()
    for (const [long, opt] of optionMap) {
      if (opt.short) {
        const existing = shortToLong.get(opt.short)
        if (existing && existing !== long) {
          throw new CommanderError(
            'OptionConflict',
            `short option "-${opt.short}" is used by both "--${existing}" and "--${long}"`,
            this.#getCommandPath(),
          )
        }
        shortToLong.set(opt.short, long)
      }
    }

    return Array.from(optionMap.values())
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

  #isBuiltinOption(opt: IOption): boolean {
    // Use object identity comparison with built-in option constants
    return opt === BUILTIN_HELP_OPTION || opt === BUILTIN_VERSION_OPTION
  }

  #getCommandPath(): string {
    const parts: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    for (let node: Command | undefined = this; node; node = node.#parent) {
      parts.unshift(node.#name)
    }
    return parts.join(' ')
  }
}
