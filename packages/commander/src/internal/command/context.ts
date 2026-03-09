import type { IReporter } from '@guanghechen/reporter'
import type { ICommand, ICommandContext, ICommandInputSources } from '../../command/types'

export function createCommandContext(params: {
  leafCommand: ICommand
  chain: ICommand[]
  cmds: string[]
  envs: Record<string, string | undefined>
  reporter: IReporter
}): ICommandContext {
  const { leafCommand, chain, cmds, envs, reporter } = params
  const envSnapshot = { ...envs }

  return {
    cmd: leafCommand,
    chain,
    envs: envSnapshot,
    controls: { help: false, version: false },
    sources: {
      preset: {
        state: 'none',
        argv: [],
        envs: {},
      },
      user: {
        cmds: [...cmds],
        argv: [],
        envs: envSnapshot,
      },
    },
    reporter,
  }
}

export function freezeInputSources(sources: ICommandInputSources): ICommandInputSources {
  return Object.freeze({
    preset: Object.freeze({
      state: sources.preset.state,
      argv: Object.freeze([...sources.preset.argv]),
      envs: Object.freeze({ ...sources.preset.envs }),
      meta:
        sources.preset.meta === undefined ? undefined : Object.freeze({ ...sources.preset.meta }),
    }),
    user: Object.freeze({
      cmds: Object.freeze([...sources.user.cmds]),
      argv: Object.freeze([...sources.user.argv]),
      envs: Object.freeze({ ...sources.user.envs }),
    }),
  }) as ICommandInputSources
}
