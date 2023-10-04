import type { IBatchDisposable, IObservableValue, ISubscribable } from './common'

export type IComputableValue = IObservableValue

export interface IComputed<T extends IComputableValue> extends IBatchDisposable, ISubscribable<T> {
  getSnapshot: () => T
  getServerSnapshot?: () => T
  subscribeStateChange: (onStoreChange: () => void) => () => void
}
