import { CommanderError } from '../../command/types'
import type {
  ICommandArgvSegment,
  ICommandInputSources,
  ICommandPresetConfig,
  ICommandPresetIssueMeta,
  ICommandPresetResult,
  ICommandPresetSourceMeta,
  ICommandPresetSourceState,
  ICommandRuntime,
} from '../../command/types'
import { buildPresetProfileInputs } from '../command/preset'
import type { IResolvedPresetProfile } from '../preset/preset-profile-parser'

export function resolvePresetConfigFromChain<TCommand>(params: {
  chain: TCommand[]
  getPresetConfig: (command: TCommand) => ICommandPresetConfig | undefined
}): { presetFile: string | undefined; presetProfile: string | undefined } {
  const { chain, getPresetConfig } = params

  let presetFile: string | undefined
  let presetProfile: string | undefined

  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const presetConfig = getPresetConfig(chain[index])
    if (presetFile === undefined && presetConfig?.file !== undefined) {
      presetFile = presetConfig.file
    }
    if (presetProfile === undefined && presetConfig?.profile !== undefined) {
      presetProfile = presetConfig.profile
    }

    if (presetFile !== undefined && presetProfile !== undefined) {
      break
    }
  }

  return { presetFile, presetProfile }
}

export function scanPresetDirectives(params: {
  argv: string[]
  commandPath: string
  presetFileFlag: string
  presetProfileFlag: string
  assertPresetProfileSelectorValue: (value: string, sourceName: string, commandPath: string) => void
}): { cleanArgv: string[]; presetFile?: string; presetProfile?: string } {
  const { argv, commandPath, presetFileFlag, presetProfileFlag, assertPresetProfileSelectorValue } =
    params

  const cleanArgv: string[] = []
  let presetFile: string | undefined
  let presetProfile: string | undefined

  const assignDirective = (flag: string, value: string): void => {
    if (flag === presetFileFlag) {
      presetFile = value
      return
    }

    assertPresetProfileSelectorValue(value, presetProfileFlag, commandPath)
    presetProfile = value
  }

  let index = 0
  while (index < argv.length) {
    const token = argv[index]

    if (token === presetFileFlag || token === presetProfileFlag) {
      const value = argv[index + 1]
      if (value === undefined || value.length === 0) {
        throw new CommanderError('ConfigurationError', `missing value for "${token}"`, commandPath)
      }
      assignDirective(token, value)
      index += 2
      continue
    }

    if (token.startsWith(`${presetFileFlag}=`)) {
      const value = token.slice(presetFileFlag.length + 1)
      if (value.length === 0) {
        throw new CommanderError(
          'ConfigurationError',
          `missing value for "${presetFileFlag}"`,
          commandPath,
        )
      }
      assignDirective(presetFileFlag, value)
      index += 1
      continue
    }

    if (token.startsWith(`${presetProfileFlag}=`)) {
      const value = token.slice(presetProfileFlag.length + 1)
      if (value.length === 0) {
        throw new CommanderError(
          'ConfigurationError',
          `missing value for "${presetProfileFlag}"`,
          commandPath,
        )
      }
      assignDirective(presetProfileFlag, value)
      index += 1
      continue
    }

    cleanArgv.push(token)
    index += 1
  }

  return { cleanArgv, presetFile, presetProfile }
}

export function buildPresetSources(params: {
  userCmds: string[]
  userArgv: string[]
  userEnvs: Record<string, string | undefined>
  presetArgv: string[]
  presetEnvs: Record<string, string>
  presetMeta: ICommandPresetIssueMeta | undefined
  presetResolvedEnvFile: string | undefined
}): {
  sources: ICommandInputSources
  tailArgv: string[]
  envs: Record<string, string | undefined>
  segments: ICommandArgvSegment[]
} {
  const {
    userCmds,
    userArgv,
    userEnvs,
    presetArgv,
    presetEnvs,
    presetMeta,
    presetResolvedEnvFile,
  } = params

  const presetSourceMeta: ICommandPresetSourceMeta | undefined =
    presetMeta === undefined
      ? undefined
      : {
          applied: true,
          file: presetMeta.file,
          profile: presetMeta.profile,
          variant: presetMeta.variant,
          ...(presetResolvedEnvFile === undefined
            ? {}
            : {
                resolvedEnvFile: presetResolvedEnvFile,
              }),
        }
  const presetState: ICommandPresetSourceState = presetSourceMeta === undefined ? 'none' : 'applied'

  const sources: ICommandInputSources = {
    user: {
      cmds: [...userCmds],
      argv: [...userArgv],
      envs: { ...userEnvs },
    },
    preset: {
      state: presetState,
      argv: [...presetArgv],
      envs: { ...presetEnvs },
      meta: presetSourceMeta === undefined ? undefined : { ...presetSourceMeta },
    },
  }

  const envs = { ...sources.user.envs, ...sources.preset.envs }
  const tailArgv = [...sources.preset.argv, ...sources.user.argv]
  const segments: ICommandArgvSegment[] = [
    ...sources.preset.argv.map(value => ({
      value,
      source: 'preset' as const,
      preset:
        sources.preset.meta === undefined
          ? undefined
          : {
              file: sources.preset.meta.file,
              profile: sources.preset.meta.profile,
              variant: sources.preset.meta.variant,
            },
    })),
    ...sources.user.argv.map(value => ({ value, source: 'user' as const })),
  ]

  return {
    sources,
    tailArgv,
    envs,
    segments,
  }
}

export interface IResolvePresetStageParams<TCommand> {
  controlTailArgv: string[]
  chain: TCommand[]
  commandPath: string
  presetFileFlag: string
  presetProfileFlag: string
  getPresetConfig: (command: TCommand) => ICommandPresetConfig | undefined
  assertPresetProfileSelectorValue: (value: string, sourceName: string, commandPath: string) => void
  resolvePresetProfile: (params: {
    presetFile: string | undefined
    presetProfile: string | undefined
    presetProfileSourceName: string | undefined
    commandPath: string
  }) => Promise<IResolvedPresetProfile | undefined>
}

export async function resolvePresetStage<TCommand>(
  params: IResolvePresetStageParams<TCommand>,
): Promise<{ cleanArgv: string[]; resolvedProfile: IResolvedPresetProfile | undefined }> {
  const {
    controlTailArgv,
    chain,
    commandPath,
    presetFileFlag,
    presetProfileFlag,
    getPresetConfig,
    assertPresetProfileSelectorValue,
    resolvePresetProfile,
  } = params

  const separatorIndex = controlTailArgv.indexOf('--')
  const beforeSeparator =
    separatorIndex === -1 ? controlTailArgv : controlTailArgv.slice(0, separatorIndex)
  const afterSeparator = separatorIndex === -1 ? [] : controlTailArgv.slice(separatorIndex + 1)

  const profileScanResult = scanPresetDirectives({
    argv: beforeSeparator,
    commandPath,
    presetFileFlag,
    presetProfileFlag,
    assertPresetProfileSelectorValue,
  })

  const cleanArgv =
    separatorIndex === -1
      ? profileScanResult.cleanArgv
      : [...profileScanResult.cleanArgv, '--', ...afterSeparator]

  const resolvedCommandPresetConfig = resolvePresetConfigFromChain({
    chain,
    getPresetConfig,
  })
  const commandPresetFile = resolvedCommandPresetConfig.presetFile
  const effectivePresetFile = profileScanResult.presetFile ?? commandPresetFile

  const commandPresetProfile = resolvedCommandPresetConfig.presetProfile
  const useCommandPresetProfile =
    profileScanResult.presetProfile === undefined && commandPresetProfile !== undefined
  if (useCommandPresetProfile) {
    assertPresetProfileSelectorValue(commandPresetProfile, 'command.preset.profile', commandPath)
  }

  const effectivePresetProfile = profileScanResult.presetProfile ?? commandPresetProfile
  const effectivePresetProfileSourceName =
    profileScanResult.presetProfile !== undefined
      ? presetProfileFlag
      : commandPresetProfile !== undefined
        ? 'command.preset.profile'
        : undefined

  if (effectivePresetFile === undefined && useCommandPresetProfile) {
    throw new CommanderError(
      'ConfigurationError',
      'cannot use "command.preset.profile" without "command.preset.file" or "--preset-file"',
      commandPath,
    )
  }

  const resolvedProfile = await resolvePresetProfile({
    presetFile: effectivePresetFile,
    presetProfile: effectivePresetProfile,
    presetProfileSourceName: effectivePresetProfileSourceName,
    commandPath,
  })

  return { cleanArgv, resolvedProfile }
}

export async function runPresetStage<TCommand>(params: {
  controlTailArgv: string[]
  chain: TCommand[]
  commandPath: string
  presetFileFlag: string
  presetProfileFlag: string
  runtime: ICommandRuntime
  userCmds: string[]
  userEnvs: Record<string, string | undefined>
  getPresetConfig: (command: TCommand) => ICommandPresetConfig | undefined
  assertPresetProfileSelectorValue: (value: string, sourceName: string, commandPath: string) => void
  resolvePresetProfile: (params: {
    presetFile: string | undefined
    presetProfile: string | undefined
    presetProfileSourceName: string | undefined
    commandPath: string
  }) => Promise<IResolvedPresetProfile | undefined>
  validatePresetOptionTokens: (tokens: string[], filepath: string, commandPath: string) => void
}): Promise<
  ICommandPresetResult & { sources: ICommandInputSources; segments: ICommandArgvSegment[] }
> {
  const {
    controlTailArgv,
    chain,
    commandPath,
    presetFileFlag,
    presetProfileFlag,
    runtime,
    userCmds,
    userEnvs,
    getPresetConfig,
    assertPresetProfileSelectorValue,
    resolvePresetProfile,
    validatePresetOptionTokens,
  } = params

  const { cleanArgv, resolvedProfile } = await resolvePresetStage({
    controlTailArgv,
    chain,
    commandPath,
    presetFileFlag,
    presetProfileFlag,
    getPresetConfig,
    assertPresetProfileSelectorValue,
    resolvePresetProfile,
  })

  const { presetArgv, presetEnvs } = await buildPresetProfileInputs({
    runtime,
    commandPath,
    resolvedProfile,
    validatePresetOptionTokens,
  })

  const { tailArgv, envs, segments, sources } = buildPresetSources({
    userCmds,
    userArgv: cleanArgv,
    userEnvs,
    presetArgv,
    presetEnvs,
    presetMeta: resolvedProfile?.issueMeta,
    presetResolvedEnvFile: resolvePresetEnvFilePath(resolvedProfile),
  })

  return { tailArgv, envs, segments, sources }
}

function resolvePresetEnvFilePath(
  resolvedProfile: IResolvedPresetProfile | undefined,
): string | undefined {
  if (!resolvedProfile) {
    return undefined
  }

  return (
    resolvedProfile.variantEnvFileSource?.absolutePath ??
    resolvedProfile.profileEnvFileSource?.absolutePath
  )
}
