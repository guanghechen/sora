export enum ReporterLevelEnum {
  DEBUG = 'debug',
  VERBOSE = 'verbose',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export const LevelOrdinalMap: Record<ReporterLevelEnum, number> = Object.freeze({
  [ReporterLevelEnum.DEBUG]: 1,
  [ReporterLevelEnum.VERBOSE]: 2,
  [ReporterLevelEnum.INFO]: 3,
  [ReporterLevelEnum.WARN]: 4,
  [ReporterLevelEnum.ERROR]: 5,
  [ReporterLevelEnum.FATAL]: 6,
})
