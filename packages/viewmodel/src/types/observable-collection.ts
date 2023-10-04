import type { SchedulableTransaction } from '../schedulable'
import type { IImmutableCollection, IImmutableMap, IImmutableSet } from './collection'
import type { IEquals, IObservableValue, ISubscriber, IUnsubscribable } from './common'
import type { IObservable } from './observable'

export interface IObservableCollectionOptions<V extends IObservableValue> {
  valueEquals?: IEquals<V | undefined>
}

export interface IObservableKeyChange<K, V extends IObservableValue> {
  key: K
  value: V | undefined
  prevValue: V | undefined
}

export interface IObservableCollection<
  K,
  V extends IObservableValue,
  C extends IImmutableCollection<K, V>,
> extends IObservable<C> {
  has(key: K): boolean
  get(key: K): V | undefined
  keys(): Iterable<K>
  values(): Iterable<V>
  entries(): Iterable<[K, V]>
  observeKey(key: K): IObservable<V | undefined>
  subscribeKey(key: K, subscriber: ISubscriber<V | undefined>): IUnsubscribable
}

export interface IObservableMap<K, V extends IObservableValue, C extends IImmutableMap<K, V>>
  extends IObservableCollection<K, V, C> {
  set(key: K, value: V, transaction?: SchedulableTransaction): void
  delete(key: K, transaction?: SchedulableTransaction): void
  deleteAll(keys: Iterable<K>, transaction?: SchedulableTransaction): void
  merge(entries: Iterable<[K, V]>, transaction?: SchedulableTransaction): void
}

export interface IObservableSet<V extends IObservableValue, C extends IImmutableSet<V>>
  extends IObservableCollection<V, V, C> {
  add(value: V, transaction?: SchedulableTransaction): void
  addAll(values: Iterable<V>, transaction?: SchedulableTransaction): void
  delete(value: V, transaction?: SchedulableTransaction): void
  deleteAll(values: Iterable<V>, transaction?: SchedulableTransaction): void
}
