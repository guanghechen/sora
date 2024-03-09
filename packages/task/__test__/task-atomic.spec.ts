import { ErrorLevelEnum } from '@guanghechen/error.types'
import { jest } from '@jest/globals'
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
      process: jest.fn(() => delay(20)),
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
      process: jest.fn(async () => {
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
      process: jest.fn(() => delay(20)),
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
      process: jest.fn(() => delay(20)),
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
      process: jest.fn(() => delay(20)),
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
})
