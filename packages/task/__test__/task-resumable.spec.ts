import { ErrorLevelEnum } from '@guanghechen/error.types'
import { vi } from 'vitest'
import { ResumableTask, TaskStatusEnum, TaskStrategyEnum } from '../src'

interface ITaskProcessor {
  process: () => IterableIterator<Promise<void>>
}

const pollInterval = 50
const stepDuration = 30
const delay = (duration: number): Promise<void> =>
  new Promise<void>(resolve => setTimeout(resolve, duration))

class ResumableTaskForTest extends ResumableTask {
  protected readonly _processor: ITaskProcessor

  constructor(processor: ITaskProcessor, strategy: TaskStrategyEnum) {
    super('ResumableTaskForTest', strategy, pollInterval)
    this._processor = processor
  }

  protected override run(): IterableIterator<Promise<void>> {
    return this._processor.process()
  }
}

describe('ABORT_ON_ERROR', () => {
  basicTests(TaskStrategyEnum.ABORT_ON_ERROR)
})

describe('CONTINUE_ON_ERROR', () => {
  basicTests(TaskStrategyEnum.CONTINUE_ON_ERROR)
})

function basicTests(strategy: TaskStrategyEnum): void {
  describe('basic', () => {
    it('should start and finish successfully', async () => {
      let result: number = 0
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          result = 1
          yield delay(stepDuration)

          result = 2
          yield delay(stepDuration)

          result = 3
          yield delay(stepDuration)

          result = 4
          yield delay(stepDuration)

          result = 5
          yield delay(stepDuration)

          result = 6
          yield delay(stepDuration)

          result = 7
          yield delay(stepDuration)

          result = 8
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(result).toEqual(0)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      await task.start()
      expect(result).toEqual(1)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)
      expect(processor.process).toHaveBeenCalledTimes(1)

      await delay(stepDuration)
      expect(result).toEqual(1)

      await delay(pollInterval)
      expect(result).toEqual(2)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)

      const pausePromise = task.pause()
      expect(result).toEqual(2)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.ATTEMPT_SUSPENDING)

      await pausePromise
      expect(result).toEqual(2)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.SUSPENDED)

      // Once paused, the following steps will be blocked.
      await delay(pollInterval + stepDuration)
      expect(result).toEqual(2)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.SUSPENDED)

      const resumePromise = task.resume()
      expect(result).toEqual(2)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.ATTEMPT_RESUMING)

      await resumePromise // resume will trigger queueing a new step.
      expect(result).toEqual(2)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)

      await delay(pollInterval)
      expect(result).toEqual(3)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)

      const finishPromise = task.complete()
      expect(result).toEqual(3)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.ATTEMPT_COMPLETING)

      await delay(stepDuration)
      expect(result).toEqual(4)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.ATTEMPT_COMPLETING)

      await delay(stepDuration)
      expect(result).toEqual(5)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.ATTEMPT_COMPLETING)

      await finishPromise
      expect(result).toEqual(8)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)

      expect(task.errors).toEqual([])
      expect(processor.process).toHaveBeenCalledTimes(1)
    })

    it('should start and auto finish successfully', async () => {
      let result: number = 0
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          result = 1
          yield delay(stepDuration)

          result = 2
          yield delay(stepDuration)

          result = 3
          yield delay(stepDuration)

          result = 4
          yield delay(stepDuration)

          result = 5
          yield delay(stepDuration)

          result = 6
          yield delay(stepDuration)

          result = 7
          yield delay(stepDuration)

          result = 8
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(result).toEqual(0)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      await task.start()
      expect(result).toEqual(1)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)
      expect(processor.process).toHaveBeenCalledTimes(1)

      await delay(stepDuration)
      expect(result).toEqual(1)

      await delay((pollInterval + stepDuration) * 10)
      expect(result).toEqual(8)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)

      expect(task.errors).toEqual([])
      expect(processor.process).toHaveBeenCalledTimes(1)
    })

    it('should start and fail', async () => {
      let result: number = 0
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          result = 1
          yield delay(stepDuration)

          result = 2
          yield delay(stepDuration)

          yield Promise.reject('Something went wrong')

          result = 3
          yield delay(stepDuration)

          result = 4
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      await task.start()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)
      expect(task.errors).toEqual([])
      expect(processor.process).toHaveBeenCalledTimes(1)

      await task.complete()
      expect(processor.process).toHaveBeenCalledTimes(1)
      expect(result).toEqual(strategy === TaskStrategyEnum.ABORT_ON_ERROR ? 2 : 4)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.FAILED)
      expect(task.errors).toEqual([
        {
          from: 'ResumableTaskForTest',
          level: ErrorLevelEnum.ERROR,
          details: 'Something went wrong',
        },
      ])
    })

    it('should start and auto fail', async () => {
      let result: number = 0
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          result = 1
          yield delay(stepDuration)

          result = 2
          yield delay(stepDuration)

          yield Promise.reject('Something went wrong')

          result = 3
          yield delay(stepDuration)

          result = 4
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      void task.start()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)
      expect(task.errors).toEqual([])
      expect(processor.process).toHaveBeenCalledTimes(1)

      await delay((pollInterval + stepDuration) * 5)
      expect(processor.process).toHaveBeenCalledTimes(1)
      expect(result).toEqual(strategy === TaskStrategyEnum.ABORT_ON_ERROR ? 2 : 4)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.FAILED)
      expect(task.errors).toEqual([
        {
          from: 'ResumableTaskForTest',
          level: ErrorLevelEnum.ERROR,
          details: 'Something went wrong',
        },
      ])
    })

    it('should finish from pending', async () => {
      let result: number = 0
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          result = 1
          yield delay(stepDuration)

          result = 2
          yield delay(stepDuration)

          result = 3
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      await task.complete()
      expect(result).toEqual(3)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)
      expect(task.errors).toEqual([])
      expect(processor.process).toHaveBeenCalledTimes(1)
    })

    it('should cancel from pending', async () => {
      let result: number = 0
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          result = 1
          yield delay(stepDuration)

          result = 2
          yield delay(stepDuration)

          result = 3
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      await task.cancel()
      expect(result).toEqual(0)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.CANCELLED)
      expect(task.errors).toEqual([])
      expect(processor.process).toHaveBeenCalledTimes(0)
    })

    it('should be cancelled', async () => {
      let result: number = 0
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          result = 1
          yield delay(stepDuration)

          result = 2
          yield delay(stepDuration)

          result = 3
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      await task.start()
      expect(result).toEqual(1)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)
      expect(task.errors).toEqual([])
      expect(processor.process).toHaveBeenCalledTimes(1)

      await delay(stepDuration + pollInterval + 10)
      expect(result).toEqual(2)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.RUNNING)

      const cancelPromise = task.cancel()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.ATTEMPT_CANCELING)
      expect(task.errors).toEqual([])
      expect(processor.process).toHaveBeenCalledTimes(1)

      await cancelPromise
      expect(result).toEqual(2)
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.CANCELLED)
      expect(task.errors).toEqual([])
      expect(processor.process).toHaveBeenCalledTimes(1)
    })
  })

  describe('terminated', () => {
    it('cancelled', async () => {
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          yield delay(stepDuration)
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      await task.cancel()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.CANCELLED)
      expect(task.errors).toEqual([])

      await task.cancel()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.CANCELLED)
      expect(task.errors).toEqual([])

      await task.complete()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.CANCELLED)
      expect(task.errors).toEqual([])
    })

    it('failed', async () => {
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          yield Promise.reject('!!!')
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      await task.complete()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.FAILED)
      expect(task.errors).toEqual([
        {
          from: 'ResumableTaskForTest',
          level: ErrorLevelEnum.ERROR,
          details: '!!!',
        },
      ])

      await task.cancel()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.FAILED)
      expect(task.errors).toEqual([
        {
          from: 'ResumableTaskForTest',
          level: ErrorLevelEnum.ERROR,
          details: '!!!',
        },
      ])

      await task.complete()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.FAILED)
      expect(task.errors).toEqual([
        {
          from: 'ResumableTaskForTest',
          level: ErrorLevelEnum.ERROR,
          details: '!!!',
        },
      ])
    })

    it('completed', async () => {
      const processor: ITaskProcessor = {
        process: vi.fn(function* (): IterableIterator<Promise<void>> {
          yield delay(stepDuration)
          return
        }),
      }
      const task = new ResumableTaskForTest(processor, strategy)

      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.PENDING)
      expect(task.errors).toEqual([])

      await task.complete()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)
      expect(task.errors).toEqual([])

      await task.cancel()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)
      expect(task.errors).toEqual([])

      await task.complete()
      expect(task.status.getSnapshot()).toEqual(TaskStatusEnum.COMPLETED)
      expect(task.errors).toEqual([])
    })
  })
}
