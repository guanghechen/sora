import { CommanderError } from '../../command/types'
import type {
  ICommandPresetIssueMeta,
  ICommandPresetProfileItem,
  ICommandPresetProfileManifest,
  ICommandPresetProfileOptionValue,
  ICommandPresetProfileVariantItem,
} from '../../command/types'

export const PRESET_FILE_FLAG = '--preset-file'
export const PRESET_PROFILE_FLAG = '--preset-profile'
const PRESET_SELECTOR_DELIMITER = ':'
const PRESET_PROFILE_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const PRESET_VARIANT_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

interface IPresetProfileSelector {
  profileName: string
  variantName?: string
}

export interface IPresetFileSource {
  displayPath: string
  absolutePath: string
  explicit: boolean
}

export interface IResolvedPresetProfile {
  profileName: string
  variantName: string | undefined
  optsArgv: string[]
  optsSourceLabel: string
  issueMeta: ICommandPresetIssueMeta
  profileInlineEnvs: Record<string, string>
  variantInlineEnvs: Record<string, string>
  profileEnvFileSource?: IPresetFileSource
  variantEnvFileSource?: IPresetFileSource
}

export interface IResolvePresetProfileParams {
  presetFile: string | undefined
  presetProfile: string | undefined
  presetProfileSourceName: string | undefined
  commandPath: string
}

function kebabToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function camelToKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}

export class CommandPresetProfileParser {
  readonly #resolvePresetFileAbsolutePath: (filepath: string, baseDirectory?: string) => string
  readonly #resolvePath: (...paths: string[]) => string
  readonly #readPresetFile: (
    file: IPresetFileSource,
    commandPath: string,
  ) => Promise<string | undefined>

  constructor(params: {
    resolvePresetFileAbsolutePath: (filepath: string, baseDirectory?: string) => string
    resolvePath: (...paths: string[]) => string
    readPresetFile: (file: IPresetFileSource, commandPath: string) => Promise<string | undefined>
  }) {
    this.#resolvePresetFileAbsolutePath = params.resolvePresetFileAbsolutePath
    this.#resolvePath = params.resolvePath
    this.#readPresetFile = params.readPresetFile
  }

  public async resolvePresetProfile(
    params: IResolvePresetProfileParams,
  ): Promise<IResolvedPresetProfile | undefined> {
    const { presetFile, presetProfile, presetProfileSourceName, commandPath } = params

    if (presetFile === undefined) {
      if (presetProfile !== undefined) {
        throw new CommanderError(
          'ConfigurationError',
          `cannot use "${PRESET_PROFILE_FLAG}" without "${PRESET_FILE_FLAG}"`,
          commandPath,
        )
      }
      return undefined
    }

    const profileFile = {
      displayPath: presetFile,
      absolutePath: this.#resolvePresetFileAbsolutePath(presetFile),
      explicit: true,
    }

    const content = await this.#readPresetFile(profileFile, commandPath)
    if (content === undefined) {
      return undefined
    }
    const manifest = this.#parsePresetProfileManifest(content, profileFile.displayPath, commandPath)

    const resolvedProfileSelector = presetProfile ?? manifest.defaults?.profile
    if (resolvedProfileSelector === undefined) {
      throw new CommanderError(
        'ConfigurationError',
        `missing profile for preset file "${profileFile.displayPath}": provide "${PRESET_PROFILE_FLAG}" or defaults.profile`,
        commandPath,
      )
    }

    const { profileName: resolvedProfileName, variantName: explicitVariantName } =
      this.#parsePresetProfileSelector(
        resolvedProfileSelector,
        presetProfileSourceName ?? 'defaults.profile',
        commandPath,
      )
    const profile = manifest.profiles[resolvedProfileName]
    if (profile === undefined) {
      throw new CommanderError(
        'ConfigurationError',
        `unknown preset profile "${resolvedProfileName}" in "${profileFile.displayPath}"`,
        commandPath,
      )
    }

    const selectedVariantName = explicitVariantName ?? profile.defaultVariant
    let selectedVariant: ICommandPresetProfileVariantItem | undefined
    if (selectedVariantName !== undefined) {
      const variants = profile.variants ?? {}
      selectedVariant = variants[selectedVariantName]
      if (selectedVariant === undefined) {
        const availableVariants = Object.keys(variants)
        const availableText = availableVariants.length > 0 ? availableVariants.join(', ') : '<none>'
        throw new CommanderError(
          'ConfigurationError',
          `unknown preset variant "${selectedVariantName}" for profile "${resolvedProfileName}" in "${profileFile.displayPath}" (available: ${availableText})`,
          commandPath,
        )
      }
    }

    const profileSelectorLabel =
      selectedVariantName === undefined
        ? resolvedProfileName
        : `${resolvedProfileName}${PRESET_SELECTOR_DELIMITER}${selectedVariantName}`

    const mergedOpts = { ...(profile.opts ?? {}), ...(selectedVariant?.opts ?? {}) }

    const optsArgv = this.#buildPresetArgvFromProfileOptions(
      mergedOpts,
      profileSelectorLabel,
      commandPath,
    )
    const profileInlineEnvs = this.#normalizePresetProfileEnvs(profile.envs)
    const variantInlineEnvs = this.#normalizePresetProfileEnvs(selectedVariant?.envs)

    const profileDir = this.#resolvePath(profileFile.absolutePath, '..')
    let profileEnvFileSource: IPresetFileSource | undefined
    if (profile.envFile !== undefined) {
      profileEnvFileSource = {
        displayPath: profile.envFile,
        absolutePath: this.#resolvePresetFileAbsolutePath(profile.envFile, profileDir),
        explicit: true,
      }
    }
    let variantEnvFileSource: IPresetFileSource | undefined
    if (selectedVariant?.envFile !== undefined) {
      variantEnvFileSource = {
        displayPath: selectedVariant.envFile,
        absolutePath: this.#resolvePresetFileAbsolutePath(selectedVariant.envFile, profileDir),
        explicit: true,
      }
    }

    return {
      profileName: resolvedProfileName,
      variantName: selectedVariantName,
      optsArgv,
      optsSourceLabel: `${profileFile.displayPath}#${profileSelectorLabel}.opts`,
      issueMeta: {
        file: profileFile.displayPath,
        profile: resolvedProfileName,
        variant: selectedVariantName,
      },
      profileInlineEnvs,
      variantInlineEnvs,
      profileEnvFileSource,
      variantEnvFileSource,
    }
  }

  public assertPresetProfileSelectorValue(
    selector: string,
    sourceName: string,
    commandPath: string,
  ): void {
    void this.#parsePresetProfileSelector(selector, sourceName, commandPath)
  }

  public validatePresetOptionTokens(tokens: string[], filepath: string, commandPath: string): void {
    if (tokens.length === 0) {
      return
    }

    if (!tokens[0].startsWith('-')) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset options in "${filepath}": bare token "${tokens[0]}" cannot appear before any option token`,
        commandPath,
      )
    }

    for (const token of tokens) {
      if (token === '--') {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset options in "${filepath}": "--" is not allowed`,
          commandPath,
        )
      }

      if (token === 'help' || token === '--help' || token === '--version') {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset options in "${filepath}": control token "${token}" is not allowed`,
          commandPath,
        )
      }

      if (
        token === PRESET_FILE_FLAG ||
        token.startsWith(`${PRESET_FILE_FLAG}=`) ||
        token === PRESET_PROFILE_FLAG ||
        token.startsWith(`${PRESET_PROFILE_FLAG}=`)
      ) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset options in "${filepath}": preset directive "${token}" is not allowed`,
          commandPath,
        )
      }
    }
  }

  #parsePresetProfileManifest(
    content: string,
    filepath: string,
    commandPath: string,
  ): ICommandPresetProfileManifest {
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch (error) {
      throw new CommanderError(
        'ConfigurationError',
        `failed to parse preset file "${filepath}": ${(error as Error).message}`,
        commandPath,
      )
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset file "${filepath}": root must be an object`,
        commandPath,
      )
    }

    const root = parsed as Record<string, unknown>
    if (root.version !== 1) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset file "${filepath}": "version" must be 1`,
        commandPath,
      )
    }

    let defaults: ICommandPresetProfileManifest['defaults']
    const rawDefaults = root.defaults
    if (rawDefaults !== undefined) {
      if (typeof rawDefaults !== 'object' || rawDefaults === null || Array.isArray(rawDefaults)) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset file "${filepath}": "defaults" must be an object`,
          commandPath,
        )
      }
      const defaultsRecord = rawDefaults as Record<string, unknown>
      if (defaultsRecord.profile !== undefined) {
        if (typeof defaultsRecord.profile !== 'string') {
          throw new CommanderError(
            'ConfigurationError',
            `invalid preset file "${filepath}": "defaults.profile" must be a string`,
            commandPath,
          )
        }
        this.assertPresetProfileSelectorValue(
          defaultsRecord.profile,
          'defaults.profile',
          commandPath,
        )
      }
      defaults = { profile: defaultsRecord.profile as string | undefined }
    }

    const rawProfiles = root.profiles
    if (typeof rawProfiles !== 'object' || rawProfiles === null || Array.isArray(rawProfiles)) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid preset file "${filepath}": "profiles" must be an object`,
        commandPath,
      )
    }

    const profilesRecord: Record<string, ICommandPresetProfileItem> = {}
    for (const [profileName, profileValue] of Object.entries(rawProfiles)) {
      this.#assertPresetProfileName(profileName, `profiles["${profileName}"]`, commandPath)
      if (
        typeof profileValue !== 'object' ||
        profileValue === null ||
        Array.isArray(profileValue)
      ) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid preset file "${filepath}": profile "${profileName}" must be an object`,
          commandPath,
        )
      }
      profilesRecord[profileName] = this.#parsePresetProfileItem(
        profileValue as Record<string, unknown>,
        profileName,
        filepath,
        commandPath,
      )
    }

    return {
      version: 1,
      defaults,
      profiles: profilesRecord,
    }
  }

  #parsePresetProfileItem(
    profileValue: Record<string, unknown>,
    profileName: string,
    filepath: string,
    commandPath: string,
  ): ICommandPresetProfileItem {
    const labelPrefix = `invalid preset file "${filepath}": profile "${profileName}"`

    const envFile = profileValue.envFile
    if (envFile !== undefined) {
      if (typeof envFile !== 'string') {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.envFile must be a string`,
          commandPath,
        )
      }
    }

    const rawEnvs = profileValue.envs
    let envs: Record<string, string> | undefined
    if (rawEnvs !== undefined) {
      if (typeof rawEnvs !== 'object' || rawEnvs === null || Array.isArray(rawEnvs)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.envs must be an object`,
          commandPath,
        )
      }
      envs = {}
      for (const [key, value] of Object.entries(rawEnvs as Record<string, unknown>)) {
        if (typeof value !== 'string') {
          throw new CommanderError(
            'ConfigurationError',
            `${labelPrefix}.envs["${key}"] must be a string`,
            commandPath,
          )
        }
        envs[key] = value
      }
    }

    const rawOpts = profileValue.opts
    let opts: Record<string, ICommandPresetProfileOptionValue> | undefined
    if (rawOpts !== undefined) {
      if (typeof rawOpts !== 'object' || rawOpts === null || Array.isArray(rawOpts)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.opts must be an object`,
          commandPath,
        )
      }
      opts = {}
      for (const [key, value] of Object.entries(rawOpts as Record<string, unknown>)) {
        opts[key] = this.#parsePresetProfileOptionValue(
          value,
          `${labelPrefix}.opts["${key}"]`,
          commandPath,
        )
      }
    }

    const rawDefaultVariant = profileValue.defaultVariant
    let defaultVariant: string | undefined
    if (rawDefaultVariant !== undefined) {
      if (typeof rawDefaultVariant !== 'string') {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.defaultVariant must be a string`,
          commandPath,
        )
      }
      this.#assertPresetVariantName(rawDefaultVariant, `${labelPrefix}.defaultVariant`, commandPath)
      defaultVariant = rawDefaultVariant
    }

    const rawVariants = profileValue.variants
    let variants: Record<string, ICommandPresetProfileVariantItem> | undefined
    if (rawVariants !== undefined) {
      if (typeof rawVariants !== 'object' || rawVariants === null || Array.isArray(rawVariants)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.variants must be an object`,
          commandPath,
        )
      }

      variants = {}
      for (const [variantName, variantValue] of Object.entries(
        rawVariants as Record<string, unknown>,
      )) {
        this.#assertPresetVariantName(
          variantName,
          `${labelPrefix}.variants["${variantName}"]`,
          commandPath,
        )
        if (
          typeof variantValue !== 'object' ||
          variantValue === null ||
          Array.isArray(variantValue)
        ) {
          throw new CommanderError(
            'ConfigurationError',
            `${labelPrefix}.variants["${variantName}"] must be an object`,
            commandPath,
          )
        }
        variants[variantName] = this.#parsePresetProfileVariantItem(
          variantValue as Record<string, unknown>,
          `${labelPrefix}.variants["${variantName}"]`,
          commandPath,
        )
      }
    }

    if (
      defaultVariant !== undefined &&
      (variants === undefined || variants[defaultVariant] === undefined)
    ) {
      throw new CommanderError(
        'ConfigurationError',
        `${labelPrefix}.defaultVariant "${defaultVariant}" is not found in variants`,
        commandPath,
      )
    }

    return {
      envFile,
      envs,
      opts,
      defaultVariant,
      variants,
    }
  }

  #parsePresetProfileVariantItem(
    variantValue: Record<string, unknown>,
    labelPrefix: string,
    commandPath: string,
  ): ICommandPresetProfileVariantItem {
    const envFile = variantValue.envFile
    if (envFile !== undefined) {
      if (typeof envFile !== 'string') {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.envFile must be a string`,
          commandPath,
        )
      }
    }

    const rawEnvs = variantValue.envs
    let envs: Record<string, string> | undefined
    if (rawEnvs !== undefined) {
      if (typeof rawEnvs !== 'object' || rawEnvs === null || Array.isArray(rawEnvs)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.envs must be an object`,
          commandPath,
        )
      }
      envs = {}
      for (const [key, value] of Object.entries(rawEnvs as Record<string, unknown>)) {
        if (typeof value !== 'string') {
          throw new CommanderError(
            'ConfigurationError',
            `${labelPrefix}.envs["${key}"] must be a string`,
            commandPath,
          )
        }
        envs[key] = value
      }
    }

    const rawOpts = variantValue.opts
    let opts: Record<string, ICommandPresetProfileOptionValue> | undefined
    if (rawOpts !== undefined) {
      if (typeof rawOpts !== 'object' || rawOpts === null || Array.isArray(rawOpts)) {
        throw new CommanderError(
          'ConfigurationError',
          `${labelPrefix}.opts must be an object`,
          commandPath,
        )
      }
      opts = {}
      for (const [key, value] of Object.entries(rawOpts as Record<string, unknown>)) {
        opts[key] = this.#parsePresetProfileOptionValue(
          value,
          `${labelPrefix}.opts["${key}"]`,
          commandPath,
        )
      }
    }

    return {
      envFile,
      envs,
      opts,
    }
  }

  #parsePresetProfileOptionValue(
    value: unknown,
    valueLabel: string,
    commandPath: string,
  ): ICommandPresetProfileOptionValue {
    if (typeof value === 'boolean' || typeof value === 'string') {
      return value
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new CommanderError(
          'ConfigurationError',
          `${valueLabel} must be a finite number`,
          commandPath,
        )
      }
      return value
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        if (typeof item === 'string') {
          return item
        }
        if (typeof item === 'number' && Number.isFinite(item)) {
          return item
        }
        throw new CommanderError(
          'ConfigurationError',
          `${valueLabel}[${index}] must be a string or finite number`,
          commandPath,
        )
      })
    }

    throw new CommanderError(
      'ConfigurationError',
      `${valueLabel} must be boolean|string|number|(string|number)[]`,
      commandPath,
    )
  }

  #normalizePresetProfileEnvs(envs: Record<string, string> | undefined): Record<string, string> {
    return envs === undefined ? {} : { ...envs }
  }

  #normalizePresetOptionName(rawName: string, profileName: string, commandPath: string): string {
    const value = rawName.trim()
    if (value.length === 0) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid option name "" in preset profile "${profileName}"`,
        commandPath,
      )
    }

    const stripped = value.startsWith('--') ? value.slice(2) : value
    if (stripped.length === 0) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid option name "${rawName}" in preset profile "${profileName}"`,
        commandPath,
      )
    }

    if (stripped.includes('-')) {
      const lowered = stripped.toLowerCase()
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(lowered)) {
        throw new CommanderError(
          'ConfigurationError',
          `invalid option name "${rawName}" in preset profile "${profileName}"`,
          commandPath,
        )
      }
      return kebabToCamelCase(lowered)
    }

    if (!/^[a-z][a-zA-Z0-9]*$/.test(stripped)) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid option name "${rawName}" in preset profile "${profileName}"`,
        commandPath,
      )
    }

    return stripped
  }

  #buildPresetArgvFromProfileOptions(
    opts: Record<string, ICommandPresetProfileOptionValue>,
    profileName: string,
    commandPath: string,
  ): string[] {
    const argv: string[] = []

    for (const [rawName, rawValue] of Object.entries(opts)) {
      const optionName = this.#normalizePresetOptionName(rawName, profileName, commandPath)
      const kebabName = camelToKebabCase(optionName)
      const positiveFlag = `--${kebabName}`
      const negativeFlag = `--no-${kebabName}`

      if (typeof rawValue === 'boolean') {
        argv.push(rawValue ? positiveFlag : negativeFlag)
        continue
      }

      if (typeof rawValue === 'string') {
        argv.push(positiveFlag, rawValue)
        continue
      }

      if (typeof rawValue === 'number') {
        argv.push(positiveFlag, String(rawValue))
        continue
      }

      if (rawValue.length === 0) {
        continue
      }

      argv.push(positiveFlag, ...rawValue.map(value => String(value)))
    }

    return argv
  }

  #parsePresetProfileSelector(
    selector: string,
    sourceName: string,
    commandPath: string,
  ): IPresetProfileSelector {
    const normalizedSelector = selector.trim()
    const separatorIndex = normalizedSelector.indexOf(PRESET_SELECTOR_DELIMITER)
    if (separatorIndex < 0) {
      this.#assertPresetProfileName(normalizedSelector, sourceName, commandPath)
      return { profileName: normalizedSelector }
    }

    if (normalizedSelector.indexOf(PRESET_SELECTOR_DELIMITER, separatorIndex + 1) >= 0) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid value for "${sourceName}": "${selector}" (must be "<profile>" or "<profile>:<variant>")`,
        commandPath,
      )
    }

    const profileName = normalizedSelector.slice(0, separatorIndex)
    const variantName = normalizedSelector.slice(separatorIndex + 1)
    if (profileName.length === 0 || variantName.length === 0) {
      throw new CommanderError(
        'ConfigurationError',
        `invalid value for "${sourceName}": "${selector}" (must be "<profile>" or "<profile>:<variant>")`,
        commandPath,
      )
    }

    this.#assertPresetProfileName(profileName, sourceName, commandPath)
    this.#assertPresetVariantName(variantName, sourceName, commandPath)
    return { profileName, variantName }
  }

  #assertPresetProfileName(profileName: string, sourceName: string, commandPath: string): void {
    if (PRESET_PROFILE_NAME_REGEX.test(profileName)) {
      return
    }

    throw new CommanderError(
      'ConfigurationError',
      `invalid profile name for "${sourceName}": "${profileName}" (must match ${PRESET_PROFILE_NAME_REGEX.source})`,
      commandPath,
    )
  }

  #assertPresetVariantName(variantName: string, sourceName: string, commandPath: string): void {
    if (PRESET_VARIANT_NAME_REGEX.test(variantName)) {
      return
    }

    throw new CommanderError(
      'ConfigurationError',
      `invalid variant name for "${sourceName}": "${variantName}" (must match ${PRESET_VARIANT_NAME_REGEX.source})`,
      commandPath,
    )
  }
}
