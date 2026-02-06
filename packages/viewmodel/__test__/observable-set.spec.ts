import type { IConsoleMock } from 'vitest.helper'
import { createConsoleMock } from 'vitest.helper'
import type { IImmutableSet, IObservableSet } from '../src'
import { ObservableSet } from '../src'
import { TestSubscriber } from './_common'

class ImmutableSet<V> implements IImmutableSet<V> {
  protected _set: Set<V>

  constructor(set = new Set<V>()) {
    this._set = set
  }

  public has(key: V): boolean {
    return this._set.has(key)
  }

  public get(key: V): V | undefined {
    return this._set.has(key) ? key : undefined
  }

  public keys(): Iterable<V> {
    return this._set.keys()
  }

  public values(): Iterable<V> {
    return this._set.values()
  }

  public entries(): Iterable<[V, V]> {
    return Array.from(this._set).map(v => [v, v] as [V, V])
  }

  public add(value: V): this {
    const nextSet = new Set(this._set)
    nextSet.add(value)
    return new ImmutableSet<V>(nextSet) as this
  }

  public delete(value: V): this {
    const nextSet = new Set(this._set)
    nextSet.delete(value)
    return new ImmutableSet<V>(nextSet) as this
  }

  public withMutations(mutator: (mutable: this) => void): this {
    const mutable = new MutableSet(this._set)
    mutator(mutable as unknown as this)
    return new ImmutableSet(mutable.set) as this
  }
}

class MutableSet<V> implements IImmutableSet<V> {
  protected _set: Set<V>

  constructor(set = new Set<V>()) {
    this._set = new Set(set)
  }

  public get set(): Set<V> {
    return new Set(this._set)
  }

  public has(key: V): boolean {
    return this._set.has(key)
  }

  public get(key: V): V | undefined {
    return this._set.has(key) ? key : undefined
  }

  public keys(): Iterable<V> {
    return this._set.keys()
  }

  public values(): Iterable<V> {
    return this._set.values()
  }

  public entries(): Iterable<[V, V]> {
    return Array.from(this._set).map(v => [v, v] as [V, V])
  }

  public add(value: V): this {
    this._set.add(value)
    return this
  }

  public delete(value: V): this {
    this._set.delete(value)
    return this
  }

  public withMutations(mutator: (mutable: this) => void): this {
    mutator(this)
    return this
  }
}

describe('ObservableSet', () => {
  let observableSet: IObservableSet<string, IImmutableSet<string>>
  let consoleMock: IConsoleMock

  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
    observableSet = new ObservableSet<string, IImmutableSet<string>>(new ImmutableSet<string>())
  })

  afterEach(() => {
    observableSet.dispose()
    consoleMock.restore()
  })

  describe('add', () => {
    it('should add a single value', () => {
      observableSet.add('a')
      expect(observableSet.has('a')).toBe(true)
      expect(observableSet.get('a')).toBe('a')
    })

    it('should add multiple values one by one', () => {
      observableSet.add('a')
      observableSet.add('b')
      observableSet.add('c')

      expect(observableSet.has('a')).toBe(true)
      expect(observableSet.has('b')).toBe(true)
      expect(observableSet.has('c')).toBe(true)
    })

    it('should notify subscribers on add', () => {
      const subscriber = new TestSubscriber<IImmutableSet<string>>('set', new ImmutableSet())
      observableSet.subscribe(subscriber)

      observableSet.add('x')
      expect(subscriber.value.has('x')).toBe(true)
    })

    it('should support options parameter', () => {
      observableSet.add('a', { strict: false })
      expect(observableSet.has('a')).toBe(true)
    })
  })

  describe('addAll', () => {
    it('should add multiple values at once', () => {
      observableSet.addAll(['a', 'b', 'c'])

      expect(observableSet.has('a')).toBe(true)
      expect(observableSet.has('b')).toBe(true)
      expect(observableSet.has('c')).toBe(true)
    })

    it('should notify subscribers once for batch add', () => {
      const callback = vi.fn()
      const subscriber = new TestSubscriber<IImmutableSet<string>>('set', new ImmutableSet())
      subscriber.next = callback

      observableSet.subscribe(subscriber)
      callback.mockClear()

      observableSet.addAll(['a', 'b', 'c'])
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should handle empty iterable', () => {
      const snapshot = observableSet.getSnapshot()
      observableSet.addAll([])
      expect(observableSet.getSnapshot()).not.toBe(snapshot)
    })

    it('should support options parameter', () => {
      observableSet.addAll(['a', 'b'], { strict: false })
      expect(observableSet.has('a')).toBe(true)
      expect(observableSet.has('b')).toBe(true)
    })
  })

  describe('delete', () => {
    it('should delete a value', () => {
      observableSet.add('a')
      expect(observableSet.has('a')).toBe(true)

      observableSet.delete('a')
      expect(observableSet.has('a')).toBe(false)
    })

    it('should handle deleting non-existent value', () => {
      expect(() => observableSet.delete('nonexistent')).not.toThrow()
    })

    it('should notify subscribers on delete', () => {
      observableSet.add('a')

      const subscriber = new TestSubscriber<IImmutableSet<string>>('set', new ImmutableSet())
      observableSet.subscribe(subscriber)

      observableSet.delete('a')
      expect(subscriber.value.has('a')).toBe(false)
    })

    it('should support options parameter', () => {
      observableSet.add('a')
      observableSet.delete('a', { strict: false })
      expect(observableSet.has('a')).toBe(false)
    })
  })

  describe('deleteAll', () => {
    it('should delete multiple values at once', () => {
      observableSet.addAll(['a', 'b', 'c', 'd'])
      observableSet.deleteAll(['a', 'c'])

      expect(observableSet.has('a')).toBe(false)
      expect(observableSet.has('b')).toBe(true)
      expect(observableSet.has('c')).toBe(false)
      expect(observableSet.has('d')).toBe(true)
    })

    it('should notify subscribers once for batch delete', () => {
      observableSet.addAll(['a', 'b', 'c'])

      const callback = vi.fn()
      const subscriber = new TestSubscriber<IImmutableSet<string>>('set', new ImmutableSet())
      subscriber.next = callback

      observableSet.subscribe(subscriber)
      callback.mockClear()

      observableSet.deleteAll(['a', 'b'])
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should handle empty iterable', () => {
      observableSet.add('a')
      const snapshot = observableSet.getSnapshot()
      observableSet.deleteAll([])
      expect(observableSet.getSnapshot()).not.toBe(snapshot)
    })

    it('should handle deleting non-existent values', () => {
      observableSet.add('a')
      expect(() => observableSet.deleteAll(['b', 'c'])).not.toThrow()
      expect(observableSet.has('a')).toBe(true)
    })

    it('should support options parameter', () => {
      observableSet.addAll(['a', 'b', 'c'])
      observableSet.deleteAll(['a', 'b'], { strict: false })
      expect(observableSet.has('a')).toBe(false)
      expect(observableSet.has('b')).toBe(false)
      expect(observableSet.has('c')).toBe(true)
    })
  })

  describe('observeKey', () => {
    it('should observe a specific key', () => {
      const observableA = observableSet.observeKey('a')
      expect(observableA.getSnapshot()).toBeUndefined()

      observableSet.add('a')
      expect(observableA.getSnapshot()).toBe('a')

      observableSet.delete('a')
      expect(observableA.getSnapshot()).toBeUndefined()
    })

    it('should notify key subscribers on changes', () => {
      const observableA = observableSet.observeKey('a')
      const subscriber = new TestSubscriber<string | undefined>('a', undefined)
      observableA.subscribe(subscriber)

      observableSet.add('a')
      expect(subscriber.value).toBe('a')

      observableSet.delete('a')
      expect(subscriber.value).toBeUndefined()
    })
  })

  describe('getSnapshot', () => {
    it('should return the current immutable set', () => {
      observableSet.addAll(['x', 'y'])
      const snapshot = observableSet.getSnapshot()

      expect(snapshot.has('x')).toBe(true)
      expect(snapshot.has('y')).toBe(true)
    })
  })

  describe('keys/values/entries', () => {
    it('should return iterable keys', () => {
      observableSet.addAll(['a', 'b', 'c'])
      const keys = Array.from(observableSet.keys())
      expect(keys).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    })

    it('should return iterable values', () => {
      observableSet.addAll(['a', 'b', 'c'])
      const values = Array.from(observableSet.values())
      expect(values).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    })

    it('should return iterable entries', () => {
      observableSet.addAll(['a', 'b'])
      const entries = Array.from(observableSet.entries())
      expect(entries).toEqual(
        expect.arrayContaining([
          ['a', 'a'],
          ['b', 'b'],
        ]),
      )
    })
  })

  describe('dispose', () => {
    it('should mark the set as disposed', () => {
      expect(observableSet.disposed).toBe(false)
      observableSet.dispose()
      expect(observableSet.disposed).toBe(true)
    })

    it('should throw on add after disposal in strict mode', () => {
      observableSet.dispose()
      expect(() => observableSet.add('a')).toThrow(RangeError)
    })

    it('should not throw on add after disposal in non-strict mode', () => {
      observableSet.dispose()
      expect(() => observableSet.add('a', { strict: false })).not.toThrow()
    })
  })
})
