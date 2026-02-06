import { Observable } from '@guanghechen/observable'
import type { IConsoleMock } from 'vitest.helper'
import { createConsoleMock } from 'vitest.helper'
import { Computed, State } from '../src'
import { TestSubscriber } from './_common'

describe('Computed', () => {
  let consoleMock: IConsoleMock

  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
  })

  afterEach(() => {
    consoleMock.restore()
  })

  describe('fromObservables', () => {
    it('should create a computed value from a single observable', () => {
      const source = new Observable<number>(10)
      const computed = Computed.fromObservables([source], ([value]) => value * 2)

      expect(computed.getSnapshot()).toBe(20)

      source.next(20)
      expect(computed.getSnapshot()).toBe(40)

      computed.dispose()
      source.dispose()
    })

    it('should create a computed value from multiple observables', () => {
      const a = new Observable<number>(2)
      const b = new Observable<number>(3)
      const computed = Computed.fromObservables([a, b], ([x, y]) => x * y)

      expect(computed.getSnapshot()).toBe(6)

      a.next(5)
      expect(computed.getSnapshot()).toBe(15)

      b.next(10)
      expect(computed.getSnapshot()).toBe(50)

      computed.dispose()
      a.dispose()
      b.dispose()
    })

    it('should work with State observables', () => {
      const state1 = new State<string>('Hello')
      const state2 = new State<string>('World')
      const computed = Computed.fromObservables([state1, state2], ([s1, s2]) => `${s1} ${s2}`)

      expect(computed.getSnapshot()).toBe('Hello World')

      state1.updateState('Hi')
      expect(computed.getSnapshot()).toBe('Hi World')

      state2.setState(() => 'Universe')
      expect(computed.getSnapshot()).toBe('Hi Universe')

      computed.dispose()
      state1.dispose()
      state2.dispose()
    })

    it('should support custom equals option', () => {
      const source = new Observable<{ value: number }>({ value: 1 })
      const computed = Computed.fromObservables([source], ([obj]) => ({ doubled: obj.value * 2 }), {
        equals: (a, b) => a.doubled === b.doubled,
      })

      const subscriber = new TestSubscriber('test', { doubled: 0 })
      computed.subscribe(subscriber)

      expect(subscriber.value).toEqual({ doubled: 2 })

      source.next({ value: 1 })
      expect(subscriber.value).toEqual({ doubled: 2 })

      computed.dispose()
      source.dispose()
    })
  })

  describe('getSnapshot', () => {
    it('should return the current computed value', () => {
      const source = new Observable<number>(5)
      const computed = Computed.fromObservables([source], ([v]) => v + 10)

      expect(computed.getSnapshot()).toBe(15)

      computed.dispose()
      source.dispose()
    })
  })

  describe('getServerSnapshot', () => {
    it('should return the same value as getSnapshot', () => {
      const source = new Observable<number>(7)
      const computed = Computed.fromObservables([source], ([v]) => v * 3)

      expect(computed.getServerSnapshot()).toBe(computed.getSnapshot())
      expect(computed.getServerSnapshot()).toBe(21)

      computed.dispose()
      source.dispose()
    })
  })

  describe('subscribe', () => {
    it('should notify subscribers when source observable changes', () => {
      const source = new Observable<number>(1)
      const computed = Computed.fromObservables([source], ([v]) => v * 10)

      const subscriber = new TestSubscriber('test', 0)
      computed.subscribe(subscriber)

      expect(subscriber.value).toBe(10)

      source.next(2)
      expect(subscriber.value).toBe(20)

      source.next(3)
      expect(subscriber.value).toBe(30)

      computed.dispose()
      source.dispose()
    })

    it('should return an unsubscribable', () => {
      const source = new Observable<number>(1)
      const computed = Computed.fromObservables([source], ([v]) => v)

      const subscriber = new TestSubscriber('test', 0)
      const unsubscribable = computed.subscribe(subscriber)

      source.next(2)
      expect(subscriber.value).toBe(2)

      unsubscribable.unsubscribe()

      source.next(3)
      expect(subscriber.value).toBe(2)

      computed.dispose()
      source.dispose()
    })

    it('should handle multiple subscribers', () => {
      const source = new Observable<number>(0)
      const computed = Computed.fromObservables([source], ([v]) => v)

      const subscriber1 = new TestSubscriber('sub1', -1)
      const subscriber2 = new TestSubscriber('sub2', -1)

      computed.subscribe(subscriber1)
      computed.subscribe(subscriber2)

      source.next(42)
      expect(subscriber1.value).toBe(42)
      expect(subscriber2.value).toBe(42)

      computed.dispose()
      source.dispose()
    })
  })

  describe('subscribeStateChange', () => {
    it('should call the callback when computed value changes', () => {
      const source = new Observable<number>(1)
      const computed = Computed.fromObservables([source], ([v]) => v * 2)

      const callback = vi.fn()
      computed.subscribeStateChange(callback)

      expect(callback).toHaveBeenCalledTimes(1)

      source.next(2)
      expect(callback).toHaveBeenCalledTimes(2)

      source.next(3)
      expect(callback).toHaveBeenCalledTimes(3)

      computed.dispose()
      source.dispose()
    })

    it('should return an unsubscribe function', () => {
      const source = new Observable<number>(1)
      const computed = Computed.fromObservables([source], ([v]) => v)

      const callback = vi.fn()
      const unsubscribe = computed.subscribeStateChange(callback)

      source.next(2)
      expect(callback).toHaveBeenCalledTimes(2)

      unsubscribe()

      source.next(3)
      expect(callback).toHaveBeenCalledTimes(2)

      computed.dispose()
      source.dispose()
    })

    it('should not call callback when computed value is the same', () => {
      const source = new Observable<number>(5)
      const computed = Computed.fromObservables([source], ([v]) => Math.floor(v / 10))

      const callback = vi.fn()
      computed.subscribeStateChange(callback)

      expect(callback).toHaveBeenCalledTimes(1)

      source.next(6)
      expect(callback).toHaveBeenCalledTimes(1)

      source.next(15)
      expect(callback).toHaveBeenCalledTimes(2)

      computed.dispose()
      source.dispose()
    })
  })

  describe('disposed', () => {
    it('should return false initially', () => {
      const source = new Observable<number>(0)
      const computed = Computed.fromObservables([source], ([v]) => v)

      expect(computed.disposed).toBe(false)

      computed.dispose()
      source.dispose()
    })

    it('should return true after disposal', () => {
      const source = new Observable<number>(0)
      const computed = Computed.fromObservables([source], ([v]) => v)

      computed.dispose()
      expect(computed.disposed).toBe(true)

      source.dispose()
    })
  })

  describe('dispose', () => {
    it('should dispose the computed observable', () => {
      const source = new Observable<number>(0)
      const computed = Computed.fromObservables([source], ([v]) => v)

      expect(computed.disposed).toBe(false)
      computed.dispose()
      expect(computed.disposed).toBe(true)

      source.dispose()
    })

    it('should be idempotent', () => {
      const source = new Observable<number>(0)
      const computed = Computed.fromObservables([source], ([v]) => v)

      computed.dispose()
      computed.dispose()
      expect(computed.disposed).toBe(true)

      source.dispose()
    })

    it('should stop updating after disposal', () => {
      const source = new Observable<number>(1)
      const computed = Computed.fromObservables([source], ([v]) => v * 10)

      const subscriber = new TestSubscriber('test', 0)
      computed.subscribe(subscriber)

      expect(subscriber.value).toBe(10)

      computed.dispose()

      source.next(2)
      expect(subscriber.value).toBe(10)

      source.dispose()
    })
  })

  describe('registerDisposable', () => {
    it('should register a disposable that gets disposed with the computed', () => {
      const source = new Observable<number>(0)
      const computed = Computed.fromObservables([source], ([v]) => v)

      const mockDispose = vi.fn()
      const disposable = { dispose: mockDispose, disposed: false }

      computed.registerDisposable(disposable)

      expect(mockDispose).not.toHaveBeenCalled()

      computed.dispose()
      expect(mockDispose).toHaveBeenCalled()

      source.dispose()
    })
  })

  describe('complex transforms', () => {
    it('should handle derived computations with multiple dependencies', () => {
      const firstName = new State<string>('John')
      const lastName = new State<string>('Doe')
      const age = new State<number>(25)

      const fullName = Computed.fromObservables(
        [firstName, lastName],
        ([first, last]) => `${first} ${last}`,
      )

      const profile = Computed.fromObservables([fullName, age], ([name, ageVal]) => ({
        name,
        age: ageVal,
      }))

      expect(profile.getSnapshot()).toEqual({ name: 'John Doe', age: 25 })

      firstName.updateState('Jane')
      expect(profile.getSnapshot()).toEqual({ name: 'Jane Doe', age: 25 })

      age.updateState(30)
      expect(profile.getSnapshot()).toEqual({ name: 'Jane Doe', age: 30 })

      profile.dispose()
      fullName.dispose()
      firstName.dispose()
      lastName.dispose()
      age.dispose()
    })

    it('should handle array aggregation', () => {
      const items = new State<number[]>([1, 2, 3])
      const sum = Computed.fromObservables([items], ([arr]) => arr.reduce((a, b) => a + b, 0))

      expect(sum.getSnapshot()).toBe(6)

      items.updateState([1, 2, 3, 4])
      expect(sum.getSnapshot()).toBe(10)

      items.updateState([])
      expect(sum.getSnapshot()).toBe(0)

      sum.dispose()
      items.dispose()
    })
  })
})
