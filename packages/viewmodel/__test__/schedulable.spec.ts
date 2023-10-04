import type { IConsoleMock } from '@guanghechen/helper-jest'
import { createConsoleMock } from '@guanghechen/helper-jest'
import { Schedulable, SchedulableTransaction, ScheduleTransactionStatus } from '../src'
import { delay } from './_common'

describe('Schedulable', () => {
  let consoleMock: IConsoleMock
  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
  })
  afterEach(() => {
    consoleMock.restore()
  })

  test('transaction', async () => {
    const transaction = new SchedulableTransaction()
    const answers: number[] = []
    const step1 = new Schedulable(() => answers.push(1))
    const step2 = new Schedulable(() => answers.push(2))
    const step3 = new Schedulable(() => answers.push(3))

    expect(answers).toEqual([])
    transaction.start()

    expect(answers).toEqual([])
    transaction.step(step1)
    expect(answers).toEqual([])
    transaction.step(step2)
    expect(answers).toEqual([])
    transaction.step(step3)

    await delay(100)
    expect(answers).toEqual([])

    transaction.end()
    expect(answers).toEqual([1, 2, 3])
  })

  test('edge case', async () => {
    const transaction = new SchedulableTransaction()
    const answers: number[] = []
    const step1 = new Schedulable(() => answers.push(1))
    const step2 = new Schedulable(() => answers.push(2))
    const step3 = new Schedulable(() => answers.push(3))

    transaction.end()
    expect(transaction.status).toEqual(ScheduleTransactionStatus.NOT_STARTED)
    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "[Transaction.end] bad status:",
          0,
        ],
      ]
    `)

    transaction.step(step1)
    expect(transaction.status).toEqual(ScheduleTransactionStatus.NOT_STARTED)
    expect(answers).toEqual([1])
    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "[Transaction.end] bad status:",
          0,
        ],
        [
          "[Transaction.step] bad status:",
          0,
        ],
      ]
    `)

    transaction.start()
    expect(transaction.status).toEqual(ScheduleTransactionStatus.STARTED)
    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "[Transaction.end] bad status:",
          0,
        ],
        [
          "[Transaction.step] bad status:",
          0,
        ],
      ]
    `)

    transaction.start()
    expect(transaction.status).toEqual(ScheduleTransactionStatus.STARTED)
    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "[Transaction.end] bad status:",
          0,
        ],
        [
          "[Transaction.step] bad status:",
          0,
        ],
        [
          "[Transaction.start] bad status:",
          1,
        ],
      ]
    `)

    expect(answers).toEqual([1])
    transaction.step(step1)
    expect(answers).toEqual([1])
    transaction.step(step2)
    expect(answers).toEqual([1])
    transaction.step(step3)

    transaction.end()
    expect(transaction.status).toEqual(ScheduleTransactionStatus.COMPLETED)
    expect(answers).toEqual([1, 2, 3])

    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "[Transaction.end] bad status:",
          0,
        ],
        [
          "[Transaction.step] bad status:",
          0,
        ],
        [
          "[Transaction.start] bad status:",
          1,
        ],
      ]
    `)

    step1.schedule()
    expect(answers).toEqual([1, 2, 3])

    step2.schedule()
    expect(answers).toEqual([1, 2, 3])

    step3.schedule()
    expect(answers).toEqual([1, 2, 3])
  })
})
