import { CommanderError } from '../../command/types'
import type {
  ICommandBuiltinOptionResolved,
  ICommandBuiltinParsedOptions,
  ICommandOptionConfig,
  ICommandParsedOpts,
  ICommandToken,
} from '../../command/types'

const DECIMAL_INTEGER_REGEX = /^\d(?:_?\d)*$/
const DECIMAL_FRACTION_REGEX = /^\d(?:_?\d)*$/
const DECIMAL_EXPONENT_REGEX = /^[eE][+-]?\d(?:_?\d)*$/
const BINARY_LITERAL_REGEX = /^0[bB][01](?:_?[01])*$/
const OCTAL_LITERAL_REGEX = /^0[oO][0-7](?:_?[0-7])*$/
const HEX_LITERAL_REGEX = /^0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*$/

function camelToKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}

function isNoColorEnabled(envs: Record<string, string | undefined>): boolean {
  return envs['NO_COLOR'] !== undefined
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

export interface IParseCommandOptionsParams {
  tokens: ICommandToken[]
  allOptions: ICommandOptionConfig[]
  envs: Record<string, string | undefined>
  commandPath: string
}

export interface IParseCommandOptionsResult {
  opts: ICommandParsedOpts
  explicitOptionLongs: Set<string>
}

export interface IApplyBuiltinDevmodeLogLevelParams {
  opts: ICommandParsedOpts
  explicitOptionLongs: Set<string>
  builtinOption: ICommandBuiltinOptionResolved
  hasUserOption: (long: string) => boolean
}

export interface IResolveBuiltinParsedOptionsParams {
  opts: ICommandParsedOpts
  builtinOption: ICommandBuiltinOptionResolved
  hasUserOption: (long: string) => boolean
}

export class CommandOptionParser {
  public parseOptions(params: IParseCommandOptionsParams): IParseCommandOptionsResult {
    const { tokens, allOptions, envs, commandPath } = params
    const opts: ICommandParsedOpts = {}
    const explicitOptionLongs = new Set<string>()
    let sawColorToken = false

    for (const opt of allOptions) {
      if (opt.default !== undefined) {
        opts[opt.long] = opt.default
      } else if (opt.type === 'boolean' && opt.args === 'none') {
        opts[opt.long] = false
      } else if (opt.args === 'variadic') {
        opts[opt.long] = []
      }
    }

    const optionByLong = new Map<string, ICommandOptionConfig>()
    const optionByShort = new Map<string, ICommandOptionConfig>()
    for (const opt of allOptions) {
      optionByLong.set(opt.long, opt)
      if (opt.short) {
        optionByShort.set(opt.short, opt)
      }
    }

    let i = 0
    while (i < tokens.length) {
      const token = tokens[i]
      const opt =
        token.type === 'long' ? optionByLong.get(token.name) : optionByShort.get(token.name)

      if (!opt) {
        i += 1
        continue
      }

      explicitOptionLongs.add(opt.long)

      if (opt.long === 'color') {
        sawColorToken = true
      }

      const isNegativeToken = token.original.toLowerCase().startsWith('--no-')
      if (isNegativeToken && !(opt.type === 'boolean' && opt.args === 'none')) {
        throw new CommanderError(
          'NegativeOptionType',
          `"--no-${camelToKebabCase(opt.long)}" can only be used with boolean options`,
          commandPath,
        )
      }

      if (opt.type === 'boolean' && opt.args === 'none') {
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
              commandPath,
            )
          }
        } else {
          opts[opt.long] = true
        }
        i += 1
        continue
      }

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
            commandPath,
          )
        }

        opts[opt.long] = this.#convertValue(opt, rawValue, commandPath)
        i += 1
        continue
      }

      if (opt.args === 'optional') {
        const eqIdx = token.resolved.indexOf('=')

        if (eqIdx !== -1) {
          opts[opt.long] = this.#convertValue(opt, token.resolved.slice(eqIdx + 1), commandPath)
          i += 1
          continue
        }

        if (i + 1 < tokens.length && tokens[i + 1].type === 'none') {
          opts[opt.long] = this.#convertValue(opt, tokens[i + 1].original, commandPath)
          i += 1
        } else {
          opts[opt.long] = undefined
        }

        i += 1
        continue
      }

      if (opt.args === 'variadic') {
        const values: unknown[] = Array.isArray(opts[opt.long]) ? (opts[opt.long] as unknown[]) : []
        const eqIdx = token.resolved.indexOf('=')

        if (eqIdx !== -1) {
          values.push(this.#convertValue(opt, token.resolved.slice(eqIdx + 1), commandPath))
        } else {
          while (i + 1 < tokens.length && tokens[i + 1].type === 'none') {
            i += 1
            values.push(this.#convertValue(opt, tokens[i].original, commandPath))
          }
        }

        opts[opt.long] = values
        i += 1
        continue
      }

      /* c8 ignore next 2 -- option() validation guarantees args are exhausted above */
      i += 1
    }

    for (const opt of allOptions) {
      if (opt.required && !Object.prototype.hasOwnProperty.call(opts, opt.long)) {
        throw new CommanderError(
          'MissingRequired',
          `missing required option "--${camelToKebabCase(opt.long)}"`,
          commandPath,
        )
      }
    }

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
              commandPath,
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

  public applyBuiltinDevmodeLogLevel(params: IApplyBuiltinDevmodeLogLevelParams): void {
    const { opts, explicitOptionLongs, builtinOption, hasUserOption } = params
    const hasBuiltinDevmode = builtinOption.devmode
    const hasBuiltinLogLevel = builtinOption.logLevel && !hasUserOption('logLevel')

    if (!hasBuiltinDevmode || !hasBuiltinLogLevel) {
      return
    }
    if (opts['devmode'] !== true) {
      return
    }
    if (explicitOptionLongs.has('logLevel')) {
      return
    }

    opts['logLevel'] = 'debug'
  }

  public resolveBuiltinParsedOptions(
    params: IResolveBuiltinParsedOptionsParams,
  ): ICommandBuiltinParsedOptions {
    const { opts, builtinOption, hasUserOption } = params
    const builtin: ICommandBuiltinParsedOptions = {
      devmode: builtinOption.devmode ? Boolean(opts['devmode']) : false,
    }

    if (builtinOption.color && !hasUserOption('color')) {
      builtin.color = Boolean(opts['color'])
    }
    if (builtinOption.logLevel && !hasUserOption('logLevel')) {
      const logLevel = opts['logLevel']
      if (typeof logLevel === 'string') {
        builtin.logLevel = logLevel
      }
    }
    if (builtinOption.silent && !hasUserOption('silent')) {
      builtin.silent = Boolean(opts['silent'])
    }
    if (builtinOption.logDate && !hasUserOption('logDate')) {
      builtin.logDate = Boolean(opts['logDate'])
    }
    if (builtinOption.logColorful && !hasUserOption('logColorful')) {
      builtin.logColorful = Boolean(opts['logColorful'])
    }

    return builtin
  }

  #convertValue(opt: ICommandOptionConfig, rawValue: string, commandPath: string): unknown {
    if (opt.coerce) {
      return opt.coerce(rawValue)
    }

    if (opt.type === 'number') {
      const num = parsePrimitiveNumber(rawValue)
      if (num === undefined) {
        throw new CommanderError(
          'InvalidType',
          `invalid number "${rawValue}" for option "--${camelToKebabCase(opt.long)}"`,
          commandPath,
        )
      }
      return num
    }

    return rawValue
  }
}
