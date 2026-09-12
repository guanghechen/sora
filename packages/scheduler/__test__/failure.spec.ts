import { Subscriber } from '@guanghechen/subscriber'
import { AtomicTask, TaskStatusEnum, TaskStrategyEnum } from '@guanghechen/task'
import { vi } from 'vitest'
import { Pipeline, PipelineStatusEnum, Scheduler } from '../src'

class SuccessfulTask extends AtomicTask {
  protected override async run(): Promise<void> {}
}

describe('pipeline pull failures', () => {
  let pipeline: Pipeline<number, number>

  beforeEach(() => {
    pipeline = new Pipeline('failing-pipeline')
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('handles all dequeued codes without acknowledging materials still queued', async () => {
    const error = new Error('cooker failed')
    pipeline.use({
      name: 'cooker',
      cook: async data => {
        if (data === 0) return null
        if (data === 1) throw error
        return data
      },
    })
    const dropped = await pipeline.push(0)
    const failed = await pipeline.push(1)
    const queued = await pipeline.push(2)
    const notify = vi.spyOn(pipeline, 'notifyMaterialHandled')
    const onDropped = vi.fn()
    const onFailed = vi.fn()
    const onQueued = vi.fn()
    const onAll = vi.fn()
    const waitDropped = pipeline.waitMaterialHandled(dropped).then(onDropped)
    const waitFailed = pipeline.waitMaterialHandled(failed).then(onFailed)
    const waitQueued = pipeline.waitMaterialHandled(queued).then(onQueued)
    const waitAll = pipeline.waitAllMaterialsHandledAt(queued).then(onAll)

    await expect(pipeline.pull()).rejects.toBe(error)
    expect(notify).toHaveBeenCalledExactlyOnceWith([dropped, failed])
    await Promise.all([waitDropped, waitFailed])
    expect(onDropped).toHaveBeenCalledTimes(1)
    expect(onFailed).toHaveBeenCalledTimes(1)
    expect(onQueued).not.toHaveBeenCalled()
    expect(onAll).not.toHaveBeenCalled()
    expect(pipeline.size).toBe(1)
    expect(pipeline.status.getSnapshot()).toBe(PipelineStatusEnum.IDLE)

    const product = await pipeline.pull()
    expect(product).toEqual({ codes: [queued], data: 2 })
    expect(notify).toHaveBeenCalledTimes(1)
    pipeline.notifyMaterialHandled(product.codes)
    await Promise.all([waitQueued, waitAll])
    expect(onQueued).toHaveBeenCalledTimes(1)
    expect(onAll).toHaveBeenCalledTimes(1)
  })

  it('updates a drained pipeline after its last material fails', async () => {
    const error = new Error('cooker failed')
    pipeline.use({
      name: 'cooker',
      cook: async () => {
        throw error
      },
    })
    const code = await pipeline.push(1)
    const notify = vi.spyOn(pipeline, 'notifyMaterialHandled')

    await expect(pipeline.pull()).rejects.toBe(error)
    expect(pipeline.size).toBe(0)
    expect(pipeline.status.getSnapshot()).toBe(PipelineStatusEnum.DRIED)
    expect(notify).toHaveBeenCalledExactlyOnceWith([code])
    await expect(pipeline.waitMaterialHandled(code)).resolves.toBeUndefined()
    await expect(pipeline.waitAllMaterialsHandledAt(code)).resolves.toBeUndefined()
    await pipeline.push(2)
    expect(pipeline.status.getSnapshot()).toBe(PipelineStatusEnum.IDLE)
  })

  it.each([false, true])(
    'handles drained-state notification errors with cooker failure %s',
    async failCooker => {
      const cookerError = new Error('cooker failed')
      const statusError = new Error('status notification failed')
      pipeline.use({
        name: 'cooker',
        cook: async data => {
          if (failCooker) throw cookerError
          return data
        },
      })
      const code = await pipeline.push(1)
      pipeline.status.subscribe(
        new Subscriber<PipelineStatusEnum>({
          onNext: status => {
            if (status === PipelineStatusEnum.DRIED) throw statusError
          },
        }),
      )
      const notify = vi.spyOn(pipeline, 'notifyMaterialHandled')

      const pulling = pipeline.pull()
      if (failCooker) {
        await expect(pulling).rejects.toBeInstanceOf(AggregateError)
        await expect(pulling).rejects.toMatchObject({ errors: [cookerError, statusError] })
      } else {
        await expect(pulling).rejects.toBe(statusError)
      }
      expect(notify).toHaveBeenCalledExactlyOnceWith([code])
      await expect(pipeline.waitMaterialHandled(code)).resolves.toBeUndefined()
      expect(pipeline.status.getSnapshot()).toBe(PipelineStatusEnum.DRIED)
    },
  )

  it('preserves the cooker error when the handled notification also throws', async () => {
    const cookerError = new Error('cooker failed')
    const notificationError = new Error('handled notification failed')
    pipeline.use({
      name: 'cooker',
      cook: async () => {
        throw cookerError
      },
    })
    const code = await pipeline.push(1)
    const notify = pipeline.notifyMaterialHandled.bind(pipeline)
    vi.spyOn(pipeline, 'notifyMaterialHandled').mockImplementation(codes => {
      notify(codes)
      throw notificationError
    })

    await expect(pipeline.pull()).rejects.toMatchObject({
      errors: [cookerError, notificationError],
    })
    await expect(pipeline.waitMaterialHandled(code)).resolves.toBeUndefined()
  })
})

describe.each(['cooker', 'consumer'])('scheduler %s failures', failureAt => {
  it.each([TaskStrategyEnum.ABORT_ON_ERROR, TaskStrategyEnum.CONTINUE_ON_ERROR])(
    'settles waiters and preserves strategy %s',
    async strategy => {
      const pipeline = new Pipeline<number, number>('failing-pipeline')
      const scheduler = new Scheduler({
        name: 'failing-scheduler',
        pipeline,
        strategy,
        idleInterval: 1,
        pollInterval: 1,
      })
      const error = new Error(`${failureAt} failed`)
      const task = new SuccessfulTask('next-task', strategy)
      pipeline.use({
        name: 'cooker',
        cook: async data => {
          if (data === 0 && failureAt === 'cooker') throw error
          return data
        },
      })
      scheduler.use({
        name: 'consumer',
        consume: async data => {
          if (data === 0 && failureAt === 'consumer') throw error
          return task
        },
      })

      try {
        const failed = await scheduler.schedule(0)
        const notify = vi.spyOn(pipeline, 'notifyMaterialHandled')
        const onFailed = vi.fn()
        const onAll = vi.fn()
        const waitFailed = scheduler.waitTaskTerminated(failed).then(onFailed)
        const waitAll = scheduler.waitAllScheduledTasksTerminated().then(onAll)
        await scheduler.start()

        // Let the step driver record the failure before requesting completion.
        await vi.waitFor(() => expect(scheduler.errors).toHaveLength(1))
        expect(scheduler.errors[0]).toMatchObject({ from: scheduler.name, details: error })
        expect(notify).toHaveBeenCalledExactlyOnceWith([failed])
        await Promise.all([waitFailed, waitAll])
        expect(onFailed).toHaveBeenCalledTimes(1)
        expect(onAll).toHaveBeenCalledTimes(1)

        if (strategy === TaskStrategyEnum.CONTINUE_ON_ERROR) {
          const next = await scheduler.schedule(1)
          expect(next).toBeGreaterThan(failed)
          await scheduler.waitTaskTerminated(next)
          await scheduler.waitAllScheduledTasksTerminated()
          expect(task.status.getSnapshot()).toBe(TaskStatusEnum.COMPLETED)
          expect(notify).toHaveBeenCalledTimes(2)
          expect(notify).toHaveBeenLastCalledWith([next])
        } else {
          expect(scheduler.status.getSnapshot()).toBe(TaskStatusEnum.FAILED)
          expect(await scheduler.schedule(1)).toBe(-1)
          expect(task.status.getSnapshot()).toBe(TaskStatusEnum.PENDING)
        }

        await scheduler.complete()
        expect(scheduler.status.getSnapshot()).toBe(TaskStatusEnum.FAILED)
        expect(scheduler.errors).toHaveLength(1)
      } finally {
        await pipeline.close()
        await scheduler.cancel()
      }
    },
  )
})

it('preserves the consumer error when the handled notification also throws', async () => {
  const pipeline = new Pipeline<number, number>('pipeline')
  const scheduler = new Scheduler({
    name: 'scheduler',
    pipeline,
    strategy: TaskStrategyEnum.ABORT_ON_ERROR,
  })
  const consumerError = new Error('consumer failed')
  const notificationError = new Error('handled notification failed')
  pipeline.use({ name: 'cooker', cook: async data => data })
  scheduler.use({
    name: 'consumer',
    consume: async () => {
      throw consumerError
    },
  })
  const notify = pipeline.notifyMaterialHandled.bind(pipeline)
  const notification = vi.spyOn(pipeline, 'notifyMaterialHandled').mockImplementation(codes => {
    notify(codes)
    throw notificationError
  })

  try {
    const code = await scheduler.schedule(1)
    const waiting = scheduler.waitTaskTerminated(code)
    await scheduler.start()
    await vi.waitFor(() => expect(scheduler.status.getSnapshot()).toBe(TaskStatusEnum.FAILED))
    expect(scheduler.errors).toHaveLength(1)
    expect(scheduler.errors[0]).toMatchObject({
      details: { errors: [consumerError, notificationError] },
    })
    expect(notification).toHaveBeenCalledExactlyOnceWith([code])
    await waiting
  } finally {
    await pipeline.close()
    await scheduler.cancel()
  }
})
