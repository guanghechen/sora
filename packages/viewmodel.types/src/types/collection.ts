import type { IObservableValue } from './common'

export interface IImmutableCollection<K, V extends IObservableValue> {
  has(key: K): boolean
  get(key: K): V | undefined
  keys(): Iterable<K>
  values(): Iterable<V>
  entries(): Iterable<[K, V]>
  withMutations(mutator: (mutable: this) => void): this
}

export interface IImmutableMap<K, V extends IObservableValue> extends IImmutableCollection<K, V> {
  set(key: K, value: V): this // return a new IImutableCollection<K, V>
  delete(key: K): this // return a new IImutableCollection<K, V>
  deleteAll(keys: Iterable<K>): this // return a new IImutableCollection<K, V>
  merge(entries: Iterable<[K, V]>): this // return a new IImutableCollection<K, V>
}

export interface IImmutableSet<V extends IObservableValue> extends IImmutableCollection<V, V> {
  add(value: V): this // return a new IImutableCollection<V, V>
  delete(key: V): this // return a new IImutableCollection<K, V>
}
