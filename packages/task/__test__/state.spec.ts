import { jest } from '@jest/globals'
import type { ITaskMonitor } from '../src'
import { TaskState, TaskStatusEnum } from '../src'

class TaskStateForTest extends TaskState {
  constructor() {
    super('taskStateForTest')
  }

  public forceSetStatusWithoutNotify(status: TaskStatusEnum): void {
    ;(this as any)._status = status
  }

  public get sizeOfOnStatusChangeMonitor(): number {
    return (this as any)._monitorStatusChange.size
  }

  public get sizeOfOnAddErrorMonitor(): number {
    return (this as any)._monitorAddError.size
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
    expect(state.status).toEqual(TaskStatusEnum.PENDING)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(0)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)

    state.monitor(monitor1)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(1)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    state.monitor(monitor2)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    expect(state.status).toEqual(TaskStatusEnum.PENDING)
    expect(() => state.cleanup()).toThrow(/is not terminated/)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    state.forceSetStatusWithoutNotify(TaskStatusEnum.FINISHED)
    expect(state.status).toEqual(TaskStatusEnum.FINISHED)

    state.cleanup()
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(0)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)

    state.monitor(monitor3)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(0)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)
  })

  it('should initialize with PENDING status', () => {
    expect(state.status).toEqual(TaskStatusEnum.PENDING)
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

    state.status = TaskStatusEnum.RUNNING
    expect(state.status).toEqual(TaskStatusEnum.RUNNING)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(1)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(1)
    expect(monitor1.onStatusChange).toHaveBeenCalledWith(
      TaskStatusEnum.RUNNING,
      TaskStatusEnum.PENDING,
    )
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(
      TaskStatusEnum.RUNNING,
      TaskStatusEnum.PENDING,
    )

    unmonitor1()
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(1)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(0)

    state.status = TaskStatusEnum.ATTEMPT_SUSPENDING
    expect(state.status).toEqual(TaskStatusEnum.ATTEMPT_SUSPENDING)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(1)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(2)
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(
      TaskStatusEnum.ATTEMPT_SUSPENDING,
      TaskStatusEnum.RUNNING,
    )

    const unmonitor1_1 = state.monitor(monitor1)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    state.status = TaskStatusEnum.SUSPENDED
    expect(state.status).toEqual(TaskStatusEnum.SUSPENDED)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(2)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(3)
    expect(monitor1.onStatusChange).toHaveBeenCalledWith(
      TaskStatusEnum.SUSPENDED,
      TaskStatusEnum.ATTEMPT_SUSPENDING,
    )
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(
      TaskStatusEnum.SUSPENDED,
      TaskStatusEnum.ATTEMPT_SUSPENDING,
    )

    const unmonitor2_1 = state.monitor(monitor2)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    state.status = TaskStatusEnum.ATTEMPT_CANCELING
    expect(state.status).toEqual(TaskStatusEnum.ATTEMPT_CANCELING)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(3)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(4)
    expect(monitor1.onStatusChange).toHaveBeenCalledWith(
      TaskStatusEnum.ATTEMPT_CANCELING,
      TaskStatusEnum.SUSPENDED,
    )
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(
      TaskStatusEnum.ATTEMPT_CANCELING,
      TaskStatusEnum.SUSPENDED,
    )

    const unmonitor3_0 = state.monitor(monitor3)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(2)
    unmonitor3_0()

    state.status = TaskStatusEnum.FINISHED
    expect(state.status).toEqual(TaskStatusEnum.FINISHED)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)

    const unmonitor3_1 = state.monitor(monitor3)
    expect(state.sizeOfOnStatusChangeMonitor).toEqual(2)
    expect(state.sizeOfOnAddErrorMonitor).toEqual(1)
    expect(monitor1.onStatusChange).toHaveBeenCalledTimes(4)
    expect(monitor2.onStatusChange).toHaveBeenCalledTimes(5)
    expect(monitor1.onStatusChange).toHaveBeenCalledWith(
      TaskStatusEnum.FINISHED,
      TaskStatusEnum.ATTEMPT_CANCELING,
    )
    expect(monitor2.onStatusChange).toHaveBeenCalledWith(
      TaskStatusEnum.FINISHED,
      TaskStatusEnum.ATTEMPT_CANCELING,
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
    expect(getAcceptedTransitions(TaskStatusEnum.CANCELLED)).toEqual([TaskStatusEnum.CANCELLED])
    expect(getAcceptedTransitions(TaskStatusEnum.FAILED)).toEqual([TaskStatusEnum.FAILED])
    expect(getAcceptedTransitions(TaskStatusEnum.FINISHED)).toEqual([TaskStatusEnum.FINISHED])

    expect(getAcceptedTransitions(TaskStatusEnum.PENDING)).toEqual([
      TaskStatusEnum.PENDING,
      TaskStatusEnum.RUNNING,
      TaskStatusEnum.ATTEMPT_CANCELING,
    ])

    expect(getAcceptedTransitions(TaskStatusEnum.RUNNING)).toEqual([
      TaskStatusEnum.RUNNING,
      TaskStatusEnum.FAILED,
      TaskStatusEnum.FINISHED,
      TaskStatusEnum.ATTEMPT_SUSPENDING,
      TaskStatusEnum.ATTEMPT_CANCELING,
      TaskStatusEnum.ATTEMPT_FINISHING,
    ])

    expect(getAcceptedTransitions(TaskStatusEnum.SUSPENDED)).toEqual([
      TaskStatusEnum.SUSPENDED,
      TaskStatusEnum.ATTEMPT_RESUMING,
      TaskStatusEnum.ATTEMPT_CANCELING,
      TaskStatusEnum.ATTEMPT_FINISHING,
    ])

    expect(getAcceptedTransitions(TaskStatusEnum.ATTEMPT_SUSPENDING)).toEqual([
      TaskStatusEnum.SUSPENDED,
      TaskStatusEnum.FAILED,
      TaskStatusEnum.FINISHED,
      TaskStatusEnum.ATTEMPT_SUSPENDING,
      TaskStatusEnum.ATTEMPT_CANCELING,
      TaskStatusEnum.ATTEMPT_FINISHING,
    ])

    expect(getAcceptedTransitions(TaskStatusEnum.ATTEMPT_RESUMING)).toEqual([
      TaskStatusEnum.RUNNING,
      TaskStatusEnum.FAILED,
      TaskStatusEnum.FINISHED,
      TaskStatusEnum.ATTEMPT_RESUMING,
      TaskStatusEnum.ATTEMPT_CANCELING,
      TaskStatusEnum.ATTEMPT_FINISHING,
    ])

    expect(getAcceptedTransitions(TaskStatusEnum.ATTEMPT_CANCELING)).toEqual([
      TaskStatusEnum.CANCELLED,
      TaskStatusEnum.FAILED,
      TaskStatusEnum.FINISHED,
      TaskStatusEnum.ATTEMPT_CANCELING,
    ])

    expect(getAcceptedTransitions(TaskStatusEnum.ATTEMPT_FINISHING)).toEqual([
      TaskStatusEnum.FAILED,
      TaskStatusEnum.FINISHED,
      TaskStatusEnum.ATTEMPT_FINISHING,
    ])
  })
})

function getAcceptedTransitions(from: TaskStatusEnum): TaskStatusEnum[] {
  const state = new TaskStateForTest()
  expect(state.status).toEqual(TaskStatusEnum.PENDING)

  const all: TaskStatusEnum[] = [
    TaskStatusEnum.PENDING,
    TaskStatusEnum.RUNNING,
    TaskStatusEnum.SUSPENDED,
    TaskStatusEnum.CANCELLED,
    TaskStatusEnum.FAILED,
    TaskStatusEnum.FINISHED,
    TaskStatusEnum.ATTEMPT_SUSPENDING,
    TaskStatusEnum.ATTEMPT_RESUMING,
    TaskStatusEnum.ATTEMPT_CANCELING,
    TaskStatusEnum.ATTEMPT_FINISHING,
  ]

  const accepts: TaskStatusEnum[] = []
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
