import { ErrorLevelEnum } from '@guanghechen/types'
import { vi } from 'vitest'
import { AtomicTask, TaskStatusEnum, TaskStrategyEnum } from '../src'

interface ITaskProcessor {
  process: () => Promise<void>
}

const delay = (duration: number): Promise<void> =>
  new Promise<void>(resolve => setTimeout(resolve, duration))

class AtomicTaskForTest extends AtomicTask {
  protected readonly _processor: ITaskProcessor

  constructor(processor: ITaskProcessor, strategy: TaskStrategyEnum) {
    super('AtomicTaskForTest', strategy)
    this._processor = processor
  }

  protected override run(): Promise<void> {
    return this._processor.process()
  }
}

describe('AtomicTask', () => {
  it('should start and finish successfully', async () => {
    const processor: ITaskProcessor = {
      process: vi.fn(() => delay(20)),
    }
    const task = new AtomicTaskForTest(processor, TaskStrategyEnum.ABORT_ON_ERROR)

    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
    expect(task.errors).toEqual([])

    void task.start()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)
    expect(processor.process).toHaveBeenCalledTimes(1)

    await task.start()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)

    await task.pause()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)

    await task.resume()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)

    await task.cancel()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)

    await task.complete()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)

    expect(task.errors).toEqual([])
    expect(processor.process).toHaveBeenCalledTimes(1)
  })

  it('should start and fail', async () => {
    const processor: ITaskProcessor = {
      process: vi.fn(async () => {
        await delay(20)

        throw 'Something went wrong'
      }),
    }
    const task = new AtomicTaskForTest(processor, TaskStrategyEnum.ABORT_ON_ERROR)

    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
    expect(task.errors).toEqual([])

    void task.start()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)
    expect(task.errors).toEqual([])
    expect(processor.process).toHaveBeenCalledTimes(1)

    await task.complete()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.FAILED)
    expect(task.errors).toEqual([
      {
        from: 'AtomicTaskForTest',
        level: ErrorLevelEnum.ERROR,
        details: 'Something went wrong',
      },
    ])
    expect(processor.process).toHaveBeenCalledTimes(1)
  })

  it('should finish from pending', async () => {
    const processor: ITaskProcessor = {
      process: vi.fn(() => delay(20)),
    }
    const task = new AtomicTaskForTest(processor, TaskStrategyEnum.ABORT_ON_ERROR)

    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
    expect(task.errors).toEqual([])

    await task.complete()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)
    expect(task.errors).toEqual([])
    expect(processor.process).toHaveBeenCalledTimes(1)
  })

  it('should cancel from pending', async () => {
    const processor: ITaskProcessor = {
      process: vi.fn(() => delay(20)),
    }
    const task = new AtomicTaskForTest(processor, TaskStrategyEnum.ABORT_ON_ERROR)

    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
    expect(task.errors).toEqual([])

    await task.cancel()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.CANCELLED)
    expect(task.errors).toEqual([])
    expect(processor.process).toHaveBeenCalledTimes(0)
  })

  it('should not be cancelled once started', async () => {
    const processor: ITaskProcessor = {
      process: vi.fn(() => delay(20)),
    }
    const task = new AtomicTaskForTest(processor, TaskStrategyEnum.ABORT_ON_ERROR)

    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
    expect(task.errors).toEqual([])

    void task.start()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)
    expect(task.errors).toEqual([])

    const promise = task.cancel()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.ATTEMPT_CANCELING)
    expect(task.errors).toEqual([])
    expect(processor.process).toHaveBeenCalledTimes(1)

    await promise
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)
    expect(task.errors).toEqual([])
    expect(processor.process).toHaveBeenCalledTimes(1)
  })

  it('should not throw when cancel() races with complete()', async () => {
    const processor: ITaskProcessor = {
      process: vi.fn(() => delay(20)),
    }
    const task = new AtomicTaskForTest(processor, TaskStrategyEnum.ABORT_ON_ERROR)

    void task.start()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)

    // cancel() enters ATTEMPT_CANCELING; a complete() racing in must not throw on the
    // forbidden ATTEMPT_CANCELING -> ATTEMPT_COMPLETING transition.
    const cancelPromise = task.cancel()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.ATTEMPT_CANCELING)
    const completePromise = task.complete()

    await expect(Promise.all([cancelPromise, completePromise])).resolves.toBeInstanceOf(Array)
    expect(task.status.terminated).toBe(true)
  })

  it('should not throw when complete() races with cancel()', async () => {
    const processor: ITaskProcessor = {
      process: vi.fn(() => delay(20)),
    }
    const task = new AtomicTaskForTest(processor, TaskStrategyEnum.ABORT_ON_ERROR)

    void task.start()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)

    // complete() enters ATTEMPT_COMPLETING; a cancel() racing in must not throw on the
    // forbidden ATTEMPT_COMPLETING -> ATTEMPT_CANCELING transition.
    const completePromise = task.complete()
    expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.ATTEMPT_COMPLETING)
    const cancelPromise = task.cancel()

    await expect(Promise.all([completePromise, cancelPromise])).resolves.toBeInstanceOf(Array)
    expect(task.status.terminated).toBe(true)
  })
})
