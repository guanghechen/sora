import { ErrorLevelEnum, TaskStatusEnum, TaskStrategyEnum } from '@guanghechen/constant'
import { delay } from '@guanghechen/shared'
import { ResumableTask } from '@guanghechen/task'
import type { IPipeline, IReporter, IScheduler, ITask } from '@guanghechen/types'
import type {} from '@guanghechen/shared'

export interface ISequentialSchedulerProps<D, T extends ITask> {
  name: string
  pipeline: IPipeline<D, T>
  reporter?: IReporter
  pollInterval?: number
  idleInterval?: number
}

export class Scheduler<D, T extends ITask> extends ResumableTask implements IScheduler<D> {
  protected readonly _idleInterval: number
  protected readonly _pipeline: IPipeline<D, T>
  protected readonly _reporter: IReporter | undefined
  protected _task: T | undefined

  constructor(props: ISequentialSchedulerProps<D, T>) {
    const { name, pipeline, reporter } = props
    const pollInterval: number = Math.max(0, Number(props.pollInterval) || 0)
    const idleInterval: number = Math.max(500, Number(props.idleInterval) || 0)

    super({ name, strategy: TaskStrategyEnum.CONTINUE_ON_ERROR, pollInterval })

    this._idleInterval = idleInterval
    this._pipeline = pipeline
    this._reporter = reporter
    this._task = undefined

    this.monitor({
      onStatusChange: newStatus => {
        const task: T | undefined = this._task
        if (task) {
          switch (newStatus) {
            case TaskStatusEnum.ATTEMPT_SUSPENDING:
              void task.pause()
              break
            case TaskStatusEnum.ATTEMPT_RESUMING:
              void task.resume()
              break
            case TaskStatusEnum.ATTEMPT_CANCELING:
              void task.cancel()
              break
            case TaskStatusEnum.ATTEMPT_FINISHING:
              void task.finish()
              break
          }
        }
      },
    })
  }

  public schedule(data: D): void {
    this._pipeline.push(data)
  }

  public override finish(): Promise<void> {
    if (!this._pipeline.closed) {
      this._addError(
        'SchedulerError',
        `[Scheduler] ${this.name}: pipeline is not closed, the finish won't be terminated`,
        ErrorLevelEnum.WARN,
      )
    }
    return super.finish()
  }

  protected override *run(): IterableIterator<Promise<void>> {
    const pipeline: IPipeline<D, T> = this._pipeline

    for (;;) {
      let top: T | undefined = undefined
      while (top === undefined && pipeline.size > 0) {
        top = pipeline.pull()
      }

      if (top === undefined) {
        if (pipeline.closed) break

        yield delay(this._idleInterval)
        continue
      }

      const task: T = top
      this._task = task
      yield new Promise<void>((resolve, reject) => {
        task.monitor({
          onStatusChange: status => {
            switch (status) {
              case TaskStatusEnum.FINISHED:
                resolve()
                break
              case TaskStatusEnum.FAILED:
                reject(task.error)
                break
              case TaskStatusEnum.CANCELLED:
                resolve()
                break
              default:
            }
          },
        })
        void task.start()
      }).finally(() => {
        task.cleanup()
        this._task = undefined
      })
    }
    return
  }
}
