import type { IConsoleMock } from 'vitest.helper'
import { createConsoleMock } from 'vitest.helper'
import { ObservableMap } from '../src'
import type { IImmutableMap, IObservableMap } from '../src'
import { ImmutableMap, TestSubscriber } from './_common'

describe('ObservableMap', () => {
  let observableMap: IObservableMap<string, string, IImmutableMap<string, string>>
  let consoleMock: IConsoleMock
  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
  })
  afterEach(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    observableMap = new ObservableMap<string, string, IImmutableMap<string, string>>(
      new ImmutableMap<string, string>(),
    )
  })

  afterEach(() => {
    observableMap.dispose()
  })

  it('observeKey', async () => {
    const observableA = observableMap.observeKey('A')
    const observableB = observableMap.observeKey('B')
    const observableC = observableMap.observeKey('C')
    const subscriberA = new TestSubscriber<string>('A', '')
    const subscriberB = new TestSubscriber<string>('B', '')
    const subscriberC = new TestSubscriber<string>('C', '')
    const unsubscribableA = observableA.subscribe(subscriberA)
    const unsubscribableB = observableB.subscribe(subscriberB)
    const unsubscribableC = observableC.subscribe(subscriberC)

    expect(observableA.disposed).toEqual(false)
    expect(observableB.disposed).toEqual(false)

    expect(observableA.getSnapshot()).toEqual(undefined)
    expect(observableB.getSnapshot()).toEqual(undefined)
    expect(observableC.getSnapshot()).toEqual(undefined)
    expect(subscriberA.value).toEqual(undefined)
    expect(subscriberB.value).toEqual(undefined)
    expect(subscriberC.value).toEqual(undefined)

    observableMap.set('A', 'waw1')
    expect(observableA.getSnapshot()).toEqual('waw1')
    expect(observableB.getSnapshot()).toEqual(undefined)
    expect(observableC.getSnapshot()).toEqual(undefined)
    expect(subscriberA.value).toEqual('waw1')
    expect(subscriberB.value).toEqual(undefined)
    expect(subscriberC.value).toEqual(undefined)

    observableMap.set('B', 'waw2')
    expect(observableA.getSnapshot()).toEqual('waw1')
    expect(observableB.getSnapshot()).toEqual('waw2')
    expect(observableC.getSnapshot()).toEqual(undefined)
    expect(subscriberA.value).toEqual('waw1')
    expect(subscriberB.value).toEqual('waw2')
    expect(subscriberC.value).toEqual(undefined)

    observableMap.set('C', 'waw3')
    observableMap.delete('B')
    expect(observableA.getSnapshot()).toEqual('waw1')
    expect(observableB.getSnapshot()).toEqual(undefined)
    expect(observableC.getSnapshot()).toEqual('waw3')
    expect(subscriberA.value).toEqual('waw1')
    expect(subscriberB.value).toEqual(undefined)
    expect(subscriberC.value).toEqual('waw3')

    observableMap.merge([
      ['A', 'waw1_2'],
      ['B', 'waw2_2'],
    ])
    expect(observableMap.get('A')).toEqual('waw1_2')
    expect(observableA.getSnapshot()).toEqual('waw1_2')
    expect(observableB.getSnapshot()).toEqual('waw2_2')
    expect(observableC.getSnapshot()).toEqual('waw3')
    expect(subscriberA.value).toEqual('waw1_2')
    expect(subscriberB.value).toEqual('waw2_2')
    expect(subscriberC.value).toEqual('waw3')

    unsubscribableB.unsubscribe()

    observableMap.merge([
      ['B', 'waw2_3'],
      ['C', 'waw3_3'],
    ])
    expect(observableA.getSnapshot()).toEqual('waw1_2')
    expect(observableB.getSnapshot()).toEqual('waw2_3')
    expect(observableC.getSnapshot()).toEqual('waw3_3')
    expect(subscriberA.value).toEqual('waw1_2')
    expect(subscriberB.value).toEqual('waw2_2')
    expect(subscriberC.value).toEqual('waw3_3')

    unsubscribableA.unsubscribe()
    unsubscribableC.unsubscribe()

    observableMap.merge([
      ['A', 'waw1_4'],
      ['B', 'waw2_4'],
      ['C', 'waw3_4'],
    ])
    expect(observableA.getSnapshot()).toEqual('waw1_4')
    expect(observableB.getSnapshot()).toEqual('waw2_4')
    expect(observableC.getSnapshot()).toEqual('waw3_4')
    expect(subscriberA.value).toEqual('waw1_2')
    expect(subscriberB.value).toEqual('waw2_2')
    expect(subscriberC.value).toEqual('waw3_3')

    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot('[]')
  })

  describe('deleteAll', () => {
    it('should delete multiple keys at once', () => {
      observableMap.set('A', 'v1')
      observableMap.set('B', 'v2')
      observableMap.set('C', 'v3')
      observableMap.set('D', 'v4')

      observableMap.deleteAll(['A', 'C'])

      expect(observableMap.has('A')).toBe(false)
      expect(observableMap.has('B')).toBe(true)
      expect(observableMap.has('C')).toBe(false)
      expect(observableMap.has('D')).toBe(true)
    })

    it('should notify subscribers once for batch delete', () => {
      observableMap.set('A', 'v1')
      observableMap.set('B', 'v2')

      const callback = vi.fn()
      const subscriber = new TestSubscriber<IImmutableMap<string, string>>(
        'map',
        new ImmutableMap(),
      )
      subscriber.next = callback

      observableMap.subscribe(subscriber)
      callback.mockClear()

      observableMap.deleteAll(['A', 'B'])
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should notify key subscribers correctly', () => {
      observableMap.set('A', 'v1')
      observableMap.set('B', 'v2')

      const observableA = observableMap.observeKey('A')
      const observableB = observableMap.observeKey('B')

      observableMap.deleteAll(['A'])

      expect(observableA.getSnapshot()).toBeUndefined()
      expect(observableB.getSnapshot()).toBe('v2')
    })

    it('should handle empty iterable', () => {
      observableMap.set('A', 'v1')
      observableMap.deleteAll([])
      expect(observableMap.has('A')).toBe(true)
    })

    it('should support options parameter', () => {
      observableMap.set('A', 'v1')
      observableMap.deleteAll(['A'], { strict: false })
      expect(observableMap.has('A')).toBe(false)
    })
  })

  describe('subscribeKey', () => {
    it('should subscribe to a specific key', () => {
      const subscriber = new TestSubscriber<string | undefined>('A', undefined)
      observableMap.subscribeKey('A', subscriber)

      observableMap.set('A', 'value')
      expect(subscriber.value).toBe('value')
    })

    it('should return noop unsubscribable for disposed subscriber', () => {
      const subscriber = new TestSubscriber<string | undefined>('A', undefined)
      subscriber.dispose()

      const unsubscribable = observableMap.subscribeKey('A', subscriber)
      unsubscribable.unsubscribe()
    })

    it('should dispose subscriber when map is disposed', () => {
      const subscriber = new TestSubscriber<string | undefined>('A', undefined)
      observableMap.subscribeKey('A', subscriber)

      observableMap.dispose()
      expect(subscriber.disposed).toBe(true)
    })

    it('should add to existing key subscribers array', () => {
      const subscriber1 = new TestSubscriber<string | undefined>('A1', undefined)
      const subscriber2 = new TestSubscriber<string | undefined>('A2', undefined)

      observableMap.subscribeKey('A', subscriber1)
      observableMap.subscribeKey('A', subscriber2)

      observableMap.set('A', 'value')
      expect(subscriber1.value).toBe('value')
      expect(subscriber2.value).toBe('value')
    })
  })

  describe('disposed behavior', () => {
    it('should throw on set after disposal in strict mode', () => {
      observableMap.dispose()
      expect(() => observableMap.set('A', 'v')).toThrow(RangeError)
    })

    it('should not throw on set after disposal in non-strict mode', () => {
      observableMap.dispose()
      expect(() => observableMap.set('A', 'v', { strict: false })).not.toThrow()
    })

    it('should return disposed observable when observeKey is called after dispose', () => {
      observableMap.set('A', 'value')
      observableMap.dispose()

      const observable = observableMap.observeKey('A')
      expect(observable.disposed).toBe(true)
      expect(observable.getSnapshot()).toBe('value')
    })

    it('should dispose subscriber when subscribeKey is called after dispose', () => {
      observableMap.dispose()

      const subscriber = new TestSubscriber<string | undefined>('A', undefined)
      observableMap.subscribeKey('A', subscriber)

      expect(subscriber.disposed).toBe(true)
    })
  })

  describe('subscribe', () => {
    it('should return noop unsubscribable for disposed subscriber', () => {
      const subscriber = new TestSubscriber<IImmutableMap<string, string>>(
        'map',
        new ImmutableMap(),
      )
      subscriber.dispose()

      const unsubscribable = observableMap.subscribe(subscriber)
      unsubscribable.unsubscribe()
    })

    it('should dispose subscriber when map is disposed', () => {
      const subscriber = new TestSubscriber<IImmutableMap<string, string>>(
        'map',
        new ImmutableMap(),
      )
      observableMap.subscribe(subscriber)

      observableMap.dispose()
      expect(subscriber.disposed).toBe(true)
    })
  })

  describe('next with force option', () => {
    it('should not notify when same value without force', () => {
      const callback = vi.fn()
      const subscriber = new TestSubscriber<IImmutableMap<string, string>>(
        'map',
        new ImmutableMap(),
      )
      subscriber.next = callback

      observableMap.subscribe(subscriber)
      callback.mockClear()

      const snapshot = observableMap.getSnapshot()
      observableMap.next(snapshot)
      expect(callback).not.toHaveBeenCalled()
    })

    it('should notify when same value with force', () => {
      const callback = vi.fn()
      const subscriber = new TestSubscriber<IImmutableMap<string, string>>(
        'map',
        new ImmutableMap(),
      )
      subscriber.next = callback

      observableMap.subscribe(subscriber)
      callback.mockClear()

      const snapshot = observableMap.getSnapshot()
      observableMap.next(snapshot, { force: true })
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })
})
