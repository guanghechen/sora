import type { IBatchDisposable } from '@guanghechen/disposable'
import type { ISubscribable } from '@guanghechen/subscriber'

export interface IComputed<T> extends IBatchDisposable, ISubscribable<T> {
  getSnapshot: () => T
  getServerSnapshot?: () => T
  subscribeStateChange: (onStoreChange: () => void) => () => void
}
