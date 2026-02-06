/**
 * Log level for reporter.
 */
export type IReporterLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * A minimal logger interface with level-based logging methods.
 */
export interface IReporter {
  /**
   * Log a message with the specified level.
   * @param level - The log level
   * @param args - Arguments to log
   */
  log(level: IReporterLevel, ...args: unknown[]): void

  /**
   * Log a debug message.
   * @param args - Arguments to log
   */
  debug(...args: unknown[]): void

  /**
   * Log an info message.
   * @param args - Arguments to log
   */
  info(...args: unknown[]): void

  /**
   * Log a warning message.
   * @param args - Arguments to log
   */
  warn(...args: unknown[]): void

  /**
   * Log an error message.
   * @param args - Arguments to log
   */
  error(...args: unknown[]): void
}
