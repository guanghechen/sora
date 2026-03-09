import { CommanderError } from '../../command/types'
import type {
  ICommandArgvSegment,
  ICommandToken,
  ICommandTokenizeResult,
} from '../../command/types'

const LONG_OPTION_REGEX = /^--[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const NEGATIVE_OPTION_REGEX = /^--no-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

function kebabToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function tokenizeLongOption(segment: ICommandArgvSegment, commandPath: string): ICommandToken {
  const arg = segment.value
  const eqIdx = arg.indexOf('=')
  const namePart = eqIdx !== -1 ? arg.slice(0, eqIdx) : arg
  const valuePart = eqIdx !== -1 ? arg.slice(eqIdx) : ''

  if (namePart.includes('_')) {
    throw new CommanderError(
      'InvalidOptionFormat',
      `invalid option "${arg}": use '-' instead of '_'`,
      commandPath,
    )
  }

  const lowerName = namePart.toLowerCase()
  if (lowerName === '--no' || lowerName === '--no-') {
    throw new CommanderError(
      'InvalidNegativeOption',
      `invalid negative option syntax "${arg}"`,
      commandPath,
    )
  }

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

    const camelName = kebabToCamelCase(lowerName.slice(5))
    return {
      original: arg,
      resolved: `--${camelName}=false`,
      name: camelName,
      type: 'long',
      source: segment.source,
      preset: segment.preset,
    }
  }

  if (!LONG_OPTION_REGEX.test(lowerName)) {
    throw new CommanderError('InvalidOptionFormat', `invalid option format "${arg}"`, commandPath)
  }

  const camelName = kebabToCamelCase(lowerName.slice(2))
  return {
    original: arg,
    resolved: `--${camelName}${valuePart}`,
    name: camelName,
    type: 'long',
    source: segment.source,
    preset: segment.preset,
  }
}

function tokenizeShortOptions(segment: ICommandArgvSegment, commandPath: string): ICommandToken[] {
  const arg = segment.value
  if (arg.includes('=')) {
    throw new CommanderError(
      'UnsupportedShortSyntax',
      `"${arg}" is not supported. Use "-${arg[1]} ${arg.slice(3)}" instead`,
      commandPath,
    )
  }

  return arg
    .slice(1)
    .split('')
    .map(flag => ({
      original: `-${flag}`,
      resolved: `-${flag}`,
      name: flag,
      type: 'short' as const,
      source: segment.source,
      preset: segment.preset,
    }))
}

export function tokenizeArgv(
  segments: ICommandArgvSegment[],
  commandPath: string,
): ICommandTokenizeResult {
  const optionTokens: ICommandToken[] = []
  const restArgs: string[] = []
  let passThrough = false

  for (const segment of segments) {
    const arg = segment.value
    if (arg === '--') {
      passThrough = true
      continue
    }

    if (passThrough) {
      restArgs.push(segment.value)
      continue
    }

    if (arg.startsWith('--')) {
      optionTokens.push(tokenizeLongOption(segment, commandPath))
      continue
    }

    if (arg.startsWith('-') && arg.length > 1) {
      optionTokens.push(...tokenizeShortOptions(segment, commandPath))
      continue
    }

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
