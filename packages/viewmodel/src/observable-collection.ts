import type { IDisposable } from '@guanghechen/disposable'
import { BatchDisposable, Disposable, SafeBatchHandler } from '@guanghechen/disposable'
import { Observable } from '@guanghechen/observable'
import type { IEquals, IObservable, IObservableNextOptions } from '@guanghechen/observable'
import { type ISubscriber, type IUnsubscribable, Subscriber } from '@guanghechen/subscriber'
import { DisposedObservable } from './observable-disposed'
import type { IImmutableCollection } from './types/collection'
import type { IObservableCollection, IObservableCollectionOptions } from './types/observable'

interface IObservableSubscriber<T> {
  readonly subscriber: ISubscriber<T>
  inactive: boolean
}

const noop = (..._args: any[]): void => {}
const noopUnsubscribable: IUnsubscribable = { unsubscribe: noop }

export class ObservableCollection<K, V, C extends IImmutableCollection<K, V>>
  extends BatchDisposable
  implements IObservableCollection<K, V, C>
{
  public readonly equals: IEquals<C>
  public readonly valueEquals: IEquals<V | undefined>
  protected readonly _subscribers: Array<IObservableSubscriber<C>>
  protected readonly _keySubscribersMap: Map<K, Array<IObservableSubscriber<V | undefined>>>
  protected _value: C
  protected _lastNotifiedValue: C | undefined

  constructor(defaultValue: C, options: IObservableCollectionOptions<V> = {}) {
    super()
    this._value = defaultValue
    this._subscribers = []
    this._keySubscribersMap = new Map()
    this.valueEquals =
      options.valueEquals ?? ((x: V | undefined, y: V | undefined) => Object.is(x, y))
    this.equals = (x: C, y: C) => Object.is(x, y)
  }

  public override dispose(): void {
    if (this.disposed) return
    super.dispose()

    // Dispose subscribers.
    const batcher = new SafeBatchHandler()
    {
      const subscribers = this._subscribers
      const size: number = subscribers.length
      for (let i = 0; i < size; ++i) {
        const item: IObservableSubscriber<C> = subscribers[i]
        if (item.inactive || item.subscriber.disposed) continue
        batcher.run(() => item.subscriber.dispose())
      }
      this._subscribers.length = 0
    }
    {
      for (const subscribers of this._keySubscribersMap.values()) {
        const size: number = subscribers.length
        for (let i = 0; i < size; ++i) {
          const item: IObservableSubscriber<V> = subscribers[i]
          if (item.inactive || item.subscriber.disposed) continue
          batcher.run(() => item.subscriber.dispose())
        }
      }
      this._keySubscribersMap.clear()
    }
    batcher.summary('[observable-collection] Encountered errors while disposing.')
    batcher.cleanup()
  }

  public has(key: K): boolean {
    return this._value.has(key)
  }

  public get(key: K): V | undefined {
    return this._value.get(key)
  }

  public keys(): Iterable<K> {
    return this._value.keys()
  }

  public values(): Iterable<V> {
    return this._value.values()
  }

  public entries(): Iterable<[K, V]> {
    return this._value.entries()
  }

  public getSnapshot(): C {
    return this._value
  }

  public next(value: C, options?: IObservableNextOptions): void {
    if (this.disposed) {
      const strict: boolean = options?.strict ?? true
      if (strict) {
        throw new RangeError(`Don't update a disposed observable. value: ${String(value)}.`)
      }
    }

    const force: boolean = options?.force ?? false
    const prevValue: C = this._value
    if (!force && this.equals(value, prevValue)) return

    this._value = value
    this._notify()
  }

  public subscribe(subscriber: ISubscriber<C>): IUnsubscribable {
    if (subscriber.disposed) return noopUnsubscribable

    if (this.disposed) {
      subscriber.dispose()
      return noopUnsubscribable
    }

    const prevValue: C | undefined = this._lastNotifiedValue
    const value: C = this._value
    const item: IObservableSubscriber<C> = { subscriber, inactive: false }
    this._subscribers.push(item)
    subscriber.next(value, prevValue)

    return {
      unsubscribe: (): void => {
        item.inactive = true
      },
    }
  }

  public observeKey(key: K): IObservable<V | undefined> {
    const value: V | undefined = this._value.get(key)
    if (this.disposed) {
      return new DisposedObservable<V | undefined>(value, { equals: this.valueEquals })
    }

    const observable = new Observable<V | undefined>(value, { equals: this.valueEquals })
    const subscriber: ISubscriber<V | undefined> = new Subscriber<V | undefined>({
      onNext: v => observable.next(v),
    })
    const unsubscribable: IUnsubscribable = this.subscribeKey(key, subscriber)
    const disposable: IDisposable = new Disposable(() => {
      observable.dispose()
      subscriber.dispose()
      unsubscribable.unsubscribe()
    })
    this.registerDisposable(disposable)
    observable.registerDisposable(disposable)
    return observable
  }

  public subscribeKey(key: K, subscriber: ISubscriber<V | undefined>): IUnsubscribable {
    if (subscriber.disposed) return noopUnsubscribable

    if (this.disposed) {
      subscriber.dispose()
      return noopUnsubscribable
    }

    const prevValue: V | undefined =
      this._lastNotifiedValue === undefined ? undefined : this._lastNotifiedValue.get(key)
    const value: V | undefined = this._value.get(key)
    const item: IObservableSubscriber<V | undefined> = { subscriber, inactive: false }
    const keySubscribers = this._keySubscribersMap.get(key)

    if (keySubscribers === undefined) this._keySubscribersMap.set(key, [item])
    else keySubscribers.push(item)

    subscriber.next(value, prevValue)

    return {
      unsubscribe: () => {
        item.inactive = true
      },
    }
  }

  protected _notify(): void {
    const value: C = this._value
    const prevValue: C | undefined = this._lastNotifiedValue
    this._lastNotifiedValue = value
    const batcher = new SafeBatchHandler()

    // Notify key-subscribers.
    {
      for (const [key, subscribers] of this._keySubscribersMap) {
        const val: V | undefined = value.get(key)
        const prevVal: V | undefined = prevValue === undefined ? undefined : prevValue.get(key)
        const size: number = subscribers.length
        for (let i = 0; i < size; ++i) {
          const subscriber: IObservableSubscriber<V | undefined> = subscribers[i]
          if (subscriber.inactive || subscriber.subscriber.disposed) continue
          if (this.valueEquals(val, prevVal)) continue
          batcher.run(() => subscriber.subscriber.next(val, prevVal))
        }
      }
    }

    // Notify subscribers.
    {
      const subscribers = this._subscribers
      const size: number = subscribers.length
      for (let i = 0; i < size; ++i) {
        const subscriber: IObservableSubscriber<C | undefined> = subscribers[i]
        if (subscriber.inactive || subscriber.subscriber.disposed) continue
        batcher.run(() => subscriber.subscriber.next(value, prevValue))
      }
    }

    batcher.summary('[observable-collection] Encountered errors while notifying subscribers.')
    batcher.cleanup()
  }
}
