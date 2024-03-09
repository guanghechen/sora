import { delay } from '@guanghechen/internal'
import { Observable, Ticker } from '../src'
import { TestSubscriber } from './common'

describe('async', () => {
  test('tick', async () => {
    const duration: number = 50
    const ticker = new Ticker({ start: 0, delay: duration })

    // ----------------------------------------------------------------------------------

    expect(ticker.getSnapshot()).toEqual(0)

    // ----------------------------------------------------------------------------------

    ticker.tick()
    expect(ticker.getSnapshot()).toEqual(1)

    // ----------------------------------------------------------------------------------

    ticker.tick()
    expect(ticker.getSnapshot()).toEqual(2)

    // ----------------------------------------------------------------------------------

    const subscriber1 = new TestSubscriber(-1)
    ticker.subscribe(subscriber1)

    expect(ticker.getSnapshot()).toEqual(2)
    expect(subscriber1.value).toEqual(2)
    expect(subscriber1.updateTick).toEqual(1)

    // ----------------------------------------------------------------------------------

    ticker.tick()
    ticker.tick()
    ticker.tick()

    expect(ticker.getSnapshot()).toEqual(5)
    expect(subscriber1.value).toEqual(2)
    expect(subscriber1.updateTick).toEqual(1)

    // ----------------------------------------------------------------------------------

    await delay(duration + 20)

    expect(ticker.getSnapshot()).toEqual(5)
    expect(subscriber1.value).toEqual(5)
    expect(subscriber1.updateTick).toEqual(2)
  })

  test('observe', async () => {
    const duration: number = 50
    const ticker = new Ticker({ start: 0, delay: duration })

    expect(ticker.getSnapshot()).toEqual(0)
    expect(ticker.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    const subscriber1 = new TestSubscriber(-1)
    ticker.subscribe(subscriber1)

    expect(ticker.getSnapshot()).toEqual(0)
    expect(ticker.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(0)
    expect(subscriber1.updateTick).toEqual(1)

    // ----------------------------------------------------------------------------------

    const observable1 = new Observable<number>(100)
    const observable2 = new Observable<number>(200)
    const observable3 = new Observable<number>(300)

    let unobservable1 = ticker.observe(observable1)
    let unobservable2 = ticker.observe(observable2)
    let unobservable3 = ticker.observe(observable3)

    expect(ticker.getSnapshot()).toEqual(3)
    expect(ticker.disposed).toEqual(false)
    expect(observable1.disposed).toEqual(false)
    expect(observable2.disposed).toEqual(false)
    expect(observable3.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(0)
    expect(subscriber1.updateTick).toEqual(1)

    // ----------------------------------------------------------------------------------

    await delay(duration + 20)

    expect(ticker.getSnapshot()).toEqual(3)
    expect(ticker.disposed).toEqual(false)
    expect(observable1.disposed).toEqual(false)
    expect(observable2.disposed).toEqual(false)
    expect(observable3.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(3)
    expect(subscriber1.updateTick).toEqual(2)

    // ----------------------------------------------------------------------------------

    unobservable1.unobserve()
    observable1.next(101)
    await delay(duration + 20)

    expect(ticker.getSnapshot()).toEqual(3)
    expect(ticker.disposed).toEqual(false)
    expect(observable1.disposed).toEqual(false)
    expect(observable2.disposed).toEqual(false)
    expect(observable3.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(3)
    expect(subscriber1.updateTick).toEqual(2)

    // ----------------------------------------------------------------------------------

    observable2.dispose()
    observable2.next(201, { strict: false })
    await delay(duration + 20)

    expect(ticker.getSnapshot()).toEqual(3)
    expect(ticker.disposed).toEqual(false)
    expect(observable1.disposed).toEqual(false)
    expect(observable2.disposed).toEqual(true)
    expect(observable3.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(3)

    // ----------------------------------------------------------------------------------

    observable3.next(301)
    await delay(duration + 20)

    expect(ticker.getSnapshot()).toEqual(4)
    expect(ticker.disposed).toEqual(false)
    expect(observable1.disposed).toEqual(false)
    expect(observable2.disposed).toEqual(true)
    expect(observable3.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(4)

    // ----------------------------------------------------------------------------------

    unobservable1.unobserve()
    unobservable2.unobserve()
    unobservable3.unobserve()

    observable2.next(202, { strict: false })
    observable3.next(302)
    await delay(duration + 20)

    expect(ticker.getSnapshot()).toEqual(4)
    expect(ticker.disposed).toEqual(false)
    expect(observable1.disposed).toEqual(false)
    expect(observable2.disposed).toEqual(true)
    expect(observable3.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(4)

    // ----------------------------------------------------------------------------------

    unobservable2 = ticker.observe(observable2)
    unobservable3 = ticker.observe(observable3)

    expect(ticker.getSnapshot()).toEqual(5)
    expect(ticker.disposed).toEqual(false)
    expect(observable1.disposed).toEqual(false)
    expect(observable2.disposed).toEqual(true)
    expect(observable3.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(4)

    // ----------------------------------------------------------------------------------

    observable2.next(203, { strict: false })
    observable3.next(303)
    await delay(duration + 20)

    expect(ticker.getSnapshot()).toEqual(6)
    expect(ticker.disposed).toEqual(false)
    expect(observable1.disposed).toEqual(false)
    expect(observable2.disposed).toEqual(true)
    expect(observable3.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(6)

    // ----------------------------------------------------------------------------------

    ticker.dispose()
    expect(() => ticker.observe(observable1)).toThrow(
      '[Ticker.observe] the ticker has been disposed.',
    )

    unobservable1 = ticker.observe(observable1, { strict: false })

    observable2.next(104, { strict: false })
    observable2.next(204, { strict: false })
    observable3.next(304, { strict: false })
    await delay(duration + 20)

    expect(ticker.getSnapshot()).toEqual(6)
    expect(ticker.disposed).toEqual(true)
    expect(observable1.disposed).toEqual(false)
    expect(observable2.disposed).toEqual(true)
    expect(observable3.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(6)
  })
})
