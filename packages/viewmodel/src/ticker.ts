import { Disposable } from './disposable'
import { Observable } from './observable'
import { Schedulable } from './schedulable'
import type {
  IAsyncCaller,
  IDisposable,
  IObservable,
  IObservableValue,
  IScheduleTransaction,
  ITicker,
  ITickerOptions,
  ITimer,
} from './types'

export class Ticker extends Observable<number> implements ITicker {
  protected readonly _observes: Set<IObservable<IObservableValue>>
  protected readonly _delay: number | -1
  protected readonly _threshold: number
  protected _caller: IAsyncCaller | undefined

  constructor(start?: number, options: ITickerOptions = {}) {
    const observes: Set<IObservable<IObservableValue>> = new Set<IObservable<IObservableValue>>()
    const delay: number = Number(options.delay || 0) || 0
    const threshold: number = Math.max(0, Number(options.threshold || 0) || 0)

    super(start ?? 0, { equals: (x: number, y: number): boolean => x === y })
    this._observes = observes
    this._delay = delay >= 0 ? delay : -1
    this._threshold = threshold
    this._caller = undefined
  }

  public override dispose(): void {
    if (!this.disposed) {
      super.dispose()

      this.flush()
      this._observes.clear()
    }
  }

  public tick(transaction?: IScheduleTransaction): void {
    this.next(this._value + 1, transaction)
  }

  public observe(observable: IObservable<IObservableValue>): void {
    if (this.disposed) {
      console.warn('[Ticker.observe] the ticker has been disposed.')
      return
    }

    if (!this._observes.has(observable)) {
      const unsubscribable = observable.subscribe({
        next: (): void => {
          if (!disposable.disposed) this.tick()
        },
        complete: (): void => disposable.dispose(),
      })
      const disposable: IDisposable = Disposable.fromUnsubscribable(unsubscribable)
      this._observes.add(observable)
      this.registerDisposable(disposable)
    }
  }

  protected override notify(
    value: number,
    prevValue: number,
    transaction: IScheduleTransaction | undefined,
  ): void {
    if (transaction) {
      this.flush()
      transaction.step(new Schedulable(() => this.notifyImmediate(value, prevValue)))
      return
    }

    if (this._delay < 0) {
      this.notifyImmediate(value, prevValue)
      return
    }

    const { _delay, _threshold, _caller } = this

    let createdAt = Date.now()
    const call = (): void => this.notifyImmediate(value, prevValue)
    const timer: ITimer = setTimeout(() => {
      this._caller = undefined
      call()
    }, _delay)

    if (_caller !== undefined) {
      this._caller = undefined
      clearTimeout(_caller.timer)

      if (_caller.createdAt + _threshold <= createdAt) _caller.call()
      else createdAt = _caller.createdAt
    }

    this._caller = { timer, createdAt, call }
  }

  protected flush(): void {
    const caller = this._caller
    if (caller !== undefined) {
      this._caller = undefined
      clearTimeout(caller.timer)
      caller.call()
    }
  }
}
