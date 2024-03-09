import type {
  IEquals,
  IObservable,
  IObservableNextOptions,
  ISubscriber,
  ITicker,
  ITickerObserveOptions,
  ITickerOptions,
  IUnobservable,
} from '@guanghechen/observable.types'
import { Observable } from './observable'
import { Subscriber } from './subscriber'
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

  public observe<T>(observable: IObservable<T>, options?: ITickerObserveOptions): IUnobservable {
    if (this.disposed) {
      const strict: boolean = options?.strict ?? true
      if (strict) throw new RangeError('[Ticker.observe] the ticker has been disposed.')
      return noopUnobservable
    }

    if (observable.disposed) return noopUnobservable

    const subscriber: ISubscriber<T> = new Subscriber<T>({
      onNext: (): void => this.tick(),
      onDispose: () => unsubscribable.unsubscribe(),
    })
    const unsubscribable = observable.subscribe(subscriber)
    this.registerDisposable(subscriber)
    return { unobserve: () => unsubscribable.unsubscribe() }
  }
}
