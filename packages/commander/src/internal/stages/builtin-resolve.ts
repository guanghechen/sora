import {
  devmodeOption,
  logColorfulOption,
  logDateOption,
  logLevelOption,
  silentOption,
} from '../../command/options'
import type {
  ICommandBuiltinOptionResolved,
  ICommandOptionConfig,
  ICommandToken,
} from '../../command/types'

const BUILTIN_COLOR_OPTION: ICommandOptionConfig = {
  long: 'color',
  type: 'boolean',
  args: 'none',
  desc: 'Enable colored help output',
  default: true,
}

export interface ICommandOptionPolicy {
  readonly mergedOptions: ICommandOptionConfig[]
}

export function resolveOptionPolicy(params: {
  builtinOption: ICommandBuiltinOptionResolved
  localOptions: ICommandOptionConfig[]
}): ICommandOptionPolicy {
  const { builtinOption, localOptions } = params
  const optionMap = new Map<string, ICommandOptionConfig>()

  const hasUserOption = (long: string): boolean => localOptions.some(option => option.long === long)

  if (builtinOption.color && !hasUserOption('color')) {
    optionMap.set('color', BUILTIN_COLOR_OPTION)
  }
  if (builtinOption.devmode) {
    optionMap.set('devmode', devmodeOption as ICommandOptionConfig)
  }
  if (builtinOption.logLevel && !hasUserOption('logLevel')) {
    optionMap.set('logLevel', logLevelOption as ICommandOptionConfig)
  }
  if (builtinOption.silent && !hasUserOption('silent')) {
    optionMap.set('silent', silentOption as ICommandOptionConfig)
  }
  if (builtinOption.logDate && !hasUserOption('logDate')) {
    optionMap.set('logDate', logDateOption as ICommandOptionConfig)
  }
  if (builtinOption.logColorful && !hasUserOption('logColorful')) {
    optionMap.set('logColorful', logColorfulOption as ICommandOptionConfig)
  }

  for (const option of localOptions) {
    optionMap.set(option.long, option)
  }

  return {
    mergedOptions: Array.from(optionMap.values()),
  }
}

export function buildOptionPolicyMap<TCommand>(params: {
  chain: TCommand[]
  resolveOptionPolicy: (command: TCommand) => ICommandOptionPolicy
}): Map<TCommand, ICommandOptionPolicy> {
  const { chain, resolveOptionPolicy } = params
  const optionPolicyMap = new Map<TCommand, ICommandOptionPolicy>()
  for (const command of chain) {
    optionPolicyMap.set(command, resolveOptionPolicy(command))
  }

  return optionPolicyMap
}

export function mustGetOptionPolicy<TCommand>(params: {
  optionPolicyMap: Map<TCommand, ICommandOptionPolicy>
  command: TCommand
  resolveOptionPolicy: (command: TCommand) => ICommandOptionPolicy
}): ICommandOptionPolicy {
  const { optionPolicyMap, command, resolveOptionPolicy } = params
  const policy = optionPolicyMap.get(command) ?? resolveOptionPolicy(command)
  optionPolicyMap.set(command, policy)
  return policy
}

export function findTokenByOriginal(
  tokens: ICommandToken[],
  original: string,
): ICommandToken | undefined {
  return tokens.find(token => token.original === original)
}
