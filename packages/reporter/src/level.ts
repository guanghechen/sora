import type { IChalkBuilder } from '@guanghechen/chalk.types'
import { ReporterLevelEnum } from '@guanghechen/reporter.types'

export interface IChalkPair {
  readonly fg: IChalkBuilder
  readonly bg?: IChalkBuilder | undefined
}

export interface ILevelStyle {
  title: string
  labelChalk: IChalkPair
  contentChalk: IChalkPair
}

export type ILevelStyleMap = Record<ReporterLevelEnum, ILevelStyle>

export const resolveLevel = (level: string): ReporterLevelEnum | undefined => {
  switch (level.toLowerCase()) {
    case 'debug':
      return ReporterLevelEnum.DEBUG
    case 'verb':
    case 'verbose':
      return ReporterLevelEnum.VERBOSE
    case 'info':
    case 'information':
      return ReporterLevelEnum.INFO
    case 'warn':
    case 'warning':
      return ReporterLevelEnum.WARN
    case 'error':
      return ReporterLevelEnum.ERROR
    case 'fatal':
      return ReporterLevelEnum.FATAL
    /* c8 ignore start */
    default:
      return undefined
    /* c8 ignore end */
  }
}
