import type { ISubscriber } from '@guanghechen/subscriber'
import type { IImmutableMap } from '../src'

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class TestSubscriber<T> implements ISubscriber<T> {
  public readonly displayName: string
  protected _value: T
  protected _disposed: boolean

  constructor(name: string, initialValue: T) {
    this.displayName = name
    this._value = initialValue
    this._disposed = false
  }

  public get disposed(): boolean {
    return this._disposed
  }

  public get value(): T {
    return this._value
  }

  public next(nextValue: T): void {
    this._value = nextValue
  }

  public dispose(): void {
    if (this._disposed) return
    this._disposed = true
    console.log(`[in test] called ${this.displayName}.complete`)
  }
}

export class ImmutableMap<K, V> implements IImmutableMap<K, V> {
  protected _map: Map<K, V>

  constructor(map: Map<K, V> = new Map()) {
    this._map = map
  }

  public has(key: K): boolean {
    return this._map.has(key)
  }

  public get(key: K): V | undefined {
    return this._map.get(key)
  }

  public keys(): Iterable<K> {
    return this._map.keys()
  }

  public values(): Iterable<V> {
    return this._map.values()
  }

  public entries(): Iterable<[K, V]> {
    return this._map.entries()
  }

  public set(key: K, value: V): this {
    const nextMap = new Map(this._map)
    nextMap.set(key, value)
    return new ImmutableMap<K, V>(nextMap) as this
  }

  public delete(key: K): this {
    const nextMap = new Map(this._map)
    nextMap.delete(key)
    return new ImmutableMap<K, V>(nextMap) as this
  }

  public deleteAll(keys: Iterable<K>): this {
    const nextMap = new Map(this._map)
    for (const key of keys) nextMap.delete(key)
    return new ImmutableMap<K, V>(nextMap) as this
  }

  public merge(entries: Iterable<[K, V]>): this {
    const nextMap = new Map(this._map)
    for (const [key, value] of entries) nextMap.set(key, value)
    return new ImmutableMap<K, V>(nextMap) as this
  }

  public withMutations(mutator: (mutable: this) => void): this {
    const mutable = new MutableMap(this._map)
    mutator(mutable as unknown as this)
    return new ImmutableMap(mutable.map) as this
  }
}

class MutableMap<K, V> implements IImmutableMap<K, V> {
  protected _map: Map<K, V>

  constructor(map: Map<K, V> = new Map()) {
    this._map = new Map(map)
  }

  public get map(): Map<K, V> {
    return new Map(this._map)
  }

  public has(key: K): boolean {
    return this._map.has(key)
  }

  public get(key: K): V | undefined {
    return this._map.get(key)
  }

  public keys(): Iterable<K> {
    return this._map.keys()
  }

  public values(): Iterable<V> {
    return this._map.values()
  }

  public entries(): Iterable<[K, V]> {
    return this._map.entries()
  }

  public set(key: K, value: V): this {
    this._map.set(key, value)
    return this
  }

  public delete(key: K): this {
    this._map.delete(key)
    return this
  }

  public deleteAll(keys: Iterable<K>): this {
    for (const key of keys) this._map.delete(key)
    return this
  }

  public merge(entries: Iterable<[K, V]>): this {
    for (const [key, value] of entries) this._map.set(key, value)
    return this
  }

  public withMutations(mutator: (mutable: this) => void): this {
    mutator(this)
    return this
  }
}
