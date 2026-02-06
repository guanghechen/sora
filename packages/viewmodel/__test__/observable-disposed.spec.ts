import { noopUnsubscribable } from '@guanghechen/observable'
import type { IConsoleMock } from 'vitest.helper'
import { createConsoleMock } from 'vitest.helper'
import { DisposedObservable } from '../src'
import { TestSubscriber } from './_common'

describe('DisposedObservable', () => {
  let consoleMock: IConsoleMock

  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
  })

  afterEach(() => {
    consoleMock.restore()
  })

  describe('constructor', () => {
    it('should create with default value', () => {
      const observable = new DisposedObservable<number>(42)
      expect(observable.getSnapshot()).toBe(42)
    })

    it('should use default equals when no options provided', () => {
      const observable = new DisposedObservable<number>(1)
      expect(observable.equals(1, 1)).toBe(true)
      expect(observable.equals(1, 2)).toBe(false)
    })

    it('should use custom equals from options', () => {
      const customEquals = (a: number, b: number): boolean => Math.abs(a) === Math.abs(b)
      const observable = new DisposedObservable<number>(1, { equals: customEquals })

      expect(observable.equals(5, 5)).toBe(true)
      expect(observable.equals(-5, 5)).toBe(true)
      expect(observable.equals(5, 6)).toBe(false)
    })
  })

  describe('disposed', () => {
    it('should always return true', () => {
      const observable = new DisposedObservable<string>('test')
      expect(observable.disposed).toBe(true)
    })
  })

  describe('dispose', () => {
    it('should be a no-op', () => {
      const observable = new DisposedObservable<number>(0)
      expect(() => observable.dispose()).not.toThrow()
      expect(observable.disposed).toBe(true)
    })

    it('should be idempotent', () => {
      const observable = new DisposedObservable<number>(0)
      observable.dispose()
      observable.dispose()
      observable.dispose()
      expect(observable.disposed).toBe(true)
    })
  })

  describe('registerDisposable', () => {
    it('should immediately dispose the registered disposable', () => {
      const observable = new DisposedObservable<number>(0)
      const mockDispose = vi.fn()
      const disposable = { dispose: mockDispose, disposed: false }

      observable.registerDisposable(disposable)

      expect(mockDispose).toHaveBeenCalledTimes(1)
    })
  })

  describe('getSnapshot', () => {
    it('should return the default value', () => {
      const observable = new DisposedObservable<string>('hello')
      expect(observable.getSnapshot()).toBe('hello')
    })

    it('should work with complex types', () => {
      const obj = { a: 1, b: 'test' }
      const observable = new DisposedObservable(obj)
      expect(observable.getSnapshot()).toBe(obj)
    })
  })

  describe('next', () => {
    it('should throw RangeError in strict mode (default)', () => {
      const observable = new DisposedObservable<number>(0)

      expect(() => observable.next(1)).toThrow(RangeError)
      expect(() => observable.next(1)).toThrow("Don't update a disposed observable")
    })

    it('should throw with value in error message', () => {
      const observable = new DisposedObservable<string>('initial')

      expect(() => observable.next('newValue')).toThrow('newValue')
    })

    it('should throw in strict mode when explicitly set to true', () => {
      const observable = new DisposedObservable<number>(0)

      expect(() => observable.next(1, { strict: true })).toThrow(RangeError)
    })

    it('should not throw in non-strict mode', () => {
      const observable = new DisposedObservable<number>(0)

      expect(() => observable.next(1, { strict: false })).not.toThrow()
    })

    it('should not update value in non-strict mode', () => {
      const observable = new DisposedObservable<number>(0)

      observable.next(100, { strict: false })
      expect(observable.getSnapshot()).toBe(0)
    })
  })

  describe('subscribe', () => {
    it('should dispose the subscriber immediately', () => {
      const observable = new DisposedObservable<number>(42)
      const subscriber = new TestSubscriber<number>('test', 0)

      expect(subscriber.disposed).toBe(false)

      observable.subscribe(subscriber)

      expect(subscriber.disposed).toBe(true)
    })

    it('should return noopUnsubscribable', () => {
      const observable = new DisposedObservable<number>(0)
      const subscriber = new TestSubscriber<number>('test', 0)

      const result = observable.subscribe(subscriber)

      expect(result).toBe(noopUnsubscribable)
    })

    it('should not call subscriber.next', () => {
      const observable = new DisposedObservable<number>(42)
      const nextFn = vi.fn()
      const subscriber = new TestSubscriber<number>('test', 0)
      subscriber.next = nextFn

      observable.subscribe(subscriber)

      expect(nextFn).not.toHaveBeenCalled()
    })
  })

  describe('equals', () => {
    it('should use Object.is by default', () => {
      const observable = new DisposedObservable<any>(null)

      expect(observable.equals(NaN, NaN)).toBe(true)
      expect(observable.equals(0, -0)).toBe(false)
      expect(observable.equals('a', 'a')).toBe(true)
      expect(observable.equals({}, {})).toBe(false)
    })

    it('should use custom equals function', () => {
      const arrayEquals = (a: number[], b: number[]): boolean =>
        a.length === b.length && a.every((v, i) => v === b[i])
      const observable = new DisposedObservable<number[]>([], { equals: arrayEquals })

      expect(observable.equals([1, 2], [1, 2])).toBe(true)
      expect(observable.equals([1, 2], [1, 3])).toBe(false)
      expect(observable.equals([1], [1, 2])).toBe(false)
    })
  })

  describe('use cases', () => {
    it('should be usable as a placeholder for disposed observables', () => {
      const observable = new DisposedObservable<string>('fallback')

      expect(observable.disposed).toBe(true)
      expect(observable.getSnapshot()).toBe('fallback')

      const subscriber = new TestSubscriber<string>('test', '')
      const unsubscribable = observable.subscribe(subscriber)

      expect(subscriber.disposed).toBe(true)
      expect(unsubscribable.unsubscribe).toBeDefined()
    })
  })
})
