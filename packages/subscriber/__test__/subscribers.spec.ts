import type { ISubscribers } from '../src'
import { Subscriber, Subscribers } from '../src'

class LocalSubscriber extends Subscriber<string> {
  public readonly _values: string[]

  public constructor() {
    const values: string[] = []

    super({
      onNext: (value, prevValue) => {
        values.push('#next:' + value + ':' + prevValue)
      },
      onDispose: () => {
        values.push('#dispose')
      },
    })
    this._values = values
  }

  public get values(): ReadonlyArray<string> {
    return this._values
  }
}

describe('subscribers', () => {
  let subscribers: ISubscribers<string>

  beforeEach(() => {
    subscribers = new Subscribers<string>({
      ARRANGE_THRESHOLD: 4,
    })
  })

  afterEach(() => {
    subscribers.dispose()
  })

  it('stops notifying when a callback disposes the collection', () => {
    const first = new Subscriber<string>({ onNext: () => subscribers.dispose() })
    const later = new LocalSubscriber()
    subscribers.subscribe(first)
    subscribers.subscribe(later)

    expect(() => subscribers.notify('A', undefined)).not.toThrow()
    expect(subscribers.disposed).toBe(true)
    expect(subscribers.size).toBe(0)
    expect(first.disposed).toBe(true)
    expect(later.disposed).toBe(true)
    expect(later.values).toEqual(['#dispose'])

    subscribers.notify('B', 'A')
    subscribers.dispose()
    expect(later.values).toEqual(['#dispose'])
  })

  it('preserves notification and disposal errors when a callback disposes the collection', () => {
    const notificationError = new Error('notification failed')
    const disposalError = new Error('disposal failed')
    const first = new Subscriber<string>({
      onNext: () => {
        throw notificationError
      },
    })
    const disposing = new Subscriber<string>({
      onNext: () => subscribers.dispose(),
      onDispose: () => {
        throw disposalError
      },
    })
    const later = new LocalSubscriber()
    subscribers.subscribe(first)
    subscribers.subscribe(disposing)
    subscribers.subscribe(later)

    let caught: unknown
    try {
      subscribers.notify('A', undefined)
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(AggregateError)
    expect((caught as AggregateError).errors).toEqual([notificationError, disposalError])
    expect(subscribers.disposed).toBe(true)
    expect(subscribers.size).toBe(0)
    expect(first.disposed).toBe(true)
    expect(disposing.disposed).toBe(true)
    expect(later.disposed).toBe(true)
    expect(later.values).toEqual(['#dispose'])
  })

  it.each([false, true])(
    'keeps removed handles inert after compaction (collection disposed: %s)',
    disposeCollection => {
      subscribers = new Subscribers<string>({ ARRANGE_THRESHOLD: 2 })
      const first = new LocalSubscriber()
      const second = new LocalSubscriber()
      const firstSubscription = subscribers.subscribe(first)
      const secondSubscription = subscribers.subscribe(second)

      first.dispose()
      secondSubscription.unsubscribe()
      expect(subscribers.size).toBe(0)

      if (disposeCollection) subscribers.dispose()
      firstSubscription.unsubscribe()
      expect(subscribers.size).toBe(0)
      firstSubscription.unsubscribe()
      secondSubscription.unsubscribe()
      expect(subscribers.size).toBe(0)
      expect(first.values).toEqual(['#dispose'])
      second.dispose()
    },
  )

  it('does not subtract a live subscription when a removed handle is used', () => {
    const removed = new LocalSubscriber()
    const second = new LocalSubscriber()
    const third = new LocalSubscriber()
    const active = new LocalSubscriber()
    const removedSubscription = subscribers.subscribe(removed)
    const secondSubscription = subscribers.subscribe(second)
    const thirdSubscription = subscribers.subscribe(third)
    const activeSubscription = subscribers.subscribe(active)

    removed.dispose()
    secondSubscription.unsubscribe()
    thirdSubscription.unsubscribe()
    expect(subscribers.size).toBe(1)

    removedSubscription.unsubscribe()
    expect(subscribers.size).toBe(1)
    subscribers.notify('A', undefined)
    expect(active.values).toEqual(['#next:A:undefined'])
    expect(removed.values).toEqual(['#dispose'])

    activeSubscription.unsubscribe()
    removedSubscription.unsubscribe()
    expect(subscribers.size).toBe(0)
    second.dispose()
    third.dispose()
    active.dispose()
  })

  it('still decrements for a disposed subscriber that has not been compacted', () => {
    const removed = new LocalSubscriber()
    const active = new LocalSubscriber()
    const subscription = subscribers.subscribe(removed)
    subscribers.subscribe(active)

    removed.dispose()
    subscription.unsubscribe()
    expect(subscribers.size).toBe(1)
    subscription.unsubscribe()
    expect(subscribers.size).toBe(1)
    subscribers.notify('A', undefined)
    expect(active.values).toEqual(['#next:A:undefined'])
  })

  it('should notify subscribers', () => {
    const subscriber1 = new LocalSubscriber()
    const subscriber2 = new LocalSubscriber()
    const subscriber3 = new LocalSubscriber()
    const subscriber4 = new LocalSubscriber()
    const subscriber5 = new LocalSubscriber()
    const subscriber6 = new LocalSubscriber()
    const subscriber7 = new LocalSubscriber()
    const subscriber8 = new LocalSubscriber()
    const subscriber9 = new LocalSubscriber()

    expect(subscribers.size).toEqual(0)
    const unsubscribable1 = subscribers.subscribe(subscriber1)
    const unsubscribable2 = subscribers.subscribe(subscriber2)
    const unsubscribable3 = subscribers.subscribe(subscriber3)
    const unsubscribable4 = subscribers.subscribe(subscriber4)
    const unsubscribable5 = subscribers.subscribe(subscriber5)
    const unsubscribable6 = subscribers.subscribe(subscriber6)
    const unsubscribable7 = subscribers.subscribe(subscriber7)
    const unsubscribable8 = subscribers.subscribe(subscriber8)
    const unsubscribable9 = subscribers.subscribe(subscriber9)

    expect(subscribers.size).toEqual(9)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)
    expect(subscriber4.disposed).toEqual(false)
    expect(subscriber5.disposed).toEqual(false)
    expect(subscriber6.disposed).toEqual(false)
    expect(subscriber7.disposed).toEqual(false)
    expect(subscriber8.disposed).toEqual(false)
    expect(subscriber9.disposed).toEqual(false)

    subscribers.notify('A', undefined)
    expect(subscriber1.values).toEqual(['#next:A:undefined'])
    expect(subscriber2.values).toEqual(['#next:A:undefined'])
    expect(subscriber3.values).toEqual(['#next:A:undefined'])
    expect(subscriber4.values).toEqual(['#next:A:undefined'])
    expect(subscriber5.values).toEqual(['#next:A:undefined'])
    expect(subscriber6.values).toEqual(['#next:A:undefined'])
    expect(subscriber7.values).toEqual(['#next:A:undefined'])
    expect(subscriber8.values).toEqual(['#next:A:undefined'])
    expect(subscriber9.values).toEqual(['#next:A:undefined'])

    unsubscribable5.unsubscribe()
    expect(subscribers.size).toEqual(8)

    subscribers.notify('B', 'A')
    expect(subscriber1.values).toEqual(['#next:A:undefined', '#next:B:A'])
    expect(subscriber2.values).toEqual(['#next:A:undefined', '#next:B:A'])
    expect(subscriber3.values).toEqual(['#next:A:undefined', '#next:B:A'])
    expect(subscriber4.values).toEqual(['#next:A:undefined', '#next:B:A'])
    expect(subscriber5.values).toEqual(['#next:A:undefined'])
    expect(subscriber6.values).toEqual(['#next:A:undefined', '#next:B:A'])
    expect(subscriber7.values).toEqual(['#next:A:undefined', '#next:B:A'])
    expect(subscriber8.values).toEqual(['#next:A:undefined', '#next:B:A'])
    expect(subscriber9.values).toEqual(['#next:A:undefined', '#next:B:A'])

    subscriber2.dispose()
    subscriber3.dispose()
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)
    expect(subscriber4.disposed).toEqual(false)
    expect(subscriber5.disposed).toEqual(false)
    expect(subscriber6.disposed).toEqual(false)
    expect(subscriber7.disposed).toEqual(false)
    expect(subscriber8.disposed).toEqual(false)
    expect(subscriber9.disposed).toEqual(false)

    subscribers.notify('C', 'B')
    expect(subscriber1.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber2.values).toEqual(['#next:A:undefined', '#next:B:A', '#dispose'])
    expect(subscriber3.values).toEqual(['#next:A:undefined', '#next:B:A', '#dispose'])
    expect(subscriber4.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber5.values).toEqual(['#next:A:undefined'])
    expect(subscriber6.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber7.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber8.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber9.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])

    unsubscribable1.unsubscribe()
    unsubscribable3.unsubscribe()
    unsubscribable4.unsubscribe()
    unsubscribable5.unsubscribe()
    unsubscribable6.unsubscribe()
    unsubscribable7.unsubscribe()

    subscribers.notify('D', 'C')
    expect(subscriber1.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber2.values).toEqual(['#next:A:undefined', '#next:B:A', '#dispose'])
    expect(subscriber3.values).toEqual(['#next:A:undefined', '#next:B:A', '#dispose'])
    expect(subscriber4.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber5.values).toEqual(['#next:A:undefined'])
    expect(subscriber6.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber7.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber8.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B', '#next:D:C'])
    expect(subscriber9.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B', '#next:D:C'])

    expect(subscribers.disposed).toEqual(false)
    subscribers.dispose()
    expect(subscribers.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)
    expect(subscriber4.disposed).toEqual(false)
    expect(subscriber5.disposed).toEqual(false)
    expect(subscriber6.disposed).toEqual(false)
    expect(subscriber7.disposed).toEqual(false)
    expect(subscriber8.disposed).toEqual(true)
    expect(subscriber9.disposed).toEqual(true)

    subscribers.notify('E', 'D')
    expect(subscriber1.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber2.values).toEqual(['#next:A:undefined', '#next:B:A', '#dispose'])
    expect(subscriber3.values).toEqual(['#next:A:undefined', '#next:B:A', '#dispose'])
    expect(subscriber4.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber5.values).toEqual(['#next:A:undefined'])
    expect(subscriber6.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber7.values).toEqual(['#next:A:undefined', '#next:B:A', '#next:C:B'])
    expect(subscriber8.values).toEqual([
      '#next:A:undefined',
      '#next:B:A',
      '#next:C:B',
      '#next:D:C',
      '#dispose',
    ])
    expect(subscriber9.values).toEqual([
      '#next:A:undefined',
      '#next:B:A',
      '#next:C:B',
      '#next:D:C',
      '#dispose',
    ])

    expect(subscriber1.disposed).toEqual(false)
    subscribers.subscribe(subscriber1)
    expect(subscriber1.disposed).toEqual(true)

    expect(subscriber2.disposed).toEqual(true)
    expect(subscribers.size).toEqual(0)
    subscribers.subscribe(subscriber2)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscribers.size).toEqual(0)

    unsubscribable1.unsubscribe()
    unsubscribable2.unsubscribe()
    unsubscribable8.unsubscribe()
    unsubscribable9.unsubscribe()
  })
})
