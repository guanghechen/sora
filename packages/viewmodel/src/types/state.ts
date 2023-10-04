import type { IObservableValue } from './common'
import type { IComputed } from './computed'

export type IStatableValue = IObservableValue

export interface IState<T extends IStatableValue> extends IComputed<T> {
  setState(patch: T | ((prev: T) => T)): void
}
