import { CommanderError } from '../../command/types'
import type { ICommandAction, ICommandActionParams, ICommandErrorIssue } from '../../command/types'

export async function runCommandAction(params: {
  action: ICommandAction | undefined
  actionParams: ICommandActionParams
  commandPath: string
}): Promise<void> {
  const { action, actionParams, commandPath } = params
  if (action === undefined) {
    return
  }

  try {
    await action(actionParams)
  } catch (err) {
    if (err instanceof CommanderError) {
      throw err
    }

    const issue: ICommandErrorIssue = {
      kind: 'error',
      stage: 'run',
      scope: 'action',
      reason: {
        code: 'action_failed',
        message: err instanceof Error ? err.message : 'action failed',
        details:
          err instanceof Error
            ? {
                errorName: err.name,
                errorMessage: err.message,
              }
            : {
                errorValue: String(err),
              },
      },
    }

    throw new CommanderError(
      'ActionFailed',
      err instanceof Error ? err.message : 'action failed',
      commandPath,
    ).withIssue(issue)
  }
}
