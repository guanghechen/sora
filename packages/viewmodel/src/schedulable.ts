import { ScheduleTransactionStatus } from './types'
import type { ISchedulable, IScheduleTransaction } from './types'

export class Schedulable implements ISchedulable {
  protected _scheduled: boolean
  protected _run: () => void

  constructor(run: () => void) {
    this._scheduled = false
    this._run = run
  }

  public get scheduled(): boolean {
    return this._scheduled
  }

  public schedule(): void {
    if (this._scheduled) return
    this._scheduled = true
    this._run()
  }
}

export class SchedulableTransaction implements IScheduleTransaction {
  protected _status: ScheduleTransactionStatus
  protected readonly _schedulables: ISchedulable[]
  protected _scheduledIndex: number

  constructor() {
    this._status = ScheduleTransactionStatus.NOT_STARTED
    this._schedulables = []
    this._scheduledIndex = 0
  }

  public get status(): ScheduleTransactionStatus {
    return this._status
  }

  public step(task: ISchedulable): void {
    if (task.scheduled) return

    if (this._status !== ScheduleTransactionStatus.STARTED) {
      console.warn('[Transaction.step] bad status:', this._status)
      task.schedule()
      return
    }

    this._status = ScheduleTransactionStatus.STARTED
    this._schedulables.push(task)
  }

  public start(): void {
    if (this._status !== ScheduleTransactionStatus.NOT_STARTED) {
      console.warn('[Transaction.start] bad status:', this._status)
      return
    }
    this._status = ScheduleTransactionStatus.STARTED
  }

  public flush(): void {
    if (this._status !== ScheduleTransactionStatus.NOT_STARTED) {
      console.warn('[Transaction.flush] bad status:', this._status)
      return
    }
    this._flushWithoutCheck()
  }

  public end(): void {
    if (this._status !== ScheduleTransactionStatus.STARTED) {
      console.warn('[Transaction.end] bad status:', this._status)
      return
    }

    this._status = ScheduleTransactionStatus.COMPLETED
    this._flushWithoutCheck()
    this._schedulables.length = 0
    this._scheduledIndex = 0
  }

  protected _flushWithoutCheck(): void {
    const start: number = this._scheduledIndex
    const end: number = this._schedulables.length
    this._scheduledIndex = end
    for (let i = start; i < end; ++i) {
      const schedulable = this._schedulables[i]
      if (schedulable.scheduled) continue
      schedulable.schedule()
    }
  }
}
