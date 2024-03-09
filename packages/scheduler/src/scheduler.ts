import { ErrorLevelEnum, type ISoraError } from '@guanghechen/error.types'
import { Subscriber } from '@guanghechen/observable'
import type { ISubscriber } from '@guanghechen/observable'
import type { IReporter } from '@guanghechen/reporter.types'
import type { ITask, TaskStrategyEnum } from '@guanghechen/task'
import { ResumableTask, TaskStatusEnum } from '@guanghechen/task'
import { PipelineStatusEnum } from './constant'
import type { IProductConsumer, IProductConsumerApi, IProductConsumerNext } from './types/consumer'
import type { IPipeline } from './types/pipeline'
import type { IProduct } from './types/product'
import type { IScheduler } from './types/scheduler'

const delay = (duration: number): Promise<void> =>
  new Promise<void>(resolve => setTimeout(resolve, duration))

interface IProps<D, T> {
  readonly name: string
  readonly pipeline: IPipeline<D, T>
  readonly strategy: TaskStrategyEnum
  readonly reporter: IReporter | undefined
  readonly pollInterval?: number
  readonly idleInterval?: number
}

export class Scheduler<D, T> extends ResumableTask implements IScheduler<D, T> {
  protected readonly _consumers: Array<IProductConsumer<T, ITask>>
  protected readonly _consumerApi: IProductConsumerApi
  protected readonly _idleInterval: number
  protected readonly _pipeline: IPipeline<D, T>
  protected readonly _reporter: IReporter | undefined
  protected _task: ITask | undefined

  constructor(props: IProps<D, T>) {
    const { name, pipeline, reporter, strategy } = props
    const pollInterval: number = Math.max(0, Number(props.pollInterval) || 0)
    const idleInterval: number = Math.max(500, Number(props.idleInterval) || 0)
    super(name, strategy, pollInterval)

    this._consumers = []
    this._consumerApi = {}
    this._idleInterval = idleInterval
    this._pipeline = pipeline
    this._reporter = reporter
    this._task = undefined

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

  public schedule(data: D): Promise<number> {
    return this._pipeline.push(data)
  }

  public use(consumer: IProductConsumer<T, ITask>): void {
    this._consumers.push(consumer)
  }

  public waitTaskTerminated(code: number): Promise<void> {
    return this._pipeline.waitMaterialHandled(code)
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
    const product: IProduct<T> = await pipeline.pull()
    if (product.data === null || product.codes.length <= 0) return delay(this._idleInterval)

    const reporter: IReporter | undefined = this._reporter
    const api: IProductConsumerApi = this._consumerApi
    const reducer: IProductConsumerNext<ITask> = this._consumers.reduceRight<
      IProductConsumerNext<ITask>
    >(
      (next, consumer) => embryo => consumer.consume(product, embryo, api, next),
      async embryo => embryo,
    )
    const task: ITask | null = await reducer(null)
    if (task === null) return delay(this._idleInterval)

    reporter?.verbose(
      '[{}] task({}) starting. codes: [{}]',
      this.name,
      task.name,
      product.codes.join(', '),
    )

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
                product.codes.join(', '),
              )
              reporter?.debug(
                '[{}] task({}) finished. details: {}',
                this.name,
                task.name,
                product.data,
              )

              unsubscribable.unsubscribe()
              resolve()
              break
            case TaskStatusEnum.FAILED:
              reporter?.verbose(
                '[{}] task({}) failed. codes: {}.',
                this.name,
                task.name,
                product.codes.join(', '),
              )
              reporter?.debug(
                '[{}] task({}) failed. details: {}',
                this.name,
                task.name,
                product.data,
              )

              unsubscribable.unsubscribe()
              reject(task.errors)
              break
            case TaskStatusEnum.CANCELLED:
              reporter?.verbose(
                '[{}] task({}) cancelled. codes: {}.',
                this.name,
                task.name,
                product.codes.join(', '),
              )
              reporter?.debug(
                '[{}] task({}) cancelled. details: {}',
                this.name,
                task.name,
                product.data,
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
      pipeline.notifyMaterialHandled(product.codes)
    })
  }
}
