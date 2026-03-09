import type { ICommandControlScanResult, ICommandControls } from '../../command/types'
import type { ICommandExecutionTermination } from '../command-kernel'

export function scanControl(params: {
  tailArgv: string[]
  supportsBuiltinVersion: boolean
}): ICommandControlScanResult {
  const { tailArgv, supportsBuiltinVersion } = params
  const controls: ICommandControls = { help: false, version: false }
  const separatorIndex = tailArgv.indexOf('--')
  const beforeSeparator = separatorIndex === -1 ? tailArgv : tailArgv.slice(0, separatorIndex)
  const afterSeparator = separatorIndex === -1 ? [] : tailArgv.slice(separatorIndex + 1)

  let helpTarget: string | undefined
  let scanStartIndex = 0

  if (beforeSeparator[0] === 'help') {
    controls.help = true
    scanStartIndex = 1
    const candidate = beforeSeparator[1]
    if (candidate !== undefined && !candidate.startsWith('-')) {
      helpTarget = candidate
      scanStartIndex = 2
    }
  }

  const remainingBeforeSeparator: string[] = []
  for (let index = scanStartIndex; index < beforeSeparator.length; index += 1) {
    const token = beforeSeparator[index]

    if (token === '--help') {
      controls.help = true
      continue
    }

    if (token === '--version' && supportsBuiltinVersion) {
      controls.version = true
      continue
    }

    remainingBeforeSeparator.push(token)
  }

  return {
    controls,
    remaining:
      separatorIndex === -1
        ? remainingBeforeSeparator
        : [...remainingBeforeSeparator, '--', ...afterSeparator],
    helpTarget,
  }
}

export function runControl<TCommand>(params: {
  leafCommand: TCommand
  controlScanResult: ICommandControlScanResult
  resolveHelpCommand: (leafCommand: TCommand, helpTarget: string | undefined) => TCommand
  getCommandPath: (command: TCommand) => string
  getCommandVersion: (command: TCommand) => string | undefined
}): ICommandExecutionTermination | undefined {
  const { leafCommand, controlScanResult, resolveHelpCommand, getCommandPath, getCommandVersion } =
    params

  if (controlScanResult.controls.help) {
    const helpCommand = resolveHelpCommand(leafCommand, controlScanResult.helpTarget)
    return {
      kind: 'help',
      targetCommandPath: getCommandPath(helpCommand),
    }
  }

  if (controlScanResult.controls.version) {
    const version = getCommandVersion(leafCommand)
    if (version !== undefined) {
      return {
        kind: 'version',
        targetCommandPath: getCommandPath(leafCommand),
        version,
      }
    }
  }

  return undefined
}
