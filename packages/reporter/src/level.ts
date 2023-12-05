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

export const resolveLevel = (level_: string | ReporterLevelEnum): ReporterLevelEnum | undefined => {
  const level = typeof level_ === 'string' ? level_.toLowerCase() : level_
  switch (level) {
    case 'debug':
    case ReporterLevelEnum.DEBUG:
      return ReporterLevelEnum.DEBUG
    case 'verb':
    case 'verbose':
    case ReporterLevelEnum.VERBOSE:
      return ReporterLevelEnum.VERBOSE
    case 'info':
    case 'information':
    case ReporterLevelEnum.INFO:
      return ReporterLevelEnum.INFO
    case 'warn':
    case 'warning':
    case ReporterLevelEnum.WARN:
      return ReporterLevelEnum.WARN
    case 'error':
    case ReporterLevelEnum.ERROR:
      return ReporterLevelEnum.ERROR
    case 'fatal':
    case ReporterLevelEnum.FATAL:
      return ReporterLevelEnum.FATAL
    /* c8 ignore start */
    default:
      return undefined
    /* c8 ignore stop */
  }
}
