import { BatchDisposable, Disposable } from './disposable'
import { DisposedObservable, Observable } from './observable'
import { Schedulable } from './schedulable'
import type {
  IEquals,
  IImmutableCollection,
  IObservable,
  IObservableCollection,
  IObservableCollectionOptions,
  IObservableKeyChange,
  IObservableValue,
  IScheduleTransaction,
  ISubscriber,
  IUnsubscribable,
} from './types'
import { noopUnsubscribable } from './util'

export abstract class ObservableCollection<
    K,
    V extends IObservableValue,
    C extends IImmutableCollection<K, V>,
  >
  extends BatchDisposable
  implements IObservableCollection<K, V, C>
{
  public readonly equals: IEquals<C>
  public readonly valueEquals: IEquals<V | undefined>
  protected readonly _keySubscribersMap: Map<K, ReadonlyArray<ISubscriber<V | undefined>>>
  protected _subscribers: ReadonlyArray<ISubscriber<C>>
  protected _value: C

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
    if (!this.disposed) {
      super.dispose()

      // Reset subscribers and avoid unexpected modification on iterator.
      const subscribers: ReadonlyArray<ISubscriber<C>> = this._subscribers
      this._subscribers = []
      subscribers.forEach(subscriber => subscriber.complete())

      const keySubscribersMap = new Map(this._keySubscribersMap)
      this._keySubscribersMap.clear()
      for (const subscribers of keySubscribersMap.values()) {
        for (const subscriber of subscribers) subscriber.complete()
      }
      keySubscribersMap.clear()
    }
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

  public subscribe(subscriber: ISubscriber<C>): IUnsubscribable {
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

  public abstract next(value: C, transaction?: IScheduleTransaction): void

  public observeKey(key: K): IObservable<V | undefined> {
    const value: V | undefined = this._value.get(key)
    if (this.disposed) return new DisposedObservable<V | undefined>(value, this.valueEquals)

    const observable = new Observable<V | undefined>(value, { equals: this.valueEquals })
    const unsubscribable: IUnsubscribable = this.subscribeKey(key, {
      next: v => observable.next(v),
      complete: () => observable.dispose(),
    })
    observable.registerDisposable(Disposable.fromUnsubscribable(unsubscribable))
    this.registerDisposable(observable)
    return observable
  }

  public subscribeKey(key: K, subscriber: ISubscriber<V | undefined>): IUnsubscribable {
    if (this.disposed) {
      subscriber.complete()
      return noopUnsubscribable
    }

    const keySubscribers = this._keySubscribersMap.get(key)
    const nextKeySubscribers =
      keySubscribers === undefined
        ? [subscriber]
        : keySubscribers.includes(subscriber)
        ? keySubscribers
        : [...keySubscribers, subscriber]
    if (keySubscribers !== nextKeySubscribers) this._keySubscribersMap.set(key, nextKeySubscribers)
    return {
      unsubscribe: () => {
        const latestKeySubscribers = this._keySubscribersMap.get(key)
        if (latestKeySubscribers !== undefined && latestKeySubscribers.includes(subscriber)) {
          this._keySubscribersMap.set(
            key,
            latestKeySubscribers.filter(s => s !== subscriber),
          )
        }
      },
    }
  }

  protected notify(
    value: C,
    prevValue: C,
    changes: ReadonlyArray<IObservableKeyChange<K, V>>,
    transaction: IScheduleTransaction | undefined,
  ): void {
    if (transaction) {
      transaction.step(new Schedulable(() => this.notifyImmediate(value, prevValue, changes)))
    }

    this.notifyImmediate(value, prevValue, changes)
  }

  protected notifyImmediate(
    value: C,
    prevValue: C,
    changes: ReadonlyArray<IObservableKeyChange<K, V>>,
  ): void {
    // Notify key-subscribers.
    for (const change of changes) {
      const keySubscribers = this._keySubscribersMap.get(change.key)
      if (keySubscribers !== undefined) {
        for (const subscriber of keySubscribers) {
          subscriber.next(change.value, change.prevValue)
        }
      }
    }

    // Notify subscribers.
    const subscribers = this._subscribers
    for (const subscriber of subscribers) {
      subscriber.next(value, prevValue)
    }
  }
}
