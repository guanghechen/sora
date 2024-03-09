import type { IComputed } from './computed'

export interface IState<T> extends IComputed<T> {
  /**
   *
   * @param nextValue
   */
  next(nextValue: T): void
  /**
   *
   * @param patch
   */
  setState(patch: (prev: T) => T): void
}
