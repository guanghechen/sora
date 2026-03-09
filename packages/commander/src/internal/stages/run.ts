import { CommanderError } from '../../command/types'
import type { ICommandActionParams } from '../../command/types'

export async function runStage<TCommand>(params: {
  leafCommand: TCommand
  actionParams: ICommandActionParams
  tailArgv: string[]
  envs: Record<string, string | undefined>
  hasAction: (command: TCommand) => boolean
  runAction: (command: TCommand, actionParams: ICommandActionParams) => Promise<void>
  hasSubcommands: (command: TCommand) => boolean
  renderHelpForDisplay: (
    command: TCommand,
    options: { tailArgv: string[]; envs: Record<string, string | undefined> },
  ) => string
  print: (content: string) => void
  getCommandPath: (command: TCommand) => string
}): Promise<void> {
  const {
    leafCommand,
    actionParams,
    tailArgv,
    envs,
    hasAction,
    runAction,
    hasSubcommands,
    renderHelpForDisplay,
    print,
    getCommandPath,
  } = params

  if (hasAction(leafCommand)) {
    await runAction(leafCommand, actionParams)
    return
  }

  if (hasSubcommands(leafCommand)) {
    print(
      renderHelpForDisplay(leafCommand, {
        tailArgv,
        envs,
      }),
    )
    return
  }

  throw new CommanderError(
    'ConfigurationError',
    `no action defined for command "${getCommandPath(leafCommand)}"`,
    getCommandPath(leafCommand),
  )
}
