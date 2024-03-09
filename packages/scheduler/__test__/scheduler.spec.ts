// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { chalk } from '@guanghechen/chalk/node'
import type { IReporterMock } from '@guanghechen/helper-jest'
import { createReporterMock } from '@guanghechen/helper-jest'
import type { IReporter } from '@guanghechen/reporter'
import { Reporter, ReporterLevelEnum } from '@guanghechen/reporter'
import { TaskStrategyEnum } from '@guanghechen/task'
import { desensitize } from 'jest.helper'
import { Pipeline, Scheduler } from '../src'
import type { IPipeline, IScheduler } from '../src'
import type { IFIleProductData, IFileMaterialData } from './tester/FilePipelineTester'
import {
  FileChangeTypeEnum,
  FileMaterialCooker,
  FileProductConsumer,
} from './tester/FilePipelineTester'

describe('scheduler', () => {
  let reporter: IReporter
  let reporterMock: IReporterMock
  let pipeline: IPipeline<IFileMaterialData, IFIleProductData>
  let scheduler: IScheduler<IFileMaterialData, IFIleProductData>

  beforeEach(async () => {
    reporter = new Reporter(chalk, {
      level: ReporterLevelEnum.VERBOSE,
      flights: {
        colorful: false,
      },
    })
    reporterMock = createReporterMock({ reporter, desensitize })

    pipeline = new Pipeline<IFileMaterialData, IFIleProductData>('sora-pipeline')
    pipeline.use(new FileMaterialCooker('sora-cooker'))

    scheduler = new Scheduler<IFileMaterialData, IFIleProductData>({
      name: 'sora-scheduler',
      pipeline,
      strategy: TaskStrategyEnum.CONTINUE_ON_ERROR,
      reporter,
      pollInterval: 50,
      idleInterval: 300,
    })
    scheduler.use(new FileProductConsumer('sora-consumer'))
    await scheduler.start()
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it.only(
    'should be able to schedule and wait',
    async () => {
      const code1: number = await scheduler.schedule({
        type: FileChangeTypeEnum.CREATE,
        filepath: 'a',
      })
      expect(reporterMock.getIndiscriminateAll()).toEqual([])

      await scheduler.waitTaskTerminated(code1)
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
        [
          [
            "verb  [] [sora-scheduler] task(create) starting. codes: [0]
        ",
          ],
          [
            "[create] run:",
            "create",
            [
              "a",
            ],
          ],
          [
            "verb  [] [sora-scheduler] task(create) COMPLETED. codes: 0.
        ",
          ],
        ]
      `)

      const code2: number = await scheduler.schedule({
        type: FileChangeTypeEnum.CREATE,
        filepath: 'b',
      })
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
        [
          [
            "verb  [] [sora-scheduler] task(create) starting. codes: [0]
        ",
          ],
          [
            "[create] run:",
            "create",
            [
              "a",
            ],
          ],
          [
            "verb  [] [sora-scheduler] task(create) COMPLETED. codes: 0.
        ",
          ],
        ]
      `)

      const code3: number = await scheduler.schedule({
        type: FileChangeTypeEnum.CREATE,
        filepath: 'c',
      })
      expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
        [
          [
            "verb  [] [sora-scheduler] task(create) starting. codes: [0]
        ",
          ],
          [
            "[create] run:",
            "create",
            [
              "a",
            ],
          ],
          [
            "verb  [] [sora-scheduler] task(create) COMPLETED. codes: 0.
        ",
          ],
        ]
      `)

      // await scheduler.waitAllScheduledTasksTerminated()
      // expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot()
      // await scheduler.waitTaskTerminated(code2)
      // expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot()
      // await scheduler.waitTaskTerminated(code3)
      // expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot()
      // await scheduler.complete()
      // expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot()
    },
    20 * 1000,
  )
})
