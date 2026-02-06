import type { ISoraError } from '@guanghechen/types'
import { ErrorLevelEnum } from '@guanghechen/types'
import type { TaskStrategyEnum } from './constant'
import { TaskStatusEnum } from './constant'
import { TaskStatus } from './status'
import type { ITask, ITaskStatus } from './types'

export abstract class AtomicTask implements ITask {
  public readonly name: string
  public readonly status: ITaskStatus
  public readonly strategy: TaskStrategyEnum
  protected readonly _errors: unknown[]
  private _promise: Promise<void> | undefined

  constructor(name: string, strategy: TaskStrategyEnum) {
    this.name = name
    this.strategy = strategy
    this.status = new TaskStatus()
    this._errors = []
    this._promise = undefined
  }

  public get errors(): ReadonlyArray<unknown> {
    return this._errors
  }

  public async start(): Promise<void> {
    if (this.status.getSnapshot() === TaskStatusEnum.PENDING) {
      this.status.next(TaskStatusEnum.RUNNING)
      this._promise = this.run()
        .then(() => {
          this.status.next(TaskStatusEnum.COMPLETED, { strict: false })
        })
        .catch(error => {
          const soraError: ISoraError = {
            from: this.name,
            level: ErrorLevelEnum.ERROR,
            details: error,
          }
          this._errors.push(soraError)
          this.status.next(TaskStatusEnum.FAILED, { strict: false })
        })
    }
    return this._promise
  }

  public async pause(): Promise<void> {
    await this._promise
  }

  public async resume(): Promise<void> {
    await this._promise
  }

  public async cancel(): Promise<void> {
    if (this.status.terminated) return
    this.status.next(TaskStatusEnum.ATTEMPT_CANCELING)
    await this._promise
    this.status.next(TaskStatusEnum.CANCELLED, { strict: false })
  }

  public async complete(): Promise<void> {
    const status: ITaskStatus = this.status
    if (status.getSnapshot() === TaskStatusEnum.PENDING) await this.start()
    if (status.terminated) return

    status.next(TaskStatusEnum.ATTEMPT_COMPLETING)
    await this._promise
    status.next(TaskStatusEnum.COMPLETED, { strict: false })
  }

  protected abstract run(): Promise<void>
}
