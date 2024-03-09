import type { ITaskStatus } from '../../src'
import { TaskStatus, TaskStatusEnum } from '../../src'

class LocalTaskStatus extends TaskStatus {
  constructor(value: TaskStatusEnum) {
    super()
    this._value = value
  }
}

export class TaskStatusTester {
  public readonly from: TaskStatusEnum
  protected readonly _cases: Array<() => void>
  protected _status: ITaskStatus

  constructor(from: TaskStatusEnum) {
    this.from = from
    this._cases = []
    this._status = new TaskStatus()
  }

  public buildTest(): void {
    const fromName: string = TaskStatusEnum[this.from]
    // eslint-disable-next-line jest/valid-title
    describe(fromName, () => {
      beforeEach(() => {
        this._status = new LocalTaskStatus(this.from)
      })

      afterEach(() => {
        this._status.dispose()
      })

      for (const kase of this._cases) kase()
    })
  }

  public testTransitions(...transitions: Array<[result: 0 | 1, to: TaskStatusEnum]>): this {
    for (const [result, to] of transitions) this.testTransition(result, to)
    return this
  }

  public testTransition(result: 0 | 1, to: TaskStatusEnum): this {
    const from: TaskStatusEnum = this.from
    const fromName: string = TaskStatusEnum[from]
    const toName: string = TaskStatusEnum[to]

    this._cases.push(() => {
      it(`${fromName} -> ${toName}`, () => {
        expect(this._status.getSnapshot()).toEqual(from)
        expect(this._status.disposed).toEqual(false)

        if (result === 0) {
          expect(() => this._status.next(to)).toThrow(
            `Invalid status transition: ${fromName} -> ${toName}.`,
          )
          expect(() => this._status.next(to, { strict: false })).not.toThrow()
          expect(this._status.getSnapshot()).toEqual(from)
        } else {
          expect(() => this._status.next(to)).not.toThrow()
        }
      })
    })
    return this
  }

  public testAlive(alive: boolean): this {
    const from: TaskStatusEnum = this.from
    const fromName: string = TaskStatusEnum[from]

    this._cases.push(() => {
      it(`${fromName}.alive`, () => {
        expect(this._status.alive).toEqual(alive)
      })
    })
    return this
  }

  public testTerminated(terminated: boolean): this {
    const from: TaskStatusEnum = this.from
    const fromName: string = TaskStatusEnum[from]

    this._cases.push(() => {
      it(`${fromName}.terminated`, () => {
        expect(this._status.terminated).toEqual(terminated)
      })
    })
    return this
  }
}
