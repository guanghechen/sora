import { Disposable } from '@guanghechen/disposable'
import { Subscriber } from '@guanghechen/subscriber'
import { vi } from 'vitest'
import { Observable } from '../src'

describe('dispose after errors', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(['registered cleanup', 'pending notification', 'subscriber cleanup', 'all phases'])(
    'finishes disposal when %s throws',
    failure => {
      const observable = new Observable(0, { delay: 10 })
      const cleanupError = new Error('registered cleanup failed')
      const notificationError = new Error('pending notification failed')
      const subscriberError = new Error('subscriber cleanup failed')
      const failCleanup = failure === 'registered cleanup' || failure === 'all phases'
      const failNotification = failure === 'pending notification' || failure === 'all phases'
      const failSubscriber = failure === 'subscriber cleanup' || failure === 'all phases'
      const events: string[] = []

      const resource = new Disposable(() => {
        events.push('resource:dispose')
        observable.dispose()
        if (failCleanup) throw cleanupError
      })
      const first = new Subscriber<number>({
        onNext: value => {
          events.push(`first:next:${value}`)
          if (value === 1 && failNotification) throw notificationError
        },
        onDispose: () => {
          events.push('first:dispose')
          if (failSubscriber) throw subscriberError
        },
      })
      const later = new Subscriber<number>({
        onNext: value => {
          events.push(`later:next:${value}`)
        },
        onDispose: () => {
          events.push('later:dispose')
        },
      })
      observable.registerDisposable(resource)
      observable.subscribe(first)
      observable.subscribe(later)
      events.length = 0
      observable.next(1)
      expect(vi.getTimerCount()).toBe(1)

      let caught: unknown
      try {
        observable.dispose()
      } catch (error) {
        caught = error
      }
      if (failure === 'all phases') {
        expect(caught).toBeInstanceOf(AggregateError)
        expect((caught as AggregateError).errors).toEqual([
          cleanupError,
          notificationError,
          subscriberError,
        ])
      } else {
        expect(caught).toBe(
          failCleanup ? cleanupError : failNotification ? notificationError : subscriberError,
        )
      }
      expect(observable.disposed).toBe(true)
      expect(resource.disposed).toBe(true)
      expect(first.disposed).toBe(true)
      expect(later.disposed).toBe(true)
      expect(events).toEqual([
        'resource:dispose',
        'first:next:1',
        'later:next:1',
        'first:dispose',
        'later:dispose',
      ])
      expect(vi.getTimerCount()).toBe(0)

      events.length = 0
      expect(() => observable.dispose()).not.toThrow()
      vi.runAllTimers()
      expect(events).toEqual([])
    },
  )
})
