import { TaskStatusEnum } from '../src'
import { TaskStatusTester } from './tester/TaskStatusTester'

new TaskStatusTester(TaskStatusEnum.PENDING)
  .testTransitions(
    [1, TaskStatusEnum.PENDING],
    [1, TaskStatusEnum.RUNNING],
    [0, TaskStatusEnum.SUSPENDED],
    [1, TaskStatusEnum.CANCELLED],
    [0, TaskStatusEnum.FAILED],
    [0, TaskStatusEnum.COMPLETED],
    [0, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [0, TaskStatusEnum.ATTEMPT_RESUMING],
    [1, TaskStatusEnum.ATTEMPT_CANCELING],
    [0, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(true)
  .testTerminated(false)
  .buildTest()

new TaskStatusTester(TaskStatusEnum.RUNNING)
  .testTransitions(
    [0, TaskStatusEnum.PENDING],
    [1, TaskStatusEnum.RUNNING],
    [1, TaskStatusEnum.SUSPENDED],
    [1, TaskStatusEnum.CANCELLED],
    [1, TaskStatusEnum.FAILED],
    [1, TaskStatusEnum.COMPLETED],
    [1, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [0, TaskStatusEnum.ATTEMPT_RESUMING],
    [1, TaskStatusEnum.ATTEMPT_CANCELING],
    [1, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(true)
  .testTerminated(false)
  .buildTest()

new TaskStatusTester(TaskStatusEnum.SUSPENDED)
  .testTransitions(
    [0, TaskStatusEnum.PENDING],
    [1, TaskStatusEnum.RUNNING],
    [1, TaskStatusEnum.SUSPENDED],
    [1, TaskStatusEnum.CANCELLED],
    [1, TaskStatusEnum.FAILED],
    [1, TaskStatusEnum.COMPLETED],
    [0, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [1, TaskStatusEnum.ATTEMPT_RESUMING],
    [1, TaskStatusEnum.ATTEMPT_CANCELING],
    [1, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(true)
  .testTerminated(false)
  .buildTest()

new TaskStatusTester(TaskStatusEnum.CANCELLED)
  .testTransitions(
    [0, TaskStatusEnum.PENDING],
    [0, TaskStatusEnum.RUNNING],
    [0, TaskStatusEnum.SUSPENDED],
    [1, TaskStatusEnum.CANCELLED],
    [0, TaskStatusEnum.FAILED],
    [0, TaskStatusEnum.COMPLETED],
    [0, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [0, TaskStatusEnum.ATTEMPT_RESUMING],
    [0, TaskStatusEnum.ATTEMPT_CANCELING],
    [0, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(false)
  .testTerminated(true)
  .buildTest()

new TaskStatusTester(TaskStatusEnum.FAILED)
  .testTransitions(
    [0, TaskStatusEnum.PENDING],
    [0, TaskStatusEnum.RUNNING],
    [0, TaskStatusEnum.SUSPENDED],
    [0, TaskStatusEnum.CANCELLED],
    [1, TaskStatusEnum.FAILED],
    [0, TaskStatusEnum.COMPLETED],
    [0, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [0, TaskStatusEnum.ATTEMPT_RESUMING],
    [0, TaskStatusEnum.ATTEMPT_CANCELING],
    [0, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(false)
  .testTerminated(true)
  .buildTest()

new TaskStatusTester(TaskStatusEnum.COMPLETED)
  .testTransitions(
    [0, TaskStatusEnum.PENDING],
    [0, TaskStatusEnum.RUNNING],
    [0, TaskStatusEnum.SUSPENDED],
    [0, TaskStatusEnum.CANCELLED],
    [0, TaskStatusEnum.FAILED],
    [1, TaskStatusEnum.COMPLETED],
    [0, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [0, TaskStatusEnum.ATTEMPT_RESUMING],
    [0, TaskStatusEnum.ATTEMPT_CANCELING],
    [0, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(false)
  .testTerminated(true)
  .buildTest()

new TaskStatusTester(TaskStatusEnum.ATTEMPT_SUSPENDING)
  .testTransitions(
    [0, TaskStatusEnum.PENDING],
    [0, TaskStatusEnum.RUNNING],
    [1, TaskStatusEnum.SUSPENDED],
    [1, TaskStatusEnum.CANCELLED],
    [1, TaskStatusEnum.FAILED],
    [1, TaskStatusEnum.COMPLETED],
    [1, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [0, TaskStatusEnum.ATTEMPT_RESUMING],
    [1, TaskStatusEnum.ATTEMPT_CANCELING],
    [1, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(true)
  .testTerminated(false)
  .buildTest()

new TaskStatusTester(TaskStatusEnum.ATTEMPT_RESUMING)
  .testTransitions(
    [0, TaskStatusEnum.PENDING],
    [1, TaskStatusEnum.RUNNING],
    [0, TaskStatusEnum.SUSPENDED],
    [1, TaskStatusEnum.CANCELLED],
    [1, TaskStatusEnum.FAILED],
    [1, TaskStatusEnum.COMPLETED],
    [0, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [1, TaskStatusEnum.ATTEMPT_RESUMING],
    [1, TaskStatusEnum.ATTEMPT_CANCELING],
    [1, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(true)
  .testTerminated(false)
  .buildTest()

new TaskStatusTester(TaskStatusEnum.ATTEMPT_CANCELING)
  .testTransitions(
    [0, TaskStatusEnum.PENDING],
    [0, TaskStatusEnum.RUNNING],
    [0, TaskStatusEnum.SUSPENDED],
    [1, TaskStatusEnum.CANCELLED],
    [1, TaskStatusEnum.FAILED],
    [1, TaskStatusEnum.COMPLETED],
    [0, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [0, TaskStatusEnum.ATTEMPT_RESUMING],
    [1, TaskStatusEnum.ATTEMPT_CANCELING],
    [0, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(true)
  .testTerminated(false)
  .buildTest()

new TaskStatusTester(TaskStatusEnum.ATTEMPT_COMPLETING)
  .testTransitions(
    [0, TaskStatusEnum.PENDING],
    [0, TaskStatusEnum.RUNNING],
    [0, TaskStatusEnum.SUSPENDED],
    [1, TaskStatusEnum.CANCELLED],
    [1, TaskStatusEnum.FAILED],
    [1, TaskStatusEnum.COMPLETED],
    [0, TaskStatusEnum.ATTEMPT_SUSPENDING],
    [0, TaskStatusEnum.ATTEMPT_RESUMING],
    [0, TaskStatusEnum.ATTEMPT_CANCELING],
    [1, TaskStatusEnum.ATTEMPT_COMPLETING],
  )
  .testAlive(true)
  .testTerminated(false)
  .buildTest()
