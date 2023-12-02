import type { IBatchDisposable } from '@guanghechen/disposable.types'
import type { ISubscribable } from '@guanghechen/subscribe.types'
import type { IObservableValue } from './common'

export type IComputableValue = IObservableValue

export interface IComputed<T extends IComputableValue> extends IBatchDisposable, ISubscribable<T> {
  getSnapshot: () => T
  getServerSnapshot?: () => T
  subscribeStateChange: (onStoreChange: () => void) => () => void
}
