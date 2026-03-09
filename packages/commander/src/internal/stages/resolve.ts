import { CommanderError } from '../../command/types'
import type {
  ICommand,
  ICommandOptionConfig,
  ICommandResolveResult,
  ICommandShiftResult,
  ICommandToken,
} from '../../command/types'

interface IOptionPolicy {
  mergedOptions: ICommandOptionConfig[]
}

export function resolveStage<TCommand extends ICommand>(params: {
  chain: TCommand[]
  tokens: ICommandToken[]
  optionPolicyMap: Map<TCommand, IOptionPolicy>
  mustGetOptionPolicy: (
    optionPolicyMap: Map<TCommand, IOptionPolicy>,
    command: TCommand,
  ) => IOptionPolicy
  getLocalOptions: (command: TCommand) => ICommandOptionConfig[]
  getCommandPath: (command: TCommand) => string
  withUnknownOptionIssue: (
    error: CommanderError,
    token: ICommandToken | undefined,
  ) => CommanderError
}): ICommandResolveResult {
  const {
    chain,
    tokens,
    optionPolicyMap,
    mustGetOptionPolicy,
    getLocalOptions,
    getCommandPath,
    withUnknownOptionIssue,
  } = params

  try {
    return resolveTokensByChain({
      chain,
      tokens,
      optionPolicyMap,
      mustGetOptionPolicy,
      getLocalOptions,
      getCommandPath,
    })
  } catch (error) {
    if (error instanceof CommanderError && error.kind === 'UnknownOption') {
      const unresolvedToken =
        error.meta?.token === undefined
          ? undefined
          : tokens.find(token => token.original === error.meta?.token)
      throw withUnknownOptionIssue(error, unresolvedToken)
    }

    throw error
  }
}

export function shiftTokens(params: {
  tokens: ICommandToken[]
  shadowed: Set<string>
  allOptions: ICommandOptionConfig[]
}): ICommandShiftResult {
  const { tokens, shadowed, allOptions } = params
  const effectiveOptions = allOptions.filter(option => !shadowed.has(option.long))

  const optionByLong = new Map<string, ICommandOptionConfig>()
  const optionByShort = new Map<string, ICommandOptionConfig>()
  for (const option of effectiveOptions) {
    optionByLong.set(option.long, option)
    if (option.short) {
      optionByShort.set(option.short, option)
    }
  }

  const consumed: ICommandToken[] = []
  const remaining: ICommandToken[] = []
  let index = 0

  while (index < tokens.length) {
    const token = tokens[index]

    if (token.type === 'long') {
      const option = optionByLong.get(token.name)
      if (option !== undefined) {
        consumed.push(token)
        if (option.args === 'required') {
          if (!token.resolved.includes('=') && index + 1 < tokens.length) {
            index += 1
            consumed.push(tokens[index])
          }
        } else if (option.args === 'optional') {
          if (
            !token.resolved.includes('=') &&
            index + 1 < tokens.length &&
            tokens[index + 1].type === 'none'
          ) {
            index += 1
            consumed.push(tokens[index])
          }
        } else if (option.args === 'variadic' && !token.resolved.includes('=')) {
          while (index + 1 < tokens.length && tokens[index + 1].type === 'none') {
            index += 1
            consumed.push(tokens[index])
          }
        }
        index += 1
        continue
      }

      remaining.push(token)
      index += 1
      continue
    }

    if (token.type === 'short') {
      const option = optionByShort.get(token.name)
      if (option !== undefined) {
        consumed.push(token)
        if (option.args === 'required' || option.args === 'optional') {
          if (index + 1 < tokens.length && tokens[index + 1].type === 'none') {
            index += 1
            consumed.push(tokens[index])
          }
        } else if (option.args === 'variadic') {
          while (index + 1 < tokens.length && tokens[index + 1].type === 'none') {
            index += 1
            consumed.push(tokens[index])
          }
        }
        index += 1
        continue
      }

      remaining.push(token)
      index += 1
      continue
    }

    remaining.push(token)
    index += 1
  }

  return { consumed, remaining }
}

export function resolveTokensByChain<TCommand extends ICommand>(params: {
  chain: TCommand[]
  tokens: ICommandToken[]
  optionPolicyMap: Map<TCommand, IOptionPolicy>
  mustGetOptionPolicy: (
    optionPolicyMap: Map<TCommand, IOptionPolicy>,
    command: TCommand,
  ) => IOptionPolicy
  getLocalOptions: (command: TCommand) => ICommandOptionConfig[]
  getCommandPath: (command: TCommand) => string
}): ICommandResolveResult {
  const { chain, tokens, optionPolicyMap, mustGetOptionPolicy, getLocalOptions, getCommandPath } =
    params

  const consumedTokens = new Map<ICommand, ICommandToken[]>()
  let remaining = [...tokens]
  const shadowed = new Set<string>()

  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const command = chain[index]
    const policy = mustGetOptionPolicy(optionPolicyMap, command)

    const result = shiftTokens({
      tokens: remaining,
      shadowed,
      allOptions: policy.mergedOptions,
    })
    consumedTokens.set(command, result.consumed)
    remaining = result.remaining

    for (const option of getLocalOptions(command)) {
      shadowed.add(option.long)
    }
  }

  const leafCommand = chain[chain.length - 1]
  const leafCommandPath = getCommandPath(leafCommand)
  const argTokens: ICommandToken[] = []
  for (const token of remaining) {
    if (token.type !== 'none') {
      throw new CommanderError(
        'UnknownOption',
        `unknown option "${token.original}" for command "${leafCommandPath}"`,
        leafCommandPath,
        {
          commandPath: leafCommandPath,
          token: token.original,
          issues: [],
        },
      )
    }
    argTokens.push(token)
  }

  return { consumedTokens, argTokens }
}

export function validateMergedShortOptions<TCommand>(params: {
  chain: TCommand[]
  optionPolicyMap: Map<TCommand, IOptionPolicy>
  mustGetOptionPolicy: (
    optionPolicyMap: Map<TCommand, IOptionPolicy>,
    command: TCommand,
  ) => IOptionPolicy
  rootCommandPath: string
}): void {
  const { chain, optionPolicyMap, mustGetOptionPolicy, rootCommandPath } = params

  const mergedByLong = new Map<string, ICommandOptionConfig>()
  for (const command of chain) {
    const policy = mustGetOptionPolicy(optionPolicyMap, command)
    for (const option of policy.mergedOptions) {
      mergedByLong.set(option.long, option)
    }
  }

  const shortMap = new Map<string, string>()
  for (const option of mergedByLong.values()) {
    if (!option.short) {
      continue
    }

    const existingLong = shortMap.get(option.short)
    if (existingLong !== undefined && existingLong !== option.long) {
      throw new CommanderError(
        'OptionConflict',
        `short option "-${option.short}" conflicts with "--${existingLong}"`,
        rootCommandPath,
      )
    }

    shortMap.set(option.short, option.long)
  }
}
