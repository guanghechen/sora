import type { ITask } from '@guanghechen/task.types'
import { TaskStatusEnum } from '@guanghechen/task.types'
import { TaskState } from './state'

export abstract class AtomicTask extends TaskState implements ITask {
  private _promise: Promise<void> | undefined

  constructor(name: string) {
    super(name)
    this._promise = undefined
  }

  public async start(): Promise<void> {
    if (this.status === TaskStatusEnum.PENDING) {
      this.status = TaskStatusEnum.RUNNING

      this._promise = this.run()
        .then(() => {
          this.status = TaskStatusEnum.FINISHED
        })
        .catch(error => {
          // addError should execute before change status,
          // so the onStateChanged callback can access the error.
          this._addError('AtomicTaskError', error)
          this.status = TaskStatusEnum.FAILED
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
    if (this.status === TaskStatusEnum.PENDING) {
      this.status = TaskStatusEnum.ATTEMPT_CANCELING
      this.status = TaskStatusEnum.CANCELLED
      return
    }

    if (this.alive) this.status = TaskStatusEnum.ATTEMPT_CANCELING
    await this._promise
  }

  public async finish(): Promise<void> {
    if (this.status === TaskStatusEnum.PENDING) await this.start()
    if (this.alive) this.status = TaskStatusEnum.ATTEMPT_FINISHING
    await this._promise
  }

  protected abstract run(): Promise<void>
}
