import { CommanderError } from '../../command/types'
import type { ICommandControlScanResult, ICommandParseResult } from '../../command/types'
import type { ICommandExecutionTermination, IExecutionOutcome } from '../command-kernel'

interface IRouteResult<TCommand> {
  chain: TCommand[]
  remaining: string[]
}

function getExitCode(error: CommanderError): number {
  return error.kind === 'ActionFailed' ? 1 : 2
}

function renderTermination<TCommand>(params: {
  termination: ICommandExecutionTermination
  argv: string[]
  envs: Record<string, string | undefined>
  route: (argv: string[]) => IRouteResult<TCommand>
  controlScan: (tailArgv: string[], leafCommand: TCommand) => ICommandControlScanResult
  findCommandByPath: (commandPath: string) => TCommand | undefined
  resolveHelpCommand: (leafCommand: TCommand, helpTarget: string | undefined) => TCommand
  resolveHelpColor: (
    command: TCommand,
    tailArgv: string[],
    envs: Record<string, string | undefined>,
  ) => boolean
  formatHelpForDisplay: (command: TCommand, color: boolean) => string
  print: (content: string) => void
}): void {
  const {
    termination,
    argv,
    envs,
    route,
    controlScan,
    findCommandByPath,
    resolveHelpCommand,
    resolveHelpColor,
    formatHelpForDisplay,
    print,
  } = params

  if (termination.kind === 'version') {
    print(termination.version)
    return
  }

  const routeResult = route(argv)
  const leafCommand = routeResult.chain[routeResult.chain.length - 1]
  const controlScanResult = controlScan(routeResult.remaining, leafCommand)
  const helpCommand =
    findCommandByPath(termination.targetCommandPath) ??
    resolveHelpCommand(leafCommand, controlScanResult.helpTarget)
  const helpColor = resolveHelpColor(helpCommand, controlScanResult.remaining, envs)
  print(formatHelpForDisplay(helpCommand, helpColor))
}

export function handleRunOutcome<TCommand>(params: {
  outcome: IExecutionOutcome
  argv: string[]
  envs: Record<string, string | undefined>
  route: (argv: string[]) => IRouteResult<TCommand>
  controlScan: (tailArgv: string[], leafCommand: TCommand) => ICommandControlScanResult
  findCommandByPath: (commandPath: string) => TCommand | undefined
  resolveHelpCommand: (leafCommand: TCommand, helpTarget: string | undefined) => TCommand
  resolveHelpColor: (
    command: TCommand,
    tailArgv: string[],
    envs: Record<string, string | undefined>,
  ) => boolean
  formatHelpForDisplay: (command: TCommand, color: boolean) => string
  print: (content: string) => void
  printError: (content: string) => void
  exit: (code: number) => void
  normalizeControlRunError: (error: CommanderError) => CommanderError
}): void {
  const {
    outcome,
    argv,
    envs,
    route,
    controlScan,
    findCommandByPath,
    resolveHelpCommand,
    resolveHelpColor,
    formatHelpForDisplay,
    print,
    printError,
    exit,
    normalizeControlRunError,
  } = params

  if (outcome.kind === 'parsed') {
    return
  }

  if (outcome.kind === 'terminated') {
    try {
      renderTermination({
        termination: outcome.termination,
        argv,
        envs,
        route,
        controlScan,
        findCommandByPath,
        resolveHelpCommand,
        resolveHelpColor,
        formatHelpForDisplay,
        print,
      })
      return
    } catch (error) {
      if (error instanceof CommanderError) {
        const normalizedError = normalizeControlRunError(error)
        printError(normalizedError.format())
        exit(getExitCode(normalizedError))
        return
      }

      throw error
    }
  }

  printError(outcome.error.format())
  exit(getExitCode(outcome.error))
}

export function unwrapParseOutcome(params: {
  outcome: IExecutionOutcome
  commandPath: string
}): ICommandParseResult {
  const { outcome, commandPath } = params

  if (outcome.kind === 'parsed') {
    return outcome.parseResult
  }

  if (outcome.kind === 'terminated') {
    throw new CommanderError(
      'ConfigurationError',
      'internal invariant violation: parse mode must not produce termination',
      commandPath,
    )
  }

  throw outcome.error
}
