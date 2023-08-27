import { jest } from '@jest/globals'
import type { ITaskMonitor } from '../src'
import { TaskState, TaskStatus } from '../src'

class TaskStateForTest extends TaskState {
  constructor() {
    super('taskStateForTest')
  }

  public forceSetStatusWithoutNotify(status: TaskStatus): void {
    ;(this as any)._status = status
  }

  public get sizeOfOnStatusChangeMonitor(): number {
    return (this as any)._monitors.onStatusChange.size
  }

  public get sizeOfOnAddErrorMonitor(): number {
    return (this as any)._monitors.onAddError.size
  }
}

describe('TaskState', () => {
  let state: TaskStateForTest
  let monitor1: Partial<ITaskMonitor>
  let monitor2: Partial<ITaskMonitor>
  let monitor3: Partial<ITaskMonitor>

  beforeEach(() => {
    state = new TaskStateForTest()
    monitor1 = { onStatusChange: jest.fn(), onAddError: jest.fn() }
    monitor2 = { onStatusChange: jest.fn() }
    monitor3 = { onAddError: jest.fn() }
  })

  it('should throw error when trying to cleanup a unterminated task', async () => {
    expect(state.status).toEqual(TaskStatus.PENDING)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(0)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)

    state.monitor(monitor1)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(1)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    state.monitor(monitor2)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    expect(state.status).toEqual(TaskStatus.PENDING)
    expect(() => state.cleanup()).toThrow(/is not terminated/)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    state.forceSetStatusWithoutNotify(TaskStatus.FINISHED)
    expect(state.status).toEqual(TaskStatus.FINISHED)

    state.cleanup()
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(0)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)

    state.monitor(monitor3)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(0)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)
  })

  it('should initialize with PENDING status', () => {
    expect(state.status).toEqual(TaskStatus.PENDING)
    expect(state.active).toEqual(false)
    expect(state.alive).toEqual(true)
    expect(state.terminated).toEqual(false)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(0)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)
  })

  it('should set status and notify monitors', () => {
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(0)

    const unmonitor1 = state.monitor(monitor1)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(1)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    const unmonitor2 = state.monitor(monitor2)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    state.status = TaskStatus.RUNNING
    expect(state.status).toEqual(TaskStatus.RUNNING)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(1)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(1)
    expect(monitor1.onStatusChange).toHaveBeenCalledWith(TaskStatus.RUNNING, TaskStatus.PENDING)
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(TaskStatus.RUNNING, TaskStatus.PENDING)

    unmonitor1()
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(1)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)

    state.status = TaskStatus.ATTEMPT_SUSPENDING
    expect(state.status).toEqual(TaskStatus.ATTEMPT_SUSPENDING)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(1)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(2)
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(
      TaskStatus.ATTEMPT_SUSPENDING,
      TaskStatus.RUNNING,
    )

    const unmonitor1_1 = state.monitor(monitor1)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    state.status = TaskStatus.SUSPENDED
    expect(state.status).toEqual(TaskStatus.SUSPENDED)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(2)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(3)
    expect(monitor1.onStatusChange).toHaveBeenCalledWith(
      TaskStatus.SUSPENDED,
      TaskStatus.ATTEMPT_SUSPENDING,
    )
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(
      TaskStatus.SUSPENDED,
      TaskStatus.ATTEMPT_SUSPENDING,
    )

    const unmonitor2_1 = state.monitor(monitor2)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    state.status = TaskStatus.ATTEMPT_CANCELING
    expect(state.status).toEqual(TaskStatus.ATTEMPT_CANCELING)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(3)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(4)
    expect(monitor1.onStatusChange).toHaveBeenCalledWith(
      TaskStatus.ATTEMPT_CANCELING,
      TaskStatus.SUSPENDED,
    )
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(
      TaskStatus.ATTEMPT_CANCELING,
      TaskStatus.SUSPENDED,
    )

    const unmonitor3_0 = state.monitor(monitor3)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(2)
    unmonitor3_0()

    state.status = TaskStatus.FINISHED
    expect(state.status).toEqual(TaskStatus.FINISHED)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    const unmonitor3_1 = state.monitor(monitor3)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(4)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(5)
    expect(monitor1.onStatusChange).toHaveBeenCalledWith(
      TaskStatus.FINISHED,
      TaskStatus.ATTEMPT_CANCELING,
    )
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(
      TaskStatus.FINISHED,
      TaskStatus.ATTEMPT_CANCELING,
    )

    unmonitor3_1()
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    unmonitor1_1()
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(1)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)

    state.cleanup()
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(0)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)

    unmonitor2()
    unmonitor2_1()

    expect(monitor1.onAddError).toHaveBeenCalledTimes(0)
    expect(monitor3.onAddError).toHaveBeenCalledTimes(0)
  })

  it('should prevent setting unexpected status', () => {
    expect(getAcceptedTransitions(TaskStatus.CANCELLED)).toEqual([TaskStatus.CANCELLED])
    expect(getAcceptedTransitions(TaskStatus.FAILED)).toEqual([TaskStatus.FAILED])
    expect(getAcceptedTransitions(TaskStatus.FINISHED)).toEqual([TaskStatus.FINISHED])

    expect(getAcceptedTransitions(TaskStatus.PENDING)).toEqual([
      TaskStatus.PENDING,
      TaskStatus.RUNNING,
      TaskStatus.ATTEMPT_CANCELING,
    ])

    expect(getAcceptedTransitions(TaskStatus.RUNNING)).toEqual([
      TaskStatus.RUNNING,
      TaskStatus.FAILED,
      TaskStatus.FINISHED,
      TaskStatus.ATTEMPT_SUSPENDING,
      TaskStatus.ATTEMPT_CANCELING,
      TaskStatus.ATTEMPT_FINISHING,
    ])

    expect(getAcceptedTransitions(TaskStatus.SUSPENDED)).toEqual([
      TaskStatus.SUSPENDED,
      TaskStatus.ATTEMPT_RESUMING,
      TaskStatus.ATTEMPT_CANCELING,
      TaskStatus.ATTEMPT_FINISHING,
    ])

    expect(getAcceptedTransitions(TaskStatus.ATTEMPT_SUSPENDING)).toEqual([
      TaskStatus.SUSPENDED,
      TaskStatus.FAILED,
      TaskStatus.FINISHED,
      TaskStatus.ATTEMPT_SUSPENDING,
      TaskStatus.ATTEMPT_CANCELING,
      TaskStatus.ATTEMPT_FINISHING,
    ])

    expect(getAcceptedTransitions(TaskStatus.ATTEMPT_RESUMING)).toEqual([
      TaskStatus.RUNNING,
      TaskStatus.FAILED,
      TaskStatus.FINISHED,
      TaskStatus.ATTEMPT_RESUMING,
      TaskStatus.ATTEMPT_CANCELING,
      TaskStatus.ATTEMPT_FINISHING,
    ])

    expect(getAcceptedTransitions(TaskStatus.ATTEMPT_CANCELING)).toEqual([
      TaskStatus.CANCELLED,
      TaskStatus.FAILED,
      TaskStatus.FINISHED,
      TaskStatus.ATTEMPT_CANCELING,
    ])

    expect(getAcceptedTransitions(TaskStatus.ATTEMPT_FINISHING)).toEqual([
      TaskStatus.FAILED,
      TaskStatus.FINISHED,
      TaskStatus.ATTEMPT_FINISHING,
    ])
  })
})

function getAcceptedTransitions(from: TaskStatus): TaskStatus[] {
  const state = new TaskStateForTest()
  expect(state.status).toEqual(TaskStatus.PENDING)

  const all: TaskStatus[] = [
    TaskStatus.PENDING,
    TaskStatus.RUNNING,
    TaskStatus.SUSPENDED,
    TaskStatus.CANCELLED,
    TaskStatus.FAILED,
    TaskStatus.FINISHED,
    TaskStatus.ATTEMPT_SUSPENDING,
    TaskStatus.ATTEMPT_RESUMING,
    TaskStatus.ATTEMPT_CANCELING,
    TaskStatus.ATTEMPT_FINISHING,
  ]

  const accepts: TaskStatus[] = []
  for (const status of all) {
    state.forceSetStatusWithoutNotify(from)
    expect([from, state.status]).toEqual([from, from])

    try {
      state.status = status
      expect([from, state.status]).toEqual([from, status])
      accepts.push(status)
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError)
    }
  }
  return accepts
}
