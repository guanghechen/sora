export enum ReporterLevelEnum {
  DEBUG = 1,
  VERBOSE = 2,
  INFO = 3,
  WARN = 4,
  ERROR = 5,
  FATAL = 6,
}

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

export const retrieveLevelName = (level: ReporterLevelEnum): string => {
  switch (level) {
    case ReporterLevelEnum.DEBUG:
      return 'debug'
    case ReporterLevelEnum.VERBOSE:
      return 'verbose'
    case ReporterLevelEnum.INFO:
      return 'info'
    case ReporterLevelEnum.WARN:
      return 'warn'
    case ReporterLevelEnum.ERROR:
      return 'error'
    case ReporterLevelEnum.FATAL:
      return 'fatal'
    /* c8 ignore start */
    default:
      return String(level)
    /* c8 ignore stop */
  }
}
