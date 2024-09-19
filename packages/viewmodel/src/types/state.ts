import type { IComputed } from './computed'

export type IValuePatcher<T> = (prev: T) => T

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
  setState(patch: IValuePatcher<T>): void
  /**
   *
   * @param patch
   */
  updateState(patch: T | IValuePatcher<T>): void
}
