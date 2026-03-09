import type { ICommandRouteResult, ISubcommandEntry } from '../../command/types'

export function findSubcommandEntry<TCommand>(
  entries: Array<ISubcommandEntry<TCommand>>,
  token: string,
): ISubcommandEntry<TCommand> | undefined {
  return entries.find(entry => entry.name === token || entry.aliases.includes(token))
}

export function routeCommandChain<TCommand>(params: {
  root: TCommand
  argv: string[]
  getSubcommandEntries: (command: TCommand) => Array<ISubcommandEntry<TCommand>>
}): ICommandRouteResult<TCommand> {
  const { root, argv, getSubcommandEntries } = params
  const chain: TCommand[] = [root]
  const cmds: string[] = []
  let current = root
  let index = 0

  while (index < argv.length) {
    const token = argv[index]
    if (token.startsWith('-')) {
      break
    }

    const entry = findSubcommandEntry(getSubcommandEntries(current), token)
    if (entry === undefined) {
      break
    }

    current = entry.command
    cmds.push(token)
    chain.push(current)
    index += 1
  }

  return {
    chain,
    cmds,
    remaining: argv.slice(index),
  }
}

export function resolveHelpCommand<TCommand>(params: {
  leafCommand: TCommand
  helpTarget: string | undefined
  getSubcommandEntries: (command: TCommand) => Array<ISubcommandEntry<TCommand>>
}): TCommand {
  const { leafCommand, helpTarget, getSubcommandEntries } = params
  if (helpTarget === undefined) {
    return leafCommand
  }

  const entry = findSubcommandEntry(getSubcommandEntries(leafCommand), helpTarget)
  if (entry === undefined) {
    return leafCommand
  }

  return entry.command
}

export function findCommandByPath<TCommand>(params: {
  root: TCommand
  commandPath: string
  getCommandName: (command: TCommand) => string | undefined
  getSubcommandEntries: (command: TCommand) => Array<ISubcommandEntry<TCommand>>
}): TCommand | undefined {
  const { root, commandPath, getCommandName, getSubcommandEntries } = params
  if (!commandPath) {
    return root
  }

  const segments = commandPath.split(' ').filter(Boolean)
  if (segments.length === 0) {
    return root
  }

  let startIndex = 0
  const rootName = getCommandName(root)
  if (rootName !== undefined && segments[0] === rootName) {
    startIndex = 1
  }

  let current: TCommand | undefined = root
  for (const segment of segments.slice(startIndex)) {
    if (current === undefined) {
      return undefined
    }
    const entry: ISubcommandEntry<TCommand> | undefined = findSubcommandEntry(
      getSubcommandEntries(current),
      segment,
    )
    current = entry?.command
  }

  return current
}
