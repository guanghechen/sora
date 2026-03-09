/** Token type: long option, short option, or positional */
export type ICommandTokenType = 'long' | 'short' | 'none'

/** Token source kind */
export type ICommandTokenSource = 'user' | 'preset'

/** Preset metadata carried by token/issue source tracing */
export interface ICommandPresetIssueMeta {
  file?: string
  profile?: string
  variant?: string
  optionKey?: string
}

/** Preset source snapshot metadata carried by ctx.sources.preset.meta */
export interface ICommandPresetSourceMeta {
  applied: boolean
  file?: string
  profile?: string
  variant?: string
}

/** Preset execution state in input source snapshot */
export type ICommandPresetSourceState = 'skipped' | 'none' | 'applied'

/** Input segment before tokenize, preserving source attribution */
export interface ICommandArgvSegment {
  value: string
  source: ICommandTokenSource
  preset?: ICommandPresetIssueMeta
}

/**
 * Command token after preprocessing.
 *
 * - original: raw input for error messages (e.g., --LOG-LEVEL=info, -v)
 * - resolved: normalized form (e.g., --logLevel=info, -v)
 * - name: option name for matching (e.g., logLevel, v, '')
 * - type: token type (long/short/none)
 */
export interface ICommandToken {
  /** Raw input, used for error display */
  original: string
  /** Normalized form, used for parsing */
  resolved: string
  /** Option name for matching: camelCase for long, single char for short, '' for positional */
  name: string
  /** Token type */
  type: ICommandTokenType
  /** Source of this token */
  source: ICommandTokenSource
  /** Preset metadata when source='preset' */
  preset?: ICommandPresetIssueMeta
}
