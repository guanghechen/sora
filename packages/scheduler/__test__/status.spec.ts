import { PipelineStatusEnum } from '../src/constant'
import { PipelineStatusTester } from './tester/PipelineStatusTester'

new PipelineStatusTester(PipelineStatusEnum.IDLE)
  .testTransitions(
    [1, PipelineStatusEnum.IDLE],
    [1, PipelineStatusEnum.DRIED],
    [1, PipelineStatusEnum.CLOSED],
  )
  .testClose(false)
  .buildTest()

new PipelineStatusTester(PipelineStatusEnum.DRIED)
  .testTransitions(
    [1, PipelineStatusEnum.IDLE],
    [1, PipelineStatusEnum.DRIED],
    [1, PipelineStatusEnum.CLOSED],
  )
  .testClose(false)
  .buildTest()

new PipelineStatusTester(PipelineStatusEnum.CLOSED)
  .testTransitions(
    [0, PipelineStatusEnum.IDLE],
    [0, PipelineStatusEnum.DRIED],
    [1, PipelineStatusEnum.CLOSED],
  )
  .testClose(true)
  .buildTest()
