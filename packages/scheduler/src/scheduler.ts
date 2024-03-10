import { ErrorLevelEnum, type ISoraError } from '@guanghechen/error.types'
import type { IReporter } from '@guanghechen/reporter.types'
import { Subscriber } from '@guanghechen/subscriber'
import type { ISubscriber, IUnsubscribable } from '@guanghechen/subscriber'
import type { ITask } from '@guanghechen/task'
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

  public use(consumer: IProductConsumer<T, ITask>): this {
    this._consumers.push(consumer)
    return this
  }

  public async schedule(data: D): Promise<number> {
    if (this.status.terminated) return -1
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

  public override async complete(): Promise<void> {
    this.status.next(TaskStatusEnum.COMPLETED, { strict: false })
    await this.waitAllScheduledTasksTerminated()
  }

  protected override *run(): IterableIterator<Promise<void>> {
    const pipeline: IPipeline<D, T> = this._pipeline
    while (!pipeline.status.closed && !this.status.terminated) {
      while (pipeline.size > 0) {
        if (this.status.terminated) return
        yield this._pullAndRun()
      }

      // Waiting the pipeline to be idle.
      let resolved: boolean = false
      let unsubscribable: IUnsubscribable | undefined
      yield new Promise<void>(resolve => {
        const subscriber: ISubscriber<PipelineStatusEnum> = new Subscriber<PipelineStatusEnum>({
          onNext: nextStatus => {
            if (resolved) return
            if (nextStatus !== PipelineStatusEnum.DRIED) resolve()
          },
        })
        unsubscribable = pipeline.status.subscribe(subscriber)
      }).finally(() => {
        resolved = true
        unsubscribable?.unsubscribe()
      })
    }

    while (pipeline.size > 0) {
      if (this.status.terminated) return
      yield this._pullAndRun()
    }
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

    let resolved: boolean = false
    let unsubscribable: IUnsubscribable | undefined
    await new Promise<void>((resolve, reject) => {
      const subscriber: ISubscriber<TaskStatusEnum> = new Subscriber<TaskStatusEnum>({
        onNext: status => {
          if (resolved) return
          if (task.status.terminated) {
            reporter?.verbose(
              '[{}] task({}) {}. codes: {}.',
              this.name,
              task.name,
              TaskStatusEnum[status],
              codes.join(', '),
            )
            if (status === TaskStatusEnum.FAILED) reject(task.errors)
            else resolve()
          }
        },
      })
      unsubscribable = task.status.subscribe(subscriber)
    }).finally(() => {
      resolved = true
      unsubscribable?.unsubscribe()
      pipeline.notifyMaterialHandled(codes)

      this._task = undefined
      if (task.errors.length > 0) {
        const error: ISoraError = {
          from: task.name,
          level: ErrorLevelEnum.ERROR,
          details: task.errors.length > 1 ? new AggregateError(task.errors) : task.errors,
        }
        this._errors.push(error)

        reporter?.error(
          '[{}] task({}) failed. codes: {}. error: {}',
          this.name,
          task.name,
          codes,
          error,
        )

        switch (this.strategy) {
          case TaskStrategyEnum.ABORT_ON_ERROR:
            throw error
          case TaskStrategyEnum.CONTINUE_ON_ERROR:
            break
          default:
        }
      }
    })
  }
}
