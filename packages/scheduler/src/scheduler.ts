import { ErrorLevelEnum, type ISoraError } from '@guanghechen/error.types'
import { Subscriber } from '@guanghechen/observable'
import type { ISubscriber } from '@guanghechen/observable'
import type { IReporter } from '@guanghechen/reporter.types'
import type { ITask, TaskStrategyEnum } from '@guanghechen/task'
import { ResumableTask, TaskStatusEnum } from '@guanghechen/task'
import { PipelineStatusEnum } from './constant'
import type { IPipeline } from './types/pipeline'
import type { IScheduler } from './types/scheduler'

const delay = (duration: number): Promise<void> =>
  new Promise<void>(resolve => setTimeout(resolve, duration))

interface IProps<D, T extends ITask> {
  readonly name: string
  readonly pipeline: IPipeline<D, T>
  readonly strategy: TaskStrategyEnum
  readonly reporter: IReporter | undefined
  readonly pollInterval?: number
  readonly idleInterval?: number
}

export class Scheduler<D, T extends ITask> extends ResumableTask implements IScheduler<D> {
  protected readonly _idleInterval: number
  protected readonly _pipeline: IPipeline<D, T>
  protected readonly _reporter: IReporter | undefined
  protected _task: ITask | undefined
  protected _lastScheduledMaterialCode: number

  constructor(props: IProps<D, T>) {
    const { name, pipeline, reporter, strategy } = props
    const pollInterval: number = Math.max(0, Number(props.pollInterval) || 0)
    const idleInterval: number = Math.max(500, Number(props.idleInterval) || 0)
    super(name, strategy, pollInterval)

    this._idleInterval = idleInterval
    this._pipeline = pipeline
    this._reporter = reporter
    this._task = undefined
    this._lastScheduledMaterialCode = -1

    const schedulerStatusSubscriber: ISubscriber<TaskStatusEnum> = new Subscriber({
      onNext: nextStatus => {
        const task: ITask | undefined = this._task
        if (task) {
          switch (nextStatus) {
            case TaskStatusEnum.ATTEMPT_SUSPENDING:
            case TaskStatusEnum.SUSPENDED:
              void task.pause()
              break
            case TaskStatusEnum.ATTEMPT_RESUMING:
            case TaskStatusEnum.RUNNING:
              void task.resume()
              break
            case TaskStatusEnum.ATTEMPT_CANCELING:
            case TaskStatusEnum.CANCELLED:
            case TaskStatusEnum.FAILED:
              void task.cancel()
              break
            case TaskStatusEnum.ATTEMPT_COMPLETING:
            case TaskStatusEnum.COMPLETED:
              void task.complete()
              break
          }
        }
      },
    })
    this.status.subscribe(schedulerStatusSubscriber)
  }

  public async schedule(data: D): Promise<number> {
    const code = await this._pipeline.push(data)
    if (code > this._lastScheduledMaterialCode) this._lastScheduledMaterialCode = code
    return code
  }

  public waitTaskTerminated(code: number): Promise<void> {
    return this._pipeline.waitMaterialHandled(code)
  }

  public waitAllScheduledTasksTerminated(): Promise<void> {
    return this._pipeline.waitAllMaterialsHandledAt(this._lastScheduledMaterialCode)
  }

  public override complete(): Promise<void> {
    const pipeline: IPipeline<D, T> = this._pipeline
    if (!pipeline.status.closed) {
      const soraError: ISoraError = {
        from: this.name,
        level: ErrorLevelEnum.ERROR,
        details: `[Scheduler] ${this.name}: pipeline is not closed, the finish won't be terminated`,
      }
      this._errors.push(soraError)
    }
    return super.complete()
  }

  protected override *run(): IterableIterator<Promise<void>> {
    const pipeline: IPipeline<D, T> = this._pipeline
    while (!pipeline.status.closed) {
      while (pipeline.size > 0) yield this._pullAndRun()

      // Waiting the pipeline to be idle.
      yield new Promise<void>(resolve => {
        const subscriber: ISubscriber<PipelineStatusEnum> = new Subscriber<PipelineStatusEnum>({
          onNext: nextStatus => {
            if (nextStatus !== PipelineStatusEnum.DRIED) {
              resolve()
              unsubscribe.unsubscribe()
            }
          },
        })
        const unsubscribe = pipeline.status.subscribe(subscriber)
      })
    }
    while (pipeline.size > 0) yield this._pullAndRun()
  }

  private async _pullAndRun(): Promise<void> {
    if (this._task !== undefined && !this._task.status.terminated) {
      await this._task.complete()
      this._task = undefined
    }

    const pipeline: IPipeline<D, T> = this._pipeline
    const { codes, data: task } = await pipeline.pull()
    if (task === null || codes.length <= 0) return delay(this._idleInterval)

    const reporter: IReporter | undefined = this._reporter
    reporter?.verbose('[{}] task({}) starting. codes: [{}]', this.name, task.name, codes.join(', '))

    this._task = task
    await task.start()

    await new Promise<void>((resolve, reject) => {
      const subscriber: ISubscriber<TaskStatusEnum> = new Subscriber<TaskStatusEnum>({
        onNext: status => {
          switch (status) {
            case TaskStatusEnum.COMPLETED:
              reporter?.verbose(
                '[{}] task({}) finished. codes: {}.',
                this.name,
                task.name,
                codes.join(', '),
              )
              unsubscribable.unsubscribe()
              resolve()
              break
            case TaskStatusEnum.FAILED:
              reporter?.verbose(
                '[{}] task({}) failed. codes: {}.',
                this.name,
                task.name,
                codes.join(', '),
              )
              unsubscribable.unsubscribe()
              reject(task.errors)
              break
            case TaskStatusEnum.CANCELLED:
              reporter?.verbose(
                '[{}] task({}) cancelled. codes: {}.',
                this.name,
                task.name,
                codes.join(', '),
              )
              unsubscribable.unsubscribe()
              resolve()
              break
            default:
          }
        },
      })
      const unsubscribable = task.status.subscribe(subscriber)
    }).finally(() => {
      this._task = undefined
      pipeline.notifyMaterialHandled(codes)
    })
  }
}
