import type { IBatchDisposable, IDisposable } from '@guanghechen/disposable'
import type { IObservableKey } from '@guanghechen/observable'
import type { ISubscribable } from '@guanghechen/subscriber'

export interface IViewModelTicker {
  readonly keys: ReadonlyArray<string>
  readonly ticker: ISubscribable<number> & IDisposable
}

export interface IViewModel extends IBatchDisposable {
  /**
   * Create a tick observable to watch changes in keys of this.
   * @param keys
   */
  ticker<K extends IObservableKey<this>>(keys: K[] | undefined): Readonly<IViewModelTicker>
}
