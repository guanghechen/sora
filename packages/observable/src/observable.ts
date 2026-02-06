import { BatchDisposable } from '@guanghechen/disposable'
import type { ISubscriber, ISubscribers, IUnsubscribable } from '@guanghechen/subscriber'
import { Subscribers } from '@guanghechen/subscriber'
import type {
  IEquals,
  IObservable,
  IObservableNextOptions,
  IObservableOptions,
} from './types/observable'
import { noopUnsubscribable } from './util'

const defaultEquals = <T>(x: T, y: T): boolean => Object.is(x, y)

export class Observable<T> extends BatchDisposable implements IObservable<T> {
  public readonly equals: IEquals<T>
  protected readonly _delay: number
  protected readonly _subscribers: ISubscribers<T>
  protected readonly _onError: (error: unknown) => void
  protected _value: T
  protected _updateTick: number
  protected _notifyTick: number
  protected _lastNotifiedValue: T | undefined
  protected _timer: ReturnType<typeof setTimeout> | undefined

  constructor(defaultValue: T, options: IObservableOptions<T> = {}) {
    super()

    const { equals = defaultEquals, onError } = options
    this._delay = Math.max(0, Number(options.delay) || 0)
    this._subscribers = new Subscribers()
    this._value = defaultValue
    this._updateTick = 0
    this._notifyTick = 0
    this._lastNotifiedValue = undefined
    this._timer = undefined
    this.equals = equals
    this._onError =
      onError ??
      (error => {
        console.error('Error in observable notification:', error)
      })
  }

  public override dispose(): void {
    if (this.disposed) return

    // Clear any pending timer before marking as disposed
    if (this._timer !== undefined) {
      clearTimeout(this._timer)
      this._timer = undefined
    }

    super.dispose()

    // Notify subscribers if has changes not notified.
    this._flush()

    // Dispose subscribers.
    this._subscribers.dispose()
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
    subscriber.next(value, prevValue)
    return this._subscribers.subscribe(subscriber)
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
            // Check if disposed before proceeding
            if (!this.disposed) {
              this._notifyImmediate()
            }
          } catch (error) {
            this._onError(error)
          } finally {
            this._timer = undefined
          }

          // Recursive to handle candidate changes, but only if not disposed
          if (!this.disposed) {
            this._notify()
          }
        }, this._delay)
      }
    }
  }

  protected _notifyImmediate(): void {
    const prevValue: T | undefined = this._lastNotifiedValue
    const value: T = this._value
    this._lastNotifiedValue = value
    this._notifyTick = this._updateTick
    this._subscribers.notify(value, prevValue)
  }
}
