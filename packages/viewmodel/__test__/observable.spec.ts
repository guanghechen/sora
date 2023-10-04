import type { IConsoleMock } from '@guanghechen/helper-jest'
import { createConsoleMock } from '@guanghechen/helper-jest'
import { DisposedObservable, Observable, SchedulableTransaction, noop } from '../src'
import { Subscriber } from './_common'

describe('Observable', () => {
  let consoleMock: IConsoleMock
  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
  })
  afterEach(() => {
    consoleMock.restore()
  })

  test('do not unsubscribe', async () => {
    const observable = new Observable<number>(1)

    const subscriber0 = new Subscriber('subscriber0', 0)
    expect(subscriber0.value).toEqual(0)

    observable.subscribe(subscriber0)

    expect(observable.disposed).toEqual(false)
    expect(observable.getSnapshot()).toEqual(1)
    expect(subscriber0.value).toEqual(0)

    observable.next(2)
    expect(observable.getSnapshot()).toEqual(2)
    expect(subscriber0.value).toEqual(2)

    observable.dispose()

    observable.next(3)
    expect(observable.getSnapshot()).toEqual(2)
    expect(subscriber0.value).toEqual(2)

    const subscriber1 = new Subscriber('subscriber1', 0)
    observable.subscribe(subscriber1)

    observable.next(4)
    expect(observable.getSnapshot()).toEqual(2)
    expect(subscriber0.value).toEqual(2)
    expect(subscriber1.value).toEqual(0)

    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "[in test] called subscriber0.complete",
        ],
        [
          "[Observable] Don't update a disposed observable. value:",
          3,
        ],
        [
          "[in test] called subscriber1.complete",
        ],
        [
          "[Observable] Don't update a disposed observable. value:",
          4,
        ],
      ]
    `)
  })

  test('unsubscribe', async () => {
    const observable = new Observable<number>(1)

    const subscriber = new Subscriber('subscriber', 0)
    expect(subscriber.value).toEqual(0)

    const unsubscribable = observable.subscribe(subscriber)

    expect(observable.getSnapshot()).toEqual(1)
    expect(subscriber.value).toEqual(0)
    expect(observable.disposed).toEqual(false)

    observable.next(2)
    expect(observable.getSnapshot()).toEqual(2)
    expect(subscriber.value).toEqual(2)

    unsubscribable.unsubscribe()

    observable.next(3)
    expect(observable.getSnapshot()).toEqual(3)
    expect(subscriber.value).toEqual(2)

    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
  })

  test('transaction', async () => {
    const transaction = new SchedulableTransaction()
    const observableA = new Observable<number>(1)
    const observableB = new Observable<string>('A')

    const A: number[] = []
    const B: string[] = []
    observableA.subscribe({ next: v => A.push(v), complete: noop })
    observableB.subscribe({ next: v => B.push(v), complete: noop })

    expect(observableA.getSnapshot()).toEqual(1)
    expect(observableB.getSnapshot()).toEqual('A')
    expect(A).toMatchInlineSnapshot(`[]`)
    expect(B).toMatchInlineSnapshot(`[]`)

    observableA.next(2)
    observableB.next('B')
    expect(observableA.getSnapshot()).toEqual(2)
    expect(observableB.getSnapshot()).toEqual('B')
    expect(A.join(', ')).toMatchInlineSnapshot(`"2"`)
    expect(B.join(', ')).toMatchInlineSnapshot(`"B"`)

    observableA.next(3, transaction)
    observableB.next('C', transaction)
    expect(observableA.getSnapshot()).toEqual(3)
    expect(observableB.getSnapshot()).toEqual('C')
    expect(A.join(', ')).toMatchInlineSnapshot(`"2, 3"`)
    expect(B.join(', ')).toMatchInlineSnapshot(`"B, C"`)

    transaction.start()
    observableA.next(4, transaction)
    observableB.next('D', transaction)
    expect(observableA.getSnapshot()).toEqual(4)
    expect(observableB.getSnapshot()).toEqual('D')
    expect(A.join(', ')).toMatchInlineSnapshot(`"2, 3"`)
    expect(B.join(', ')).toMatchInlineSnapshot(`"B, C"`)

    observableA.next(5, transaction)
    observableB.next('E', transaction)
    expect(observableA.getSnapshot()).toEqual(5)
    expect(observableB.getSnapshot()).toEqual('E')
    expect(A.join(', ')).toMatchInlineSnapshot(`"2, 3"`)
    expect(B.join(', ')).toMatchInlineSnapshot(`"B, C"`)

    transaction.end()
    expect(observableA.getSnapshot()).toEqual(5)
    expect(observableB.getSnapshot()).toEqual('E')
    expect(A.join(', ')).toMatchInlineSnapshot(`"2, 3, 4, 5"`)
    expect(B.join(', ')).toMatchInlineSnapshot(`"B, C, D, E"`)
  })
})

describe('DisposedObservable', () => {
  let consoleMock: IConsoleMock
  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
  })
  afterEach(() => {
    consoleMock.restore()
  })

  test('do not unsubscribe', async () => {
    const observable = new DisposedObservable<number>(1)
    expect(observable.disposed).toEqual(true)

    const subscriber0 = new Subscriber('subscriber0', 0)
    expect(subscriber0.value).toEqual(0)

    observable.subscribe(subscriber0)

    expect(observable.getSnapshot()).toEqual(1)
    expect(subscriber0.value).toEqual(0)

    observable.next(2)
    expect(observable.getSnapshot()).toEqual(1)
    expect(subscriber0.value).toEqual(0)

    observable.dispose()

    observable.next(3)
    expect(observable.getSnapshot()).toEqual(1)
    expect(subscriber0.value).toEqual(0)

    const subscriber1 = new Subscriber('subscriber1', 0)
    observable.subscribe(subscriber1)

    observable.next(4)
    expect(observable.getSnapshot()).toEqual(1)
    expect(subscriber0.value).toEqual(0)
    expect(subscriber1.value).toEqual(0)

    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "[in test] called subscriber0.complete",
        ],
        [
          "[DisposedObservable] Don't update a disposed observable. value:",
          2,
        ],
        [
          "[DisposedObservable] Don't update a disposed observable. value:",
          3,
        ],
        [
          "[in test] called subscriber1.complete",
        ],
        [
          "[DisposedObservable] Don't update a disposed observable. value:",
          4,
        ],
      ]
    `)
  })

  test('unsubscribe', async () => {
    const observable = new DisposedObservable<number>(1)
    expect(observable.disposed).toEqual(true)

    const subscriber = new Subscriber('subscriber', 0)
    expect(subscriber.value).toEqual(0)

    const unsubscribable = observable.subscribe(subscriber)

    expect(observable.getSnapshot()).toEqual(1)
    expect(subscriber.value).toEqual(0)

    observable.next(2)
    expect(observable.getSnapshot()).toEqual(1)
    expect(subscriber.value).toEqual(0)

    unsubscribable.unsubscribe()

    observable.next(3)
    expect(observable.getSnapshot()).toEqual(1)
    expect(subscriber.value).toEqual(0)

    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "[in test] called subscriber.complete",
        ],
        [
          "[DisposedObservable] Don't update a disposed observable. value:",
          2,
        ],
        [
          "[DisposedObservable] Don't update a disposed observable. value:",
          3,
        ],
      ]
    `)
  })
})
