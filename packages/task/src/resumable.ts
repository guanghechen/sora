import { TaskStatusEnum, TaskStrategyEnum } from '@guanghechen/constant'
import type { ITask } from '@guanghechen/types'
import { TaskState } from './state'

interface IResumableTaskProps {
  name: string
  strategy: TaskStrategyEnum
  pollInterval: number
}

export abstract class ResumableTask extends TaskState implements ITask {
  public readonly strategy: TaskStrategyEnum
  private readonly _pollInterval: number
  private _execution: IterableIterator<Promise<void>> | undefined
  private _step: Promise<void> | undefined

  constructor(props: IResumableTaskProps) {
    super(props.name)
    this.strategy = props.strategy
    this._pollInterval = Math.max(0, props.pollInterval)
    this._execution = undefined
    this._step = undefined
  }

  public async start(): Promise<void> {
    if (this.status === TaskStatusEnum.PENDING) {
      this.status = TaskStatusEnum.RUNNING

      this._execution = this.run()
      this.launchStep()
      await this._step
    }
  }

  public async pause(): Promise<void> {
    if (this.status === TaskStatusEnum.RUNNING) {
      this.status = TaskStatusEnum.ATTEMPT_SUSPENDING

      await this._step

      if (this.status === TaskStatusEnum.ATTEMPT_SUSPENDING) {
        this.status = TaskStatusEnum.SUSPENDED
      }
    }
  }

  public async resume(): Promise<void> {
    if (this.status === TaskStatusEnum.SUSPENDED) {
      this.status = TaskStatusEnum.ATTEMPT_RESUMING

      await this._step

      if (this.status === TaskStatusEnum.ATTEMPT_RESUMING) {
        this.status = TaskStatusEnum.RUNNING
        this.queueStep()
      }
    }
  }

  public async cancel(): Promise<void> {
    if (this.alive) {
      this.status = TaskStatusEnum.ATTEMPT_CANCELING

      await this._step

      if (this.status === TaskStatusEnum.ATTEMPT_CANCELING) {
        this.status = TaskStatusEnum.CANCELLED
      }
    }
  }

  public async finish(): Promise<void> {
    if (this.status === TaskStatusEnum.PENDING) await this.start()
    if (this.alive) {
      this.status = TaskStatusEnum.ATTEMPT_FINISHING

      // Waiting current step terminated.
      await this._step

      // Execute until done.
      const execution = this._execution
      if (execution) {
        while (this.status === TaskStatusEnum.ATTEMPT_FINISHING) {
          const step = execution.next()
          if (step.done) {
            this.status = this.hasError ? TaskStatusEnum.FAILED : TaskStatusEnum.FINISHED // Finished.
            break
          }

          await step.value.catch(error => {
            this._addError('ResumableTaskError', error)
            switch (this.strategy) {
              case TaskStrategyEnum.ABORT_ON_ERROR:
                if (!this.terminated) this.status = TaskStatusEnum.FAILED
                break
              case TaskStrategyEnum.CONTINUE_ON_ERROR:
                break
            }
          })
        }
      }
    }
  }

  protected abstract run(): IterableIterator<Promise<void>>

  private launchStep(): void {
    if (this.status === TaskStatusEnum.RUNNING && this._step === undefined && this._execution) {
      const step = this._execution.next()
      if (step.done) {
        this.status = this.hasError ? TaskStatusEnum.FAILED : TaskStatusEnum.FINISHED // Finished.
        return
      }

      this._step = step.value
        .then(() => {
          this._step = undefined
          this.queueStep()
        })
        .catch(error => {
          this._step = undefined
          this._addError('ResumableTaskError', error)
          switch (this.strategy) {
            case TaskStrategyEnum.ABORT_ON_ERROR:
              if (!this.terminated) this.status = TaskStatusEnum.FAILED
              break
            case TaskStrategyEnum.CONTINUE_ON_ERROR:
              this.queueStep()
              break
          }
        })
    }
  }

  private queueStep(): void {
    setTimeout(() => this.launchStep(), this._pollInterval)
  }
}
