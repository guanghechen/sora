import { ReporterLevelEnum } from '@guanghechen/constant'
import chalk from 'chalk'
import type { ChalkInstance } from 'chalk'

export interface ColorfulChalk {
  readonly fg: ChalkInstance
  readonly bg?: ChalkInstance | undefined
}

export interface ILevelStyle {
  title: string
  labelChalk: ColorfulChalk
  contentChalk: ColorfulChalk
}

export type ILevelStyleMap = Record<ReporterLevelEnum, ILevelStyle>

export const defaultLevelStyleMap: ILevelStyleMap = Object.freeze({
  [ReporterLevelEnum.DEBUG]: {
    title: 'debug',
    labelChalk: { fg: chalk.grey },
    contentChalk: { fg: chalk.grey },
  },
  [ReporterLevelEnum.VERBOSE]: {
    title: 'verb ',
    labelChalk: { fg: chalk.cyan },
    contentChalk: { fg: chalk.cyan },
  },
  [ReporterLevelEnum.INFO]: {
    title: 'info ',
    labelChalk: { fg: chalk.green },
    contentChalk: { fg: chalk.green },
  },
  [ReporterLevelEnum.WARN]: {
    title: 'warn ',
    labelChalk: { fg: chalk.yellow },
    contentChalk: { fg: chalk.yellow },
  },
  [ReporterLevelEnum.ERROR]: {
    title: 'error',
    labelChalk: { fg: chalk.red },
    contentChalk: { fg: chalk.red },
  },
  [ReporterLevelEnum.FATAL]: {
    title: 'fatal',
    labelChalk: { fg: chalk.black, bg: chalk.bgRed },
    contentChalk: { fg: chalk.redBright },
  },
})

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
