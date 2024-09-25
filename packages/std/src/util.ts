/**
 * Return a promise resolved after the given `duration` milliseconds.
 *
 * @param duration
 * @returns
 */
export const delay = (duration: number): Promise<void> =>
  new Promise<void>(resolve => setTimeout(resolve, duration))

/**
 * Always return false
 *
 * @param _args
 * @returns
 */
export const falsy = (..._args: any[]): boolean => false

/**
 * Transparent transmission the given parameter.
 *
 * @param data
 * @returns
 */
export const identity = <T>(data: T): T => data

/**
 * Always return true.
 *
 * @param _args
 * @returns
 */
export const truthy = (..._args: any[]): boolean => true

/**
 * Do nothing.
 *
 * @param _args
 */
export const noop = (..._args: any[]): void => {}
