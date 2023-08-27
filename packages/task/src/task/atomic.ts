import { TaskStatus } from '../constant'
import { TaskState } from '../state'
import type { ITask } from '../types'

export abstract class AtomicTask extends TaskState implements ITask {
  private _promise: Promise<void> | undefined

  constructor(name: string) {
    super(name)
    this._promise = undefined
  }

  public async start(): Promise<void> {
    if (this.status === TaskStatus.PENDING) {
      this.status = TaskStatus.RUNNING

      this._promise = this.run()
        .then(() => {
          this.status = TaskStatus.FINISHED
        })
        .catch(error => {
          this.status = TaskStatus.FAILED
          this._addError('AtomicTaskError', error)
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
    if (this.status === TaskStatus.PENDING) {
      this.status = TaskStatus.ATTEMPT_CANCELING
      this.status = TaskStatus.CANCELLED
      return
    }

    if (this.alive) this.status = TaskStatus.ATTEMPT_CANCELING
    await this._promise
  }

  public async finish(): Promise<void> {
    if (this.status === TaskStatus.PENDING) await this.start()
    if (this.alive) this.status = TaskStatus.ATTEMPT_FINISHING
    await this._promise
  }

  protected abstract run(): Promise<void>
}
