import type { IDisposable } from '@guanghechen/disposable'
import { Disposable } from '@guanghechen/disposable'
import type { ISubscriber } from '@guanghechen/subscriber'
import { Subscriber } from '@guanghechen/subscriber'
import { Observable } from './observable'
import type { IBaseObservable, IEquals, IObservableNextOptions } from './types/observable'
import type { ITicker, ITickerObserveOptions, ITickerOptions, IUnobservable } from './types/ticker'
import { noopUnobservable } from './util'

const equals: IEquals<number> = (x, y) => x === y

export class Ticker extends Observable<number> implements ITicker {
  constructor(options: ITickerOptions = {}) {
    const { start = 0, delay } = options
    super(start, { delay, equals })
  }

  public tick(options?: IObservableNextOptions): void {
    this.next(this._value + 1, options)
  }

  public observe<T>(
    observable: IBaseObservable<T>,
    options?: ITickerObserveOptions,
  ): IUnobservable {
    if (this.disposed) {
      const strict: boolean = options?.strict ?? true
      if (strict) throw new RangeError('[Ticker.observe] the ticker has been disposed.')
      return noopUnobservable
    }

    if (observable.disposed) return noopUnobservable

    const subscriber: ISubscriber<T> = new Subscriber<T>({ onNext: (): void => this.tick() })
    const unsubscribable = observable.subscribe(subscriber)
    const disposable: IDisposable = new Disposable(() => {
      subscriber.dispose()
      unsubscribable.unsubscribe()
    })
    this.registerDisposable(disposable)
    return { unobserve: () => disposable.dispose() }
  }
}
