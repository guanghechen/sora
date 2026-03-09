import { parse as parseEnv } from '@guanghechen/env'
import { CommanderError } from '../../command/types'
import type { ICommandRuntime } from '../../command/types'
import type { IPresetFileSource, IResolvedPresetProfile } from '../preset/preset-profile-parser'

export function resolvePresetFileAbsolutePath(params: {
  runtime: ICommandRuntime
  filepath: string
  baseDirectory?: string
}): string {
  const { runtime, filepath, baseDirectory } = params
  if (runtime.isAbsolute(filepath)) {
    return filepath
  }
  return runtime.resolve(baseDirectory ?? runtime.cwd(), filepath)
}

export async function readPresetFile(params: {
  runtime: ICommandRuntime
  file: IPresetFileSource
  commandPath: string
}): Promise<string | undefined> {
  const { runtime, file, commandPath } = params

  try {
    const stats = await runtime.stat(file.absolutePath)
    if (stats.isDirectory()) {
      throw new Error('target is a directory')
    }
    return await runtime.readFile(file.absolutePath)
  } catch (error) {
    const ioError = error as { code?: string }
    if (!file.explicit && ioError.code === 'ENOENT') {
      return undefined
    }

    throw new CommanderError(
      'ConfigurationError',
      `failed to read preset file "${file.displayPath}": ${(error as Error).message}`,
      commandPath,
    )
  }
}

export function parsePresetEnvsContent(params: {
  content: string
  file: IPresetFileSource
  commandPath: string
}): Record<string, string> {
  const { content, file, commandPath } = params

  try {
    return parseEnv(content)
  } catch (error) {
    throw new CommanderError(
      'ConfigurationError',
      `failed to parse preset env file "${file.displayPath}": ${(error as Error).message}`,
      commandPath,
    )
  }
}

export async function buildPresetProfileInputs(params: {
  runtime: ICommandRuntime
  commandPath: string
  resolvedProfile: IResolvedPresetProfile | undefined
  validatePresetOptionTokens: (tokens: string[], filepath: string, commandPath: string) => void
}): Promise<{ presetArgv: string[]; presetEnvs: Record<string, string> }> {
  const { runtime, commandPath, resolvedProfile, validatePresetOptionTokens } = params

  const presetArgv: string[] = []
  if (resolvedProfile !== undefined && resolvedProfile.optsArgv.length > 0) {
    validatePresetOptionTokens(
      resolvedProfile.optsArgv,
      resolvedProfile.optsSourceLabel,
      commandPath,
    )
    presetArgv.push(...resolvedProfile.optsArgv)
  }

  const presetEnvs: Record<string, string> = {}
  if (resolvedProfile !== undefined) {
    if (resolvedProfile.profileEnvFileSource !== undefined) {
      const content = await readPresetFile({
        runtime,
        file: resolvedProfile.profileEnvFileSource,
        commandPath,
      })
      if (content !== undefined) {
        Object.assign(
          presetEnvs,
          parsePresetEnvsContent({
            content,
            file: resolvedProfile.profileEnvFileSource,
            commandPath,
          }),
        )
      }
    }
    Object.assign(presetEnvs, resolvedProfile.profileInlineEnvs)

    if (resolvedProfile.variantEnvFileSource !== undefined) {
      const content = await readPresetFile({
        runtime,
        file: resolvedProfile.variantEnvFileSource,
        commandPath,
      })
      if (content !== undefined) {
        Object.assign(
          presetEnvs,
          parsePresetEnvsContent({
            content,
            file: resolvedProfile.variantEnvFileSource,
            commandPath,
          }),
        )
      }
    }
    Object.assign(presetEnvs, resolvedProfile.variantInlineEnvs)
  }

  return { presetArgv, presetEnvs }
}
