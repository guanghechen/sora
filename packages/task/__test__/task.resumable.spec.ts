import { delay } from '@guanghechen/shared'
import { jest } from '@jest/globals'
import type { ITaskMonitor } from '../src'
import { ResumableTask, TaskStatus, TaskStrategy } from '../src'

type ITaskExecutor = () => IterableIterator<Promise<void>>

const pollInterval = 50
const stepDuration = 30

class ResumableTaskForTest extends ResumableTask {
  protected readonly __execute: ITaskExecutor

  constructor(strategy: TaskStrategy, execute: ITaskExecutor) {
    super({ name: 'ResumableTaskForTest', strategy, pollInterval })
    this.__execute = execute
  }

  protected override run(): IterableIterator<Promise<void>> {
    return this.__execute()
  }
}

describe('ABORT_ON_ERROR', () => {
  basicTests(TaskStrategy.ABORT_ON_ERROR)
})

describe('CONTINUE_ON_ERROR', () => {
  basicTests(TaskStrategy.CONTINUE_ON_ERROR)
})

function basicTests(strategy: TaskStrategy): void {
  describe('basic', () => {
    let monitor: ITaskMonitor

    beforeEach(() => {
      monitor = { onStatusChange: jest.fn(), onAddError: jest.fn() }
    })

    it('should start and finish successfully', async () => {
      let result: number = 0
      const mockRun = jest.fn(function* (): IterableIterator<Promise<void>> {
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
      })

      const task = new ResumableTaskForTest(strategy, mockRun)
      task.monitor(monitor)

      expect(result).toEqual(0)
      expect(task.status).toEqual(TaskStatus.PENDING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)

      const startPromise = task.start()
      expect(result).toEqual(1)
      expect(task.status).toEqual(TaskStatus.RUNNING)
      expect(mockRun).toHaveBeenCalledTimes(1)

      await startPromise
      expect(result).toEqual(1)

      await delay(pollInterval - 8)
      expect(result).toEqual(1)

      await delay(8)
      expect(result).toEqual(2)
      expect(task.status).toEqual(TaskStatus.RUNNING)

      const pausePromise = task.pause()
      expect(result).toEqual(2)
      expect(task.status).toEqual(TaskStatus.ATTEMPT_SUSPENDING)

      await pausePromise
      expect(result).toEqual(2)
      expect(task.status).toEqual(TaskStatus.SUSPENDED)

      // Once paused, the following steps will be blocked.
      await delay(pollInterval + stepDuration)
      expect(result).toEqual(2)
      expect(task.status).toEqual(TaskStatus.SUSPENDED)

      const resumePromise = task.resume()
      expect(result).toEqual(2)
      expect(task.status).toEqual(TaskStatus.ATTEMPT_RESUMING)

      await resumePromise // resume will trigger queueing a new step.
      expect(result).toEqual(2)
      expect(task.status).toEqual(TaskStatus.RUNNING)

      await delay(pollInterval)
      expect(result).toEqual(3)
      expect(task.status).toEqual(TaskStatus.RUNNING)

      const finishPromise = task.finish()
      expect(result).toEqual(3)
      expect(task.status).toEqual(TaskStatus.ATTEMPT_FINISHING)

      await delay(stepDuration)
      expect(result).toEqual(4)
      expect(task.status).toEqual(TaskStatus.ATTEMPT_FINISHING)

      await delay(stepDuration)
      expect(result).toEqual(5)
      expect(task.status).toEqual(TaskStatus.ATTEMPT_FINISHING)

      await finishPromise
      expect(result).toEqual(8)
      expect(task.status).toEqual(TaskStatus.FINISHED)

      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)
      expect(mockRun).toHaveBeenCalledTimes(1)
    })

    it('should start and auto finish successfully', async () => {
      let result: number = 0
      const mockRun = jest.fn(function* (): IterableIterator<Promise<void>> {
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
      })

      const task = new ResumableTaskForTest(strategy, mockRun)
      task.monitor(monitor)

      expect(result).toEqual(0)
      expect(task.status).toEqual(TaskStatus.PENDING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)

      const startPromise = task.start()
      expect(result).toEqual(1)
      expect(task.status).toEqual(TaskStatus.RUNNING)
      expect(mockRun).toHaveBeenCalledTimes(1)

      await startPromise
      expect(result).toEqual(1)

      await delay(pollInterval - 5)
      expect(result).toEqual(1)

      await delay(5)
      expect(result).toEqual(2)
      expect(task.status).toEqual(TaskStatus.RUNNING)

      await delay((pollInterval + stepDuration) * 10)
      expect(result).toEqual(8)
      expect(task.status).toEqual(TaskStatus.FINISHED)

      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)
      expect(mockRun).toHaveBeenCalledTimes(1)
    })

    it('should start and fail', async () => {
      let result: number = 0
      const mockRun = jest.fn(function* (): IterableIterator<Promise<void>> {
        result = 1
        yield delay(stepDuration)

        result = 2
        yield delay(stepDuration)

        yield Promise.reject('Something went wrong')

        result = 3
        yield delay(stepDuration)

        result = 4
        return
      })
      const task = new ResumableTaskForTest(strategy, mockRun)
      task.monitor(monitor)

      expect(task.status).toEqual(TaskStatus.PENDING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)

      void task.start()
      expect(task.status).toEqual(TaskStatus.RUNNING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)
      expect(mockRun).toHaveBeenCalledTimes(1)

      await task.finish()
      expect(mockRun).toHaveBeenCalledTimes(1)
      expect(result).toEqual(strategy === TaskStrategy.ABORT_ON_ERROR ? 2 : 4)
      expect(task.status).toEqual(TaskStatus.FAILED)
      expect(task.hasError).toEqual(true)
      expect(task.error).toEqual({
        from: task.name,
        details: [
          {
            type: 'ResumableTaskError',
            error: 'Something went wrong',
          },
        ],
      })
      expect(monitor.onAddError).toHaveBeenCalledTimes(1)
      expect(monitor.onAddError).toHaveBeenCalledWith('ResumableTaskError', 'Something went wrong')
    })

    it('should start and auto fail', async () => {
      let result: number = 0
      const mockRun = jest.fn(function* (): IterableIterator<Promise<void>> {
        result = 1
        yield delay(stepDuration)

        result = 2
        yield delay(stepDuration)

        yield Promise.reject('Something went wrong')

        result = 3
        yield delay(stepDuration)

        result = 4
        return
      })
      const task = new ResumableTaskForTest(strategy, mockRun)
      task.monitor(monitor)

      expect(task.status).toEqual(TaskStatus.PENDING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)

      void task.start()
      expect(task.status).toEqual(TaskStatus.RUNNING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)
      expect(mockRun).toHaveBeenCalledTimes(1)

      await delay((pollInterval + stepDuration) * 5)
      expect(mockRun).toHaveBeenCalledTimes(1)
      expect(result).toEqual(strategy === TaskStrategy.ABORT_ON_ERROR ? 2 : 4)
      expect(task.status).toEqual(TaskStatus.FAILED)
      expect(task.hasError).toEqual(true)
      expect(task.error).toEqual({
        from: task.name,
        details: [
          {
            type: 'ResumableTaskError',
            error: 'Something went wrong',
          },
        ],
      })
      expect(monitor.onAddError).toHaveBeenCalledTimes(1)
      expect(monitor.onAddError).toHaveBeenCalledWith('ResumableTaskError', 'Something went wrong')
    })

    it('should finish from pending', async () => {
      let result: number = 0
      const mockRun = jest.fn(function* (): IterableIterator<Promise<void>> {
        result = 1
        yield delay(stepDuration)

        result = 2
        yield delay(stepDuration)

        result = 3
        return
      })

      const task = new ResumableTaskForTest(strategy, mockRun)
      task.monitor(monitor)

      expect(task.status).toEqual(TaskStatus.PENDING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)

      await task.finish()
      expect(result).toEqual(3)
      expect(task.status).toEqual(TaskStatus.FINISHED)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)
      expect(mockRun).toHaveBeenCalledTimes(1)
    })

    it('should cancel from pending', async () => {
      let result: number = 0
      const mockRun = jest.fn(function* (): IterableIterator<Promise<void>> {
        result = 1
        yield delay(stepDuration)

        result = 2
        yield delay(stepDuration)

        result = 3
        return
      })

      const task = new ResumableTaskForTest(strategy, mockRun)
      task.monitor(monitor)

      expect(task.status).toEqual(TaskStatus.PENDING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)

      await task.cancel()
      expect(result).toEqual(0)
      expect(task.status).toEqual(TaskStatus.CANCELLED)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)
      expect(mockRun).toHaveBeenCalledTimes(0)
    })

    it('should be cancelled', async () => {
      let result: number = 0
      const mockRun = jest.fn(function* (): IterableIterator<Promise<void>> {
        result = 1
        yield delay(stepDuration)

        result = 2
        yield delay(stepDuration)

        result = 3
        return
      })

      const task = new ResumableTaskForTest(strategy, mockRun)
      task.monitor(monitor)

      expect(task.status).toEqual(TaskStatus.PENDING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)

      await task.start()
      expect(result).toEqual(1)
      expect(task.status).toEqual(TaskStatus.RUNNING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)
      expect(mockRun).toHaveBeenCalledTimes(1)

      await delay(pollInterval)
      expect(result).toEqual(2)
      expect(task.status).toEqual(TaskStatus.RUNNING)

      const promise = task.cancel()
      expect(task.status).toEqual(TaskStatus.ATTEMPT_CANCELING)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)
      expect(mockRun).toHaveBeenCalledTimes(1)

      await promise
      expect(result).toEqual(2)
      expect(task.status).toEqual(TaskStatus.CANCELLED)
      expect(task.hasError).toEqual(false)
      expect(task.error).toEqual(undefined)
      expect(monitor.onAddError).toHaveBeenCalledTimes(0)
      expect(mockRun).toHaveBeenCalledTimes(1)
    })
  })
}