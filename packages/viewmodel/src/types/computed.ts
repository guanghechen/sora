import type { IBaseObservable } from '@guanghechen/observable'

export interface IComputed<T> extends IBaseObservable<T> {
  getServerSnapshot?: () => T
  subscribeStateChange: (onStoreChange: () => void) => () => void
}
