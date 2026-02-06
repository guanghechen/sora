import type { IObservable } from '../src'
import { Observable } from '../src'
import { TestSubscriber } from './common'

describe('sync', () => {
  it('notifier', () => {
    const observable: IObservable<number> = new Observable<number>(0)
    const subscriber1 = new TestSubscriber(1)
    const subscriber2 = new TestSubscriber(2)
    const subscriber3 = new TestSubscriber(3)

    expect(observable.getSnapshot()).toEqual(0)
    expect(subscriber1.value).toEqual(1)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber3.value).toEqual(3)
    expect(subscriber1.updateTick).toEqual(0)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber3.updateTick).toEqual(0)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    const unsubscribable1 = observable.subscribe(subscriber1)
    observable.next(100)

    expect(observable.getSnapshot()).toEqual(100)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber3.value).toEqual(3)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber3.updateTick).toEqual(0)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    const unsubscribable2 = observable.subscribe(subscriber2)
    const unsubscribable3 = observable.subscribe(subscriber3)

    expect(observable.getSnapshot()).toEqual(100)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(100)
    expect(subscriber3.value).toEqual(100)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(1)
    expect(subscriber3.updateTick).toEqual(1)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    unsubscribable1.unsubscribe()
    observable.next(101)

    expect(observable.getSnapshot()).toEqual(101)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(101)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(2)
    expect(subscriber3.updateTick).toEqual(2)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    observable.next(101)

    expect(observable.getSnapshot()).toEqual(101)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(101)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(2)
    expect(subscriber3.updateTick).toEqual(2)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    observable.next(101, { force: true })

    expect(observable.getSnapshot()).toEqual(101)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(101)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(3)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    subscriber3.dispose()
    observable.next(102)

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    observable.dispose()

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    expect(() => observable.next(103, { strict: false })).not.toThrow()

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    expect(() => observable.next(103)).toThrow("Don't update a disposed observable. value: 103.")

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    unsubscribable2.unsubscribe()
    unsubscribable3.unsubscribe()

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    subscriber1.dispose()
    subscriber2.dispose()
    subscriber3.dispose()

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(true)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)
  })
})

describe('async', () => {
  it('notifier', async () => {
    const duration = 50
    const observable: IObservable<number> = new Observable<number>(0, { delay: duration })
    const subscriber1 = new TestSubscriber(1)
    const subscriber2 = new TestSubscriber(2)
    const subscriber3 = new TestSubscriber(3)

    expect(observable.getSnapshot()).toEqual(0)
    expect(subscriber1.value).toEqual(1)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber3.value).toEqual(3)
    expect(subscriber1.updateTick).toEqual(0)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber3.updateTick).toEqual(0)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    const unsubscribable1 = observable.subscribe(subscriber1)

    expect(observable.getSnapshot()).toEqual(0)
    expect(subscriber1.value).toEqual(0)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber3.value).toEqual(3)
    expect(subscriber1.updateTick).toEqual(1)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber3.updateTick).toEqual(0)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    observable.next(100)

    expect(observable.getSnapshot()).toEqual(100)
    expect(subscriber1.value).toEqual(0)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber3.value).toEqual(3)
    expect(subscriber1.updateTick).toEqual(1)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber3.updateTick).toEqual(0)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    await new Promise<void>(resolve => setTimeout(resolve, duration + 20))

    expect(observable.getSnapshot()).toEqual(100)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber3.value).toEqual(3)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber3.updateTick).toEqual(0)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    const unsubscribable2 = observable.subscribe(subscriber2)
    const unsubscribable3 = observable.subscribe(subscriber3)

    expect(observable.getSnapshot()).toEqual(100)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(100)
    expect(subscriber3.value).toEqual(100)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(1)
    expect(subscriber3.updateTick).toEqual(1)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    unsubscribable1.unsubscribe()
    observable.next(101)

    expect(observable.getSnapshot()).toEqual(101)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(100)
    expect(subscriber3.value).toEqual(100)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(1)
    expect(subscriber3.updateTick).toEqual(1)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    await new Promise<void>(resolve => setTimeout(resolve, duration + 20))

    expect(observable.getSnapshot()).toEqual(101)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(101)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(2)
    expect(subscriber3.updateTick).toEqual(2)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    observable.next(101)

    expect(observable.getSnapshot()).toEqual(101)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(101)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(2)
    expect(subscriber3.updateTick).toEqual(2)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    await new Promise<void>(resolve => setTimeout(resolve, duration + 20))

    expect(observable.getSnapshot()).toEqual(101)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(101)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(2)
    expect(subscriber3.updateTick).toEqual(2)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    observable.next(101, { force: true })

    expect(observable.getSnapshot()).toEqual(101)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(101)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(2)
    expect(subscriber3.updateTick).toEqual(2)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    await new Promise<void>(resolve => setTimeout(resolve, duration + 20))

    expect(observable.getSnapshot()).toEqual(101)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(101)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(3)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    subscriber3.dispose()
    observable.next(102)

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(101)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(3)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(false)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    observable.dispose()

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    expect(() => observable.next(103, { strict: false })).not.toThrow()

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    expect(() => observable.next(103)).toThrow("Don't update a disposed observable. value: 103.")

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    unsubscribable2.unsubscribe()
    unsubscribable3.unsubscribe()

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    subscriber1.dispose()
    subscriber2.dispose()
    subscriber3.dispose()

    expect(observable.getSnapshot()).toEqual(102)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber2.value).toEqual(102)
    expect(subscriber3.value).toEqual(101)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber2.updateTick).toEqual(4)
    expect(subscriber3.updateTick).toEqual(3)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.disposed).toEqual(true)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.disposed).toEqual(true)
  })

  it('subscribe', async () => {
    const duration = 50
    const observable: IObservable<number> = new Observable<number>(0, { delay: duration })

    expect(observable.getSnapshot()).toEqual(0)

    // ----------------------------------------------------------------------------------

    const subscriber1 = new TestSubscriber(1)
    observable.subscribe(subscriber1)

    expect(observable.getSnapshot()).toEqual(0)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(0)
    expect(subscriber1.updateTick).toEqual(1)
    expect(subscriber1.disposed).toEqual(false)

    // ----------------------------------------------------------------------------------

    const subscriber2 = new TestSubscriber(2)
    subscriber2.dispose()
    observable.subscribe(subscriber2)

    expect(observable.getSnapshot()).toEqual(0)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(0)
    expect(subscriber1.updateTick).toEqual(1)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber2.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    observable.next(100)
    await new Promise<void>(resolve => setTimeout(resolve, duration + 20))

    expect(observable.getSnapshot()).toEqual(100)
    expect(observable.disposed).toEqual(false)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber1.disposed).toEqual(false)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber2.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    observable.dispose()
    observable.next(101, { strict: false })

    expect(observable.getSnapshot()).toEqual(100)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber1.disposed).toEqual(true)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber2.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    const subscriber3 = new TestSubscriber(3)
    observable.subscribe(subscriber3)

    expect(observable.getSnapshot()).toEqual(100)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber1.disposed).toEqual(true)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.value).toEqual(100)
    expect(subscriber3.updateTick).toEqual(1)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------
    observable.dispose()
    observable.next(102, { strict: false })

    expect(observable.getSnapshot()).toEqual(100)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber1.disposed).toEqual(true)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.value).toEqual(100)
    expect(subscriber3.updateTick).toEqual(1)
    expect(subscriber3.disposed).toEqual(true)

    // ----------------------------------------------------------------------------------

    subscriber1.next(107, undefined)
    subscriber2.next(107, undefined)
    subscriber3.next(107, undefined)

    expect(observable.getSnapshot()).toEqual(100)
    expect(observable.disposed).toEqual(true)
    expect(subscriber1.value).toEqual(100)
    expect(subscriber1.updateTick).toEqual(2)
    expect(subscriber1.disposed).toEqual(true)
    expect(subscriber2.value).toEqual(2)
    expect(subscriber2.updateTick).toEqual(0)
    expect(subscriber2.disposed).toEqual(true)
    expect(subscriber3.value).toEqual(100)
    expect(subscriber3.updateTick).toEqual(1)
    expect(subscriber3.disposed).toEqual(true)
  })
})
