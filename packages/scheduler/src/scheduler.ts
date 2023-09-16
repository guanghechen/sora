import { ErrorLevelEnum, TaskStatusEnum, TaskStrategyEnum } from '@guanghechen/constant'
import { Monitor } from '@guanghechen/monitor'
import { delay } from '@guanghechen/shared'
import { ResumableTask } from '@guanghechen/task'
import type {
  IMonitor,
  IMonitorUnsubscribe,
  IPipeline,
  IPipelineProduct,
  IReporter,
  IScheduler,
  ITask,
} from '@guanghechen/types'
import type {} from '@guanghechen/shared'

type IParametersOfOnTaskTerminated = [codes: number[], status: TaskStatusEnum, error: unknown]

export interface ISequentialSchedulerProps<D, T extends ITask> {
  name: string
  pipeline: IPipeline<D, T>
  reporter: IReporter | undefined
  pollInterval?: number
  idleInterval?: number
}

export class Scheduler<D, T extends ITask> extends ResumableTask implements IScheduler<D> {
  protected readonly _idleInterval: number
  // don't try to unsubscribe all of the onTaskTerminated listeners
  protected readonly _monitorTaskTerminated: IMonitor<IParametersOfOnTaskTerminated>
  protected readonly _pipeline: IPipeline<D, T>
  protected readonly _reporter: IReporter | undefined
  protected _task: T | undefined

  constructor(props: ISequentialSchedulerProps<D, T>) {
    const { name, pipeline, reporter } = props
    const pollInterval: number = Math.max(0, Number(props.pollInterval) || 0)
    const idleInterval: number = Math.max(500, Number(props.idleInterval) || 0)

    super({ name, strategy: TaskStrategyEnum.CONTINUE_ON_ERROR, pollInterval })

    this._idleInterval = idleInterval
    this._monitorTaskTerminated = new Monitor<IParametersOfOnTaskTerminated>('onTaskTerminated')
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

  public schedule(data: D): Promise<number> {
    return this._pipeline.push(data)
  }

  public async waitTaskTerminated(code: number): Promise<void> {
    if (code < 0) return

    let unsubscribe: IMonitorUnsubscribe | undefined
    try {
      await new Promise<void>((resolve, reject) => {
        unsubscribe = this._monitorTaskTerminated.subscribe(
          (codes: number[], status: TaskStatusEnum, error: unknown) => {
            if (codes.includes(code)) {
              switch (status) {
                case TaskStatusEnum.FINISHED:
                  resolve()
                  break
                case TaskStatusEnum.FAILED:
                case TaskStatusEnum.CANCELLED:
                  reject(error)
                  break
                default:
                  reject(
                    error ??
                      `[Scheduler.waitTaskTerminated] ${this.name} Unknown status(${status}), code(${code})`,
                  )
              }
            }
          },
        )
      })
    } finally {
      unsubscribe?.()
    }
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
    while (pipeline.size > 0 || !pipeline.closed) yield this._pullAndRun()
    return
  }

  private async _pullAndRun(): Promise<void> {
    const material: IPipelineProduct<T> = await this._pipeline.pull()
    if (material.data === undefined || material.codes.length <= 0) return delay(this._idleInterval)

    const task = material.data
    this._task = task

    this._reporter?.verbose(
      '[{}] task({}) starting. codes: [{}]',
      this.name,
      task.name,
      material.codes.join(', '),
    )

    return new Promise<void>((resolve, reject) => {
      task.monitor({
        onStatusChange: status => {
          switch (status) {
            case TaskStatusEnum.FINISHED:
              this._reporter?.verbose(
                '[{}] task({}) finished. codes: {}.',
                this.name,
                task.name,
                material.codes.join(', '),
              )
              this._reporter?.debug(
                '[{}] task({}) finished. details: {}',
                this.name,
                task.name,
                material.data,
              )
              resolve()
              this._monitorTaskTerminated.notify(material.codes, status, task.error)
              break
            case TaskStatusEnum.FAILED:
              this._reporter?.verbose(
                '[{}] task({}) failed. codes: {}.',
                this.name,
                task.name,
                material.codes.join(', '),
              )
              this._reporter?.debug(
                '[{}] task({}) failed. details: {}',
                this.name,
                task.name,
                material.data,
              )
              reject(task.error)
              this._monitorTaskTerminated.notify(material.codes, status, task.error)
              break
            case TaskStatusEnum.CANCELLED:
              this._reporter?.verbose(
                '[{}] task({}) cancelled. codes: {}.',
                this.name,
                task.name,
                material.codes.join(', '),
              )
              this._reporter?.debug(
                '[{}] task({}) cancelled. details: {}',
                this.name,
                task.name,
                material.data,
              )
              resolve()
              this._monitorTaskTerminated.notify(material.codes, status, task.error)
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
}
