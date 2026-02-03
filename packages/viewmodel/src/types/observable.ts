import type { IEquals, IObservable, IObservableNextOptions } from '@guanghechen/observable'
import type { ISubscriber, IUnsubscribable } from '@guanghechen/subscriber'
import type { IImmutableCollection, IImmutableMap, IImmutableSet } from './collection'

export interface IObservableCollectionOptions<V> {
  valueEquals?: IEquals<V | undefined>
}

export interface IObservableCollection<
  K,
  V,
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

export interface IObservableMap<K, V, C extends IImmutableMap<K, V>> extends IObservableCollection<
  K,
  V,
  C
> {
  set(key: K, value: V, options?: IObservableNextOptions): void
  delete(key: K, options?: IObservableNextOptions): void
  deleteAll(keys: Iterable<K>, options?: IObservableNextOptions): void
  merge(entries: Iterable<[K, V]>, options?: IObservableNextOptions): void
}

export interface IObservableSet<V, C extends IImmutableSet<V>> extends IObservableCollection<
  V,
  V,
  C
> {
  add(value: V, options?: IObservableNextOptions): void
  addAll(values: Iterable<V>, options?: IObservableNextOptions): void
  delete(value: V, options?: IObservableNextOptions): void
  deleteAll(values: Iterable<V>, options?: IObservableNextOptions): void
}
