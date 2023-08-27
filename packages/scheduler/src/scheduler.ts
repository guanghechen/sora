import type { IPipeline } from '@guanghechen/pipeline'
import type { ITask } from '@guanghechen/task'
import { ResumableTask, TaskStatus, TaskStrategy } from '@guanghechen/task'
import type { IReporter, IScheduler } from './types'

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

    super({ name, strategy: TaskStrategy.CONTINUE_ON_ERROR, pollInterval })

    this._idleInterval = idleInterval
    this._pipeline = pipeline
    this._reporter = reporter
    this._task = undefined

    this.monitor({
      onStatusChange: newStatus => {
        const task: T | undefined = this._task
        if (task) {
          switch (newStatus) {
            case TaskStatus.ATTEMPT_SUSPENDING:
              void task.pause()
              break
            case TaskStatus.ATTEMPT_RESUMING:
              void task.resume()
              break
            case TaskStatus.ATTEMPT_CANCELING:
              void task.cancel()
              break
            case TaskStatus.ATTEMPT_FINISHING:
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
      console.warn(
        `[Scheduler] ${this.name}: pipeline is not closed, the finish won't be terminated`,
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

        yield new Promise<void>(resolve => setTimeout(resolve, this._idleInterval))
        continue
      }

      const task: T = top
      this._task = task
      yield new Promise<void>((resolve, reject) => {
        task.monitor({
          onStatusChange: status => {
            switch (status) {
              case TaskStatus.FINISHED:
                resolve()
                break
              case TaskStatus.FAILED:
                reject(task.error)
                break
              case TaskStatus.CANCELLED:
                resolve()
                break
              default:
            }
          },
        })
        void task.start()
      }).finally(() => {
        this._task = undefined
      })
    }
    return
  }
}
