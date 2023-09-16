import type { ReporterLevelEnum } from '@guanghechen/constant'

export interface IReporter {
  /**
   * Reporter name.
   */
  readonly name: string
  /**
   * Reporter level.
   */
  readonly level: ReporterLevelEnum
  /**
   * Print debug messages.
   * @param messageFormat
   * @param messages
   */
  debug(messageFormat: string, ...messages: any[]): void
  /**
   * Print verbose messages.
   * @param messageFormat
   * @param messages
   */
  verbose(messageFormat: string, ...messages: any[]): void
  /**
   * Print information messages.
   * @param messageFormat
   * @param messages
   */
  info(messageFormat: string, ...messages: any[]): void
  /**
   * Print warning messages.
   * @param messageFormat
   * @param messages
   */
  warn(messageFormat: string, ...messages: any[]): void
  /**
   * Print error messages.
   * @param messageFormat
   * @param messages
   */
  error(messageFormat: string, ...messages: any[]): void
  /**
   * Print critical error messages.
   * @param messageFormat
   * @param messages
   */
  fatal(messageFormat: string, ...messages: any[]): void
}
