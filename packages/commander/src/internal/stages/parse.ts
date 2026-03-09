import { CommanderError } from '../../command/types'
import type {
  ICommand,
  ICommandArgumentConfig,
  ICommandBuiltinParsedOptions,
  ICommandContext,
  ICommandHintIssue,
  ICommandInputSources,
  ICommandOptionConfig,
  ICommandParseResult,
  ICommandParsedArgs,
  ICommandParsedOpts,
  ICommandResolveResult,
  ICommandToken,
  ISubcommandEntry,
} from '../../command/types'
import { validateMergedShortOptions } from './resolve'

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

  let prev = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 0; row < left.length; row += 1) {
    const current = [row + 1]
    for (let col = 0; col < right.length; col += 1) {
      const substitutionCost = left[row] === right[col] ? 0 : 1
      current[col + 1] = Math.min(current[col] + 1, prev[col + 1] + 1, prev[col] + substitutionCost)
    }
    prev = current
  }

  return prev[right.length]
}

function convertArgumentValue(params: {
  def: ICommandArgumentConfig
  raw: string
  commandPath: string
}): unknown {
  const { def, raw, commandPath } = params

  let value: unknown
  if (def.coerce) {
    try {
      value = def.coerce(raw)
    } catch {
      throw new CommanderError(
        'InvalidType',
        `invalid value "${raw}" for argument "${def.name}"`,
        commandPath,
      )
    }
  } else {
    value = raw
  }

  if (typeof value !== 'string') {
    throw new CommanderError(
      'InvalidType',
      `invalid value for argument "${def.name}": expected ${def.type}`,
      commandPath,
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
        commandPath,
      )
    }
  }

  return value
}

export function parseArguments(params: {
  argumentDefs: ICommandArgumentConfig[]
  rawArgs: string[]
  commandPath: string
}): { args: ICommandParsedArgs; rawArgs: string[] } {
  const { argumentDefs, rawArgs, commandPath } = params
  const args: ICommandParsedArgs = {}

  if (argumentDefs.length === 0 && rawArgs.length > 0) {
    throw new CommanderError(
      'UnexpectedArgument',
      `unexpected argument "${rawArgs[0]}"`,
      commandPath,
    )
  }

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
      commandPath,
    )
  }

  let index = 0
  for (const def of argumentDefs) {
    if (def.kind === 'variadic' || def.kind === 'some') {
      const rest = rawArgs.slice(index)
      args[def.name] = rest.map(raw => convertArgumentValue({ def, raw, commandPath }))
      index = rawArgs.length
      break
    }

    if (def.kind === 'optional') {
      const raw = rawArgs[index]
      if (raw === undefined) {
        args[def.name] = def.default ?? undefined
        continue
      }

      args[def.name] = convertArgumentValue({ def, raw, commandPath })
      index += 1
      continue
    }

    const raw = rawArgs[index] as string
    args[def.name] = convertArgumentValue({ def, raw, commandPath })
    index += 1
  }

  const hasRestArgument = argumentDefs.some(def => def.kind === 'variadic' || def.kind === 'some')
  if (!hasRestArgument && index < rawArgs.length) {
    throw new CommanderError(
      'TooManyArguments',
      `too many arguments: expected ${argumentDefs.length}, got ${rawArgs.length}`,
      commandPath,
    )
  }

  return { args, rawArgs }
}

export function resolveDidYouMeanSubcommandName(
  token: string,
  subcommands: Array<ISubcommandEntry<unknown>>,
): string | undefined {
  const source = normalizeSubcommandNameForDistance(token)
  let minDistance = Number.POSITIVE_INFINITY
  let bestName: string | undefined
  let isUniqueBest = false

  for (const entry of subcommands) {
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

export function assertUnknownSubcommand(params: {
  userTailArgv: string[]
  subcommands: Array<ISubcommandEntry<unknown>>
  hasArguments: boolean
  commandPath: string
  withDiagnosticsIssue: (error: CommanderError) => CommanderError
}): void {
  const { userTailArgv, subcommands, hasArguments, commandPath, withDiagnosticsIssue } = params

  if (subcommands.length === 0) {
    return
  }

  const token = userTailArgv[0]
  if (token === undefined || token.startsWith('-') || token === 'help') {
    return
  }

  const matched = subcommands.some(entry => entry.name === token || entry.aliases.includes(token))
  if (matched) {
    return
  }

  let error = new CommanderError(
    'UnknownSubcommand',
    `unknown subcommand "${token}" for command "${commandPath}"`,
    commandPath,
  )
  error = withDiagnosticsIssue(error)

  if (!hasArguments) {
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

  const candidate = resolveDidYouMeanSubcommandName(token, subcommands)
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

export function collectRawArguments(params: {
  argTokens: ICommandToken[]
  restArgs: string[]
}): string[] {
  const { argTokens, restArgs } = params
  return [...argTokens.map(token => token.original), ...restArgs]
}

interface IOptionPolicyLike {
  readonly mergedOptions: ICommandOptionConfig[]
}

export interface IParseStageParams<TCommand extends ICommand> {
  chain: TCommand[]
  resolveResult: ICommandResolveResult
  optionPolicyMap: Map<TCommand, IOptionPolicyLike>
  ctx: ICommandContext
  restArgs: string[]
  rootCommandPath: string
  mustGetOptionPolicy: (
    optionPolicyMap: Map<TCommand, IOptionPolicyLike>,
    command: TCommand,
  ) => IOptionPolicyLike
  parseOptions: (params: {
    command: TCommand
    tokens: ICommandToken[]
    allOptions: ICommandOptionConfig[]
    envs: Record<string, string | undefined>
    commandPath: string
  }) => {
    opts: ICommandParsedOpts
    explicitOptionLongs: Set<string>
  }
  applyBuiltinDevmodeLogLevel: (params: {
    command: TCommand
    opts: ICommandParsedOpts
    explicitOptionLongs: Set<string>
  }) => void
  resolveBuiltinParsedOptions: (params: {
    command: TCommand
    opts: ICommandParsedOpts
  }) => ICommandBuiltinParsedOptions
  applyOptionCallbacks: (params: {
    command: TCommand
    opts: ICommandParsedOpts
    allOptions: ICommandOptionConfig[]
    ctx: ICommandContext
  }) => void
  getLocalOptions: (command: TCommand) => ICommandOptionConfig[]
  getSubcommands: (command: TCommand) => Array<ISubcommandEntry<TCommand>>
  getArguments: (command: TCommand) => ICommandArgumentConfig[]
  getCommandPath: (command: TCommand) => string
  withUnknownSubcommandIssue: (error: CommanderError) => CommanderError
  freezeInputSources: (sources: ICommandInputSources) => ICommandInputSources
}

export function parseStage<TCommand extends ICommand>(
  params: IParseStageParams<TCommand>,
): ICommandParseResult {
  const {
    chain,
    resolveResult,
    optionPolicyMap,
    ctx,
    restArgs,
    rootCommandPath,
    mustGetOptionPolicy,
    parseOptions,
    applyBuiltinDevmodeLogLevel,
    resolveBuiltinParsedOptions,
    applyOptionCallbacks,
    getLocalOptions,
    getSubcommands,
    getArguments,
    getCommandPath,
    withUnknownSubcommandIssue,
    freezeInputSources,
  } = params

  const { consumedTokens, argTokens } = resolveResult
  const leafCommand = chain[chain.length - 1]

  validateMergedShortOptions({
    chain,
    optionPolicyMap,
    mustGetOptionPolicy: (map, command) => mustGetOptionPolicy(map, command),
    rootCommandPath,
  })

  const optsMap = new Map<TCommand, ICommandParsedOpts>()
  const builtinMap = new Map<TCommand, ICommandBuiltinParsedOptions>()

  for (const command of chain) {
    const policy = mustGetOptionPolicy(optionPolicyMap, command)
    const tokens = consumedTokens.get(command) ?? []
    const commandPath = getCommandPath(command)
    const parseOptionsResult = parseOptions({
      command,
      tokens,
      allOptions: policy.mergedOptions,
      envs: ctx.envs,
      commandPath,
    })
    const opts = parseOptionsResult.opts

    applyBuiltinDevmodeLogLevel({
      command,
      opts,
      explicitOptionLongs: parseOptionsResult.explicitOptionLongs,
    })

    optsMap.set(command, opts)
    builtinMap.set(command, resolveBuiltinParsedOptions({ command, opts }))

    applyOptionCallbacks({
      command,
      opts,
      allOptions: policy.mergedOptions,
      ctx,
    })
  }

  const leafLocalOpts: ICommandParsedOpts = {}
  const leafParsedOpts = optsMap.get(leafCommand) ?? {}
  for (const option of getLocalOptions(leafCommand)) {
    if (Object.prototype.hasOwnProperty.call(leafParsedOpts, option.long)) {
      leafLocalOpts[option.long] = leafParsedOpts[option.long]
    }
  }

  const leafCommandPath = getCommandPath(leafCommand)
  const leafArguments = getArguments(leafCommand)
  assertUnknownSubcommand({
    userTailArgv: ctx.sources.user.argv,
    subcommands: getSubcommands(leafCommand),
    hasArguments: leafArguments.length > 0,
    commandPath: leafCommandPath,
    withDiagnosticsIssue: withUnknownSubcommandIssue,
  })

  const rawArgStrings = collectRawArguments({ argTokens, restArgs })
  const { args, rawArgs } = parseArguments({
    argumentDefs: leafArguments,
    rawArgs: rawArgStrings,
    commandPath: leafCommandPath,
  })

  const parseCtx: ICommandContext = {
    ...ctx,
    sources: freezeInputSources(ctx.sources),
  }

  return {
    ctx: parseCtx,
    builtin: builtinMap.get(leafCommand) ?? { devmode: false },
    opts: leafLocalOpts,
    args,
    rawArgs,
  }
}
