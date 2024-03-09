import { ErrorLevelEnum, type ISoraError } from '@guanghechen/error.types'
import { Subscriber } from '@guanghechen/observable'
import type { ISubscriber, IUnsubscribable } from '@guanghechen/observable'
import type { IReporter } from '@guanghechen/reporter.types'
import type { ITask, ITaskStatus } from '@guanghechen/task'
import { ResumableTask, TaskStatusEnum, TaskStrategyEnum } from '@guanghechen/task'
import { PipelineStatusEnum } from './constant'
import type { IProductConsumer, IProductConsumerApi, IProductConsumerNext } from './types/consumer'
import type { IPipeline } from './types/pipeline'
import type { IScheduler } from './types/scheduler'

const delay = (duration: number): Promise<void> =>
  new Promise<void>(resolve => setTimeout(resolve, duration))

interface IProps<D, T> {
  readonly name: string
  readonly pipeline: IPipeline<D, T>
  readonly strategy: TaskStrategyEnum
  readonly idleInterval?: number
  readonly pollInterval?: number
  readonly reporter?: IReporter
}

export class Scheduler<D, T> extends ResumableTask implements IScheduler<D, T> {
  protected readonly _consumers: Array<IProductConsumer<T, ITask>>
  protected readonly _consumerApi: IProductConsumerApi
  protected readonly _idleInterval: number
  protected readonly _pipeline: IPipeline<D, T>
  protected readonly _reporter: IReporter | undefined
  protected _task: ITask | undefined
  protected _lastScheduledMaterialCode: number

  constructor(props: IProps<D, T>) {
    const { name, pipeline, reporter, strategy } = props
    const idleInterval: number = Math.max(0, Number(props.idleInterval) || 300)
    const pollInterval: number = Math.max(0, Number(props.pollInterval) || 0)
    super(name, strategy, pollInterval)

    const consumers: Array<IProductConsumer<T, ITask>> = []
    const consumerApi: IProductConsumerApi = {}

    this._consumers = consumers
    this._consumerApi = consumerApi
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

  public use(consumer: IProductConsumer<T, ITask>): void {
    this._consumers.push(consumer)
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
    const { codes, data } = await pipeline.pull()
    if (data === null || codes.length <= 0) return delay(this._idleInterval)

    const api: IProductConsumerApi = this._consumerApi
    const reducer: IProductConsumerNext<ITask> = this._consumers.reduceRight<
      IProductConsumerNext<ITask>
    >(
      (next, consumer) => embryo => consumer.consume(data, embryo, api, next),
      async embryo => embryo,
    )
    const task: ITask | null = await reducer(null)
    if (task === null) return delay(this._idleInterval)

    const reporter: IReporter | undefined = this._reporter
    reporter?.verbose('[{}] task({}) starting. codes: [{}]', this.name, task.name, codes.join(', '))

    this._task = task
    void task.start()

    let notified: boolean = false
    const onTerminated = (
      status: ITaskStatus,
      unsubscribable: IUnsubscribable,
      resolve: () => void,
      reject: (error: unknown) => void,
    ): void => {
      if (notified) return

      if (status.terminated) {
        reporter?.verbose(
          '[{}] task({}) {}. codes: {}.',
          this.name,
          task.name,
          TaskStatusEnum[status.getSnapshot()],
          codes.join(', '),
        )

        notified = false
        unsubscribable.unsubscribe()
        pipeline.notifyMaterialHandled(codes)
        if (status.getSnapshot() === TaskStatusEnum.FAILED) reject(task.errors)
        else resolve()
      }
    }

    await new Promise<void>((resolve, reject) => {
      const subscriber: ISubscriber<TaskStatusEnum> = new Subscriber<TaskStatusEnum>({
        onNext: () => {
          setTimeout(() => onTerminated(task.status, unsubscribable, resolve, reject), 0)
        },
        onDispose: () => {
          setTimeout(() => onTerminated(task.status, unsubscribable, resolve, reject), 0)
        },
      })
      const unsubscribable = task.status.subscribe(subscriber)
    })
      .catch(error => {
        reporter?.error(
          '[{}] task({}) failed. codes: {}. error: {}',
          this.name,
          task.name,
          codes,
          error,
        )

        switch (this.strategy) {
          case TaskStrategyEnum.ABORT_ON_ERROR:
            throw Array.isArray(error) ? new AggregateError(error) : error
          case TaskStrategyEnum.CONTINUE_ON_ERROR:
            break
          default:
        }
      })
      .finally(() => {
        this._task = undefined
      })
  }
}
