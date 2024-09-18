import type { IPipelineStatus } from '../../src'
import { PipelineStatus, PipelineStatusEnum } from '../../src'

class LocalPipelineStatus extends PipelineStatus {
  constructor(value: PipelineStatusEnum) {
    super()
    this._value = value
  }
}

export class PipelineStatusTester {
  public readonly from: PipelineStatusEnum
  protected readonly _cases: Array<() => void>
  protected _status: IPipelineStatus

  constructor(from: PipelineStatusEnum) {
    this.from = from
    this._cases = []
    this._status = new PipelineStatus()
  }

  public buildTest(): void {
    const fromName: string = PipelineStatusEnum[this.from]
    describe(fromName, () => {
      beforeEach(() => {
        this._status = new LocalPipelineStatus(this.from)
      })

      afterEach(() => {
        this._status.dispose()
      })

      for (const kase of this._cases) kase()
    })
  }

  public testTransitions(...transitions: Array<[result: 0 | 1, to: PipelineStatusEnum]>): this {
    for (const [result, to] of transitions) this.testTransition(result, to)
    return this
  }

  public testTransition(result: 0 | 1, to: PipelineStatusEnum): this {
    const from: PipelineStatusEnum = this.from
    const fromName: string = PipelineStatusEnum[from]
    const toName: string = PipelineStatusEnum[to]

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

  public testClose(alive: boolean): this {
    const from: PipelineStatusEnum = this.from
    const fromName: string = PipelineStatusEnum[from]

    this._cases.push(() => {
      it(`${fromName}.closed`, () => {
        expect(this._status.closed).toEqual(alive)
      })

      it(`${fromName}.dispose`, () => {
        this._status.dispose()
        expect(this._status.disposed).toEqual(true)
        expect(this._status.closed).toEqual(true)
      })
    })
    return this
  }
}
