import { BatchDisposable, SafeBatchHandler } from '@guanghechen/disposable'
import type {
  IEquals,
  IObservable,
  IObservableNextOptions,
  IObservableOptions,
  ISubscriber,
  IUnsubscribable,
} from '@guanghechen/observable.types'
import { noopUnsubscribable } from './util'

interface IObservableSubscriber<T> {
  readonly subscriber: ISubscriber<T>
  inactive: boolean
}

const defaultEquals = <T>(x: T, y: T): boolean => Object.is(x, y)

export class Observable<T> extends BatchDisposable implements IObservable<T> {
  public readonly equals: IEquals<T>
  protected readonly _delay: number
  protected readonly _subscribers: Array<IObservableSubscriber<T>>
  protected _value: T
  protected _updateTick: number
  protected _notifyTick: number
  protected _lastNotifiedValue: T | undefined
  protected _timer: ReturnType<typeof setTimeout> | undefined

  constructor(defaultValue: T, options: IObservableOptions<T> = {}) {
    super()

    const { equals = defaultEquals } = options
    this._delay = Math.max(0, Number(options.delay) || 0)
    this._subscribers = []
    this._value = defaultValue
    this._updateTick = 0
    this._notifyTick = 0
    this._lastNotifiedValue = undefined
    this._timer = undefined
    this.equals = equals
  }

  public override dispose(): void {
    if (this.disposed) return
    super.dispose()

    // Notify subscribers if has changes not notified.
    this._flush()

    // Dispose subscribers.
    const batcher = new SafeBatchHandler()
    const size: number = this._subscribers.length
    for (let i = 0; i < size; ++i) {
      const item: IObservableSubscriber<T> = this._subscribers[i]
      if (item.inactive || item.subscriber.disposed) continue
      batcher.run(() => item.subscriber.dispose())
    }
    for (const item of this._subscribers) item.inactive = true
    this._subscribers.length = 0
    batcher.summary('[observable] Encountered errors while disposing.')
    batcher.cleanup()
  }

  public getSnapshot(): T {
    return this._value
  }

  public next(value: T, options?: IObservableNextOptions): void {
    if (this.disposed) {
      const strict: boolean = options?.strict ?? true
      if (strict) {
        throw new RangeError(`Don't update a disposed observable. value: ${String(value)}.`)
      }
      return
    }

    const force: boolean = options?.force ?? false
    if (!force && this.equals(value, this._value)) return

    this._value = value
    this._updateTick += 1
    this._notify()
  }

  public subscribe(subscriber: ISubscriber<T>): IUnsubscribable {
    if (subscriber.disposed) return noopUnsubscribable

    const prevValue: T | undefined = this._lastNotifiedValue
    const value: T = this._value

    if (this.disposed) {
      subscriber.next(value, prevValue)
      subscriber.dispose()
      return noopUnsubscribable
    }


    this._flush()

    const item: IObservableSubscriber<T> = { subscriber, inactive: false }
    this._subscribers.push(item)
    subscriber.next(value, prevValue)

    return {
      unsubscribe: (): void => {
        item.inactive = true
      },
    }
  }

  protected _flush(): void {
    if (this._notifyTick < this._updateTick) {
      if (this._timer !== undefined) {
        clearTimeout(this._timer)
        this._timer = undefined
      }
      this._notifyImmediate()
    }
  }

  protected _notify(): void {
    if (this._notifyTick < this._updateTick) {
      if (this._delay <= 0) {
        this._notifyImmediate()
        return
      }

      if (this._timer === undefined) {
        this._timer = setTimeout(() => {
          try {
            this._notifyImmediate()
          } finally {
            this._timer = undefined
          }

          // Recursive to handle candidate changes.
          this._notify()
        }, this._delay)
      }
    }
  }

  protected _notifyImmediate(): void {
    const prevValue: T | undefined = this._lastNotifiedValue
    const value: T = this._value

    this._lastNotifiedValue = value
    this._notifyTick = this._updateTick

    const batcher = new SafeBatchHandler()
    const subscribers = this._subscribers
    const size: number = subscribers.length
    for (let i = 0; i < size; ++i) {
      const subscriber: IObservableSubscriber<T> = subscribers[i]
      if (subscriber.inactive || subscriber.subscriber.disposed) continue
      batcher.run(() => subscriber.subscriber.next(value, prevValue))
    }
    batcher.summary('[observable] Encountered errors while notifying subscribers.')
    batcher.cleanup()
  }
}
