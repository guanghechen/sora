import type { ISoraError } from '@guanghechen/types'
import { ErrorLevelEnum } from '@guanghechen/types'
import { TaskStatusEnum, TaskStrategyEnum } from './constant'
import { TaskStatus } from './status'
import type { ITask, ITaskStatus } from './types'

export abstract class ResumableTask implements ITask {
  public readonly name: string
  public readonly status: ITaskStatus
  public readonly strategy: TaskStrategyEnum
  protected readonly _errors: unknown[]
  private readonly _pollInterval: number
  private _execution: IterableIterator<Promise<void>> | undefined
  private _step: Promise<void> | undefined

  constructor(name: string, strategy: TaskStrategyEnum, pollInterval: number) {
    this.name = name
    this.strategy = strategy
    this.status = new TaskStatus()
    this._errors = []
    this._pollInterval = Math.max(0, pollInterval)
    this._execution = undefined
    this._step = undefined
  }

  public get errors(): ReadonlyArray<unknown> {
    return this._errors
  }

  public async start(): Promise<void> {
    if (this.status.getSnapshot() === TaskStatusEnum.PENDING) {
      this.status.next(TaskStatusEnum.RUNNING)
      this._execution = this.run()
      void this._launchStep()
    }
  }

  public async pause(): Promise<void> {
    if (this.status.getSnapshot() === TaskStatusEnum.RUNNING) {
      this.status.next(TaskStatusEnum.ATTEMPT_SUSPENDING)
      await this._step
      this.status.next(TaskStatusEnum.SUSPENDED, { strict: false })
    }
  }

  public async resume(): Promise<void> {
    if (this.status.getSnapshot() === TaskStatusEnum.SUSPENDED) {
      this.status.next(TaskStatusEnum.ATTEMPT_RESUMING)
      await this._step
      if (this.status.getSnapshot() === TaskStatusEnum.ATTEMPT_RESUMING) {
        this.status.next(TaskStatusEnum.RUNNING)
        void this._queueStep()
      }
    }
  }

  public async cancel(): Promise<void> {
    if (this.status.terminated) return
    this.status.next(TaskStatusEnum.ATTEMPT_CANCELING)
    await this._step
    this.status.next(TaskStatusEnum.CANCELLED, { strict: false })
  }

  public async complete(): Promise<void> {
    const status: ITaskStatus = this.status
    if (status.getSnapshot() === TaskStatusEnum.PENDING) await this.start()
    if (status.terminated) return

    status.next(TaskStatusEnum.ATTEMPT_COMPLETING)

    // Waiting current step to complete.
    await this._step

    // Execute until the task is terminated.
    const execution: IterableIterator<Promise<void>> = this._execution!

    for (let alive = true; alive; ) {
      const step = execution.next()
      if (step.done) {
        const nextStatus: TaskStatusEnum =
          this._errors.length > 0 ? TaskStatusEnum.FAILED : TaskStatusEnum.COMPLETED
        status.next(nextStatus, { strict: false })
        break
      }

      try {
        await step.value
      } catch (error) {
        const soraError: ISoraError = {
          from: this.name,
          level: ErrorLevelEnum.ERROR,
          details: error,
        }
        this._errors.push(soraError)
        switch (this.strategy) {
          case TaskStrategyEnum.ABORT_ON_ERROR:
            status.next(TaskStatusEnum.FAILED, { strict: false })
            alive = false
            break
          case TaskStrategyEnum.CONTINUE_ON_ERROR:
            await this._queueStep()
            break
        }
      }
    }

    /* c8 ignore start */
    if (status.alive) {
      const soraError: ISoraError = {
        from: this.name,
        level: ErrorLevelEnum.ERROR,
        details: new RangeError('The task is not terminated.'),
      }
      this._errors.push(soraError)
    }
    /* c8 ignore stop */
  }

  protected abstract run(): IterableIterator<Promise<void>>

  private async _launchStep(): Promise<void> {
    /* c8 ignore start */
    if (this._execution === undefined) return
    if (this._step !== undefined) return
    /* c8 ignore stop */
    if (this.status.getSnapshot() !== TaskStatusEnum.RUNNING) return

    const execution: IterableIterator<Promise<void>> = this._execution
    const step = execution.next()
    if (step.done) {
      this.status.next(this._errors.length > 0 ? TaskStatusEnum.FAILED : TaskStatusEnum.COMPLETED, {
        strict: false,
      })
      return
    }

    this._step = step.value
    try {
      await step.value
      this._step = undefined
      void this._queueStep()
    } catch (error) {
      this._step = undefined
      const soraError: ISoraError = {
        from: this.name,
        level: ErrorLevelEnum.ERROR,
        details: error,
      }
      this._errors.push(soraError)
      switch (this.strategy) {
        case TaskStrategyEnum.ABORT_ON_ERROR:
          this.status.next(TaskStatusEnum.FAILED, { strict: false })
          break
        case TaskStrategyEnum.CONTINUE_ON_ERROR:
          void this._queueStep()
          break
      }
    }
  }

  private async _queueStep(): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, this._pollInterval))
    await this._launchStep()
  }
}
