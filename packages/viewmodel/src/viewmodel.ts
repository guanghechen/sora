import { BatchDisposable } from './disposable'
import { Ticker } from './ticker'
import type { IObservableKey, IViewModel, IViewModelTicker } from './types'
import { isDisposable, isObservable } from './util'

export abstract class ViewModel extends BatchDisposable implements IViewModel {
  protected readonly _tickerMap: Map<string, IViewModelTicker>

  constructor() {
    super()
    this._tickerMap = new Map<string, IViewModelTicker>()
  }

  public override dispose(): void {
    if (!this.disposed) {
      super.dispose()
      Reflect.ownKeys(this).forEach(key => {
        if (typeof key === 'string' && key.endsWith('$')) {
          const disposable = this[key as keyof this]
          if (isDisposable(disposable)) disposable.dispose()
        }
      })
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
          console.warn(`[ViewModel.ticker] not an observable, key:`, obKey, 'val:', observable)
          continue
        }
        ticker.observe(observable)
      }
    }
    return item
  }
}
