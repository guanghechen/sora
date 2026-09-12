import { Subscriber } from '@guanghechen/subscriber'
import { vi } from 'vitest'
import { Observable } from '../src'

describe('subscribe with reentrant callbacks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([0, 10])('delivers updates from the initial callback with delay %i', delay => {
    const observable = new Observable(0, { delay })
    const values: number[] = []
    const subscriber = new Subscriber<number>({
      onNext: value => {
        values.push(value)
        if (value === 0) observable.next(1)
      },
    })

    const subscription = observable.subscribe(subscriber)
    expect(values).toEqual(delay === 0 ? [0, 1] : [0])
    vi.runAllTimers()
    expect(values).toEqual([0, 1])
    expect(observable.getSnapshot()).toBe(1)

    subscription.unsubscribe()
    observable.next(2)
    vi.runAllTimers()
    expect(values).toEqual([0, 1])
    observable.dispose()
    subscriber.dispose()
  })

  it('rolls back registration when the initial callback throws', () => {
    const observable = new Observable(0)
    const error = new Error('initial notification failed')
    const onNext = vi.fn(() => {
      throw error
    })
    const subscriber = new Subscriber<number>({ onNext })

    expect(() => observable.subscribe(subscriber)).toThrow(error)
    expect(() => observable.next(1)).not.toThrow()
    expect(onNext).toHaveBeenCalledTimes(1)
    observable.dispose()
    expect(subscriber.disposed).toBe(false)
    subscriber.dispose()
  })

  it('flushes pending notifications before sending the initial value', () => {
    const observable = new Observable(0, { delay: 10 })
    observable.subscribe(new Subscriber<number>({ onNext: () => {} }))
    observable.next(1)
    vi.runAllTimers()
    observable.next(2)

    const onNext = vi.fn()
    observable.subscribe(new Subscriber<number>({ onNext }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenLastCalledWith(2, 1)
    expect(vi.getTimerCount()).toBe(0)
    observable.dispose()
  })

  it('uses the final value if flushing updates and disposes the observable', () => {
    const observable = new Observable(0, { delay: 10 })
    observable.subscribe(
      new Subscriber<number>({
        onNext: value => {
          if (value === 1) {
            observable.next(2)
            observable.dispose()
          }
        },
      }),
    )
    observable.next(1)

    const onNext = vi.fn()
    const subscriber = new Subscriber<number>({ onNext })
    observable.subscribe(subscriber)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenLastCalledWith(2, undefined)
    expect(observable.getSnapshot()).toBe(2)
    expect(observable.disposed).toBe(true)
    expect(subscriber.disposed).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['observable', 'subscriber'])('allows the initial callback to dispose the %s', target => {
    const observable = new Observable(0)
    const onDispose = vi.fn()
    const subscriber = new Subscriber<number>({
      onNext: () => {
        if (target === 'observable') observable.dispose()
        else subscriber.dispose()
      },
      onDispose,
    })

    const subscription = observable.subscribe(subscriber)
    expect(subscriber.disposed).toBe(true)
    expect(onDispose).toHaveBeenCalledTimes(1)
    expect(() => subscription.unsubscribe()).not.toThrow()
    observable.dispose()
    expect(onDispose).toHaveBeenCalledTimes(1)
  })

  it('does not register the new subscriber when flushing throws', () => {
    const observable = new Observable(0, { delay: 10 })
    const error = new Error('pending notification failed')
    const existing = new Subscriber<number>({
      onNext: value => {
        if (value === 1) throw error
      },
    })
    const subscription = observable.subscribe(existing)
    observable.next(1)

    const onNext = vi.fn()
    const subscriber = new Subscriber<number>({ onNext })
    expect(() => observable.subscribe(subscriber)).toThrow(error)
    subscription.unsubscribe()
    observable.next(2)
    vi.runAllTimers()
    expect(onNext).not.toHaveBeenCalled()
    observable.dispose()
    expect(subscriber.disposed).toBe(false)
    existing.dispose()
    subscriber.dispose()
  })

  it('skips a subscriber disposed by an existing notification callback', () => {
    const observable = new Observable(0, { delay: 10 })
    const onNext = vi.fn()
    const subscriber = new Subscriber<number>({ onNext })
    observable.subscribe(
      new Subscriber<number>({
        onNext: value => {
          if (value === 1) subscriber.dispose()
        },
      }),
    )
    observable.next(1)

    observable.subscribe(subscriber)
    expect(onNext).not.toHaveBeenCalled()
    expect(subscriber.disposed).toBe(true)
    observable.dispose()
  })
})
