import { delay } from '@guanghechen/shared'
import { jest } from '@jest/globals'
import type { ITaskMonitor } from '../src'
import { AtomicTask, TaskStatus } from '../src'

type ITaskExecutor = () => Promise<void>

class AtomicTaskForTest extends AtomicTask {
  protected readonly __execute: () => Promise<void>

  constructor(execute: ITaskExecutor) {
    super('AtomicTaskForTest')
    this.__execute = execute
  }

  protected override run(): Promise<void> {
    return this.__execute()
  }
}

describe('AtomicTask', () => {
  let monitor: ITaskMonitor

  beforeEach(() => {
    monitor = { onStatusChange: jest.fn(), onAddError: jest.fn() }
  })

  it('should start and finish successfully', async () => {
    const mockRun = jest.fn(() => delay(20))
    const task = new AtomicTaskForTest(mockRun)
    task.monitor(monitor)

    expect(task.status).toEqual(TaskStatus.PENDING)
    expect(task.hasError).toEqual(false)
    expect(task.error).toEqual(undefined)
    expect(monitor.onAddError).toHaveBeenCalledTimes(0)

    void task.start()
    expect(task.status).toEqual(TaskStatus.RUNNING)
    expect(mockRun).toHaveBeenCalledTimes(1)

    await task.start()
    expect(task.status).toEqual(TaskStatus.FINISHED)

    await task.pause()
    expect(task.status).toEqual(TaskStatus.FINISHED)

    await task.resume()
    expect(task.status).toEqual(TaskStatus.FINISHED)

    await task.cancel()
    expect(task.status).toEqual(TaskStatus.FINISHED)

    await task.finish()
    expect(task.status).toEqual(TaskStatus.FINISHED)

    expect(task.hasError).toEqual(false)
    expect(task.error).toEqual(undefined)
    expect(monitor.onAddError).toHaveBeenCalledTimes(0)
    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it('should start and fail', async () => {
    const mockRun = jest.fn(async () => {
      await delay(20)
      throw 'Something went wrong'
    })
    const task = new AtomicTaskForTest(mockRun)
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
    expect(task.status).toEqual(TaskStatus.FAILED)
    expect(task.hasError).toEqual(true)
    expect(task.error).toEqual({
      from: task.name,
      details: [
        {
          type: 'AtomicTaskError',
          error: 'Something went wrong',
        },
      ],
    })
    expect(monitor.onAddError).toHaveBeenCalledTimes(1)
    expect(monitor.onAddError).toHaveBeenCalledWith('AtomicTaskError', 'Something went wrong')
  })

  it('should finish from pending', async () => {
    const mockRun = jest.fn(() => delay(20))
    const task = new AtomicTaskForTest(mockRun)
    task.monitor(monitor)

    expect(task.status).toEqual(TaskStatus.PENDING)
    expect(task.hasError).toEqual(false)
    expect(task.error).toEqual(undefined)
    expect(monitor.onAddError).toHaveBeenCalledTimes(0)

    await task.finish()
    expect(task.status).toEqual(TaskStatus.FINISHED)
    expect(task.hasError).toEqual(false)
    expect(task.error).toEqual(undefined)
    expect(monitor.onAddError).toHaveBeenCalledTimes(0)
    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it('should cancel from pending', async () => {
    const mockRun = jest.fn(() => delay(20))
    const task = new AtomicTaskForTest(mockRun)
    task.monitor(monitor)

    expect(task.status).toEqual(TaskStatus.PENDING)
    expect(task.hasError).toEqual(false)
    expect(task.error).toEqual(undefined)
    expect(monitor.onAddError).toHaveBeenCalledTimes(0)

    await task.cancel()
    expect(task.status).toEqual(TaskStatus.CANCELLED)
    expect(task.hasError).toEqual(false)
    expect(task.error).toEqual(undefined)
    expect(monitor.onAddError).toHaveBeenCalledTimes(0)
    expect(mockRun).toHaveBeenCalledTimes(0)
  })

  it('should not be cancelled once started', async () => {
    const mockRun = jest.fn(() => delay(20))
    const task = new AtomicTaskForTest(mockRun)
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

    const promise = task.cancel()
    expect(task.status).toEqual(TaskStatus.ATTEMPT_CANCELING)
    expect(task.hasError).toEqual(false)
    expect(task.error).toEqual(undefined)
    expect(monitor.onAddError).toHaveBeenCalledTimes(0)
    expect(mockRun).toHaveBeenCalledTimes(1)

    await promise
    expect(task.status).toEqual(TaskStatus.FINISHED)
    expect(task.hasError).toEqual(false)
    expect(task.error).toEqual(undefined)
    expect(monitor.onAddError).toHaveBeenCalledTimes(0)
    expect(mockRun).toHaveBeenCalledTimes(1)
  })
})
