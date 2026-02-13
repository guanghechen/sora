/**
 * Log level utilities
 */

import type { IReporterLevel } from '@guanghechen/types'

/** Log level enum with numeric values */
export enum LogLevelEnum {
  debug = 1,
  info = 2,
  hint = 3,
  warn = 4,
  error = 5,
}

/** All valid log levels in order */
export const LOG_LEVELS: ReadonlyArray<IReporterLevel> = ['debug', 'info', 'hint', 'warn', 'error']

/** Log level numeric values */
export const LOG_LEVEL_VALUES: Readonly<Record<IReporterLevel, number>> = {
  debug: LogLevelEnum.debug,
  info: LogLevelEnum.info,
  hint: LogLevelEnum.hint,
  warn: LogLevelEnum.warn,
  error: LogLevelEnum.error,
}

/**
 * Check if a string is a valid log level
 */
export function isLogLevel(value: string): value is IReporterLevel {
  return Object.hasOwn(LOG_LEVEL_VALUES, value)
}

/**
 * Get numeric value for a log level
 */
export function getLogLevelValue(level: IReporterLevel): number {
  return LOG_LEVEL_VALUES[level]
}

/**
 * Resolve a string to a valid log level (case-insensitive).
 * Returns undefined if the string is not a valid log level.
 */
export function resolveLogLevel(value: string): IReporterLevel | undefined {
  const lower = value.toLowerCase()
  return isLogLevel(lower) ? lower : undefined
}
