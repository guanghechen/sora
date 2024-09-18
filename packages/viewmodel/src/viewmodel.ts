import { BatchDisposable, isDisposable } from '@guanghechen/disposable'
import type { IObservableKey } from '@guanghechen/observable'
import { Ticker, isObservable } from '@guanghechen/observable'
import type { IViewModel, IViewModelTicker } from './types/viewmodel'

export abstract class ViewModel extends BatchDisposable implements IViewModel {
  protected readonly _tickerMap: Map<string, IViewModelTicker>

  constructor() {
    super()
    this._tickerMap = new Map<string, IViewModelTicker>()
  }

  public override dispose(): void {
    if (!this.disposed) {
      super.dispose()
      for (const key of Reflect.ownKeys(this)) {
        if (typeof key === 'string' && key.endsWith('$')) {
          const disposable = this[key as keyof this]
          if (isDisposable(disposable)) disposable.dispose()
        }
      }
      for (const ticker of this._tickerMap.values()) ticker.ticker.dispose()
      this._tickerMap.clear()
    }
  }

  public ticker<K extends IObservableKey<this>>(observableKeys: K[]): Readonly<IViewModelTicker> {
    const keys: Array<IObservableKey<this>> = Array.from(new Set(observableKeys)).sort()
    const key: string = keys.join('|')

    let item: IViewModelTicker | undefined = this._tickerMap.get(key)
    if (item === undefined) {
      const ticker = new Ticker()
      item = { keys: keys as string[], ticker }

      this.registerDisposable(ticker)
      this._tickerMap.set(key, item)

      for (const obKey of keys) {
        const observable = this[obKey]
        if (!isObservable(observable)) {
          console.warn('[ViewModel.ticker] not an observable, key:', obKey, 'val:', observable)
          continue
        }
        ticker.observe(observable)
      }
    }
    return item
  }
}
