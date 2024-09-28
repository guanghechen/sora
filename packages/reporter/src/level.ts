import type { IChalkBuilder } from '@guanghechen/chalk.types'
import type { ReporterLevelEnum } from '@guanghechen/reporter.types'

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
