import { BatchDisposable } from './disposable'
import { Schedulable } from './schedulable'
import type {
  IDisposable,
  IEquals,
  IObservable,
  IObservableOptions,
  IObservableValue,
  IScheduleTransaction,
  ISubscriber,
  IUnsubscribable,
} from './types'
import { noopUnsubscribable } from './util'

export class Observable<T extends Readonly<IObservableValue>>
  extends BatchDisposable
  implements IObservable<T>
{
  public readonly equals: IEquals<T>
  protected _value: T
  protected _subscribers: ReadonlyArray<ISubscriber<T>>

  constructor(defaultValue: T, options: IObservableOptions<T> = {}) {
    super()
    this._value = defaultValue
    this._subscribers = []
    this.equals = options.equals ?? ((x: T, y: T) => Object.is(x, y))
  }

  public override dispose(): void {
    if (!this.disposed) {
      super.dispose()

      // Reset subscribers and avoid unexpected modification on iterator.
      const subscribers: ReadonlyArray<ISubscriber<T>> = this._subscribers
      this._subscribers = []
      for (const subscriber of subscribers) subscriber.complete()
    }
  }

  public getSnapshot(): T {
    return this._value
  }

  public subscribe(subscriber: ISubscriber<T>): IUnsubscribable {
    if (this.disposed) {
      subscriber.complete()
      return noopUnsubscribable
    }

    if (!this._subscribers.includes(subscriber)) {
      this._subscribers = [...this._subscribers, subscriber]
    }
    return {
      unsubscribe: () => {
        if (this._subscribers.includes(subscriber)) {
          this._subscribers = this._subscribers.filter(s => s !== subscriber)
        }
      },
    }
  }

  /**
   * 1. Update observable state.
   * 2. Notify all subscribers if the value is changed.
   */
  public next(value: T, transaction?: IScheduleTransaction): void {
    if (this.disposed) {
      console.warn(`[Observable] Don't update a disposed observable. value:`, value)
      return
    }

    const prevValue: T = this._value
    if (this.equals(value, prevValue)) return

    this._value = value
    this.notify(value, prevValue, transaction)
  }

  protected notify(value: T, prevValue: T, transaction: IScheduleTransaction | undefined): void {
    if (transaction) {
      transaction.step(new Schedulable(() => this.notifyImmediate(value, prevValue)))
      return
    }

    this.notifyImmediate(value, prevValue)
  }

  protected notifyImmediate(value: T, prevValue: T): void {
    const subscribers: ReadonlyArray<ISubscriber<T>> = this._subscribers
    for (const subscriber of subscribers) subscriber.next(value, prevValue)
  }
}

export class DisposedObservable<T extends Readonly<IObservableValue>> implements IObservable<T> {
  public readonly equals: IEquals<T>
  protected _value: T

  constructor(defaultValue: T, equals?: IEquals<T>) {
    this._value = defaultValue
    this.equals = equals ?? ((x: T, y: T) => Object.is(x, y))
  }

  public get disposed(): boolean {
    return true as boolean
  }

  public dispose(): void {}

  public registerDisposable<T extends IDisposable>(disposable: T): void {
    disposable.dispose()
  }

  public getSnapshot(): T {
    return this._value
  }

  public next(value: T, _transaction?: IScheduleTransaction): void {
    // Already disposed.
    console.warn(`[DisposedObservable] Don't update a disposed observable. value:`, value)
  }

  public subscribe(subscriber: ISubscriber<T>): IUnsubscribable {
    // Already disposed.
    subscriber.complete()
    return noopUnsubscribable
  }
}
