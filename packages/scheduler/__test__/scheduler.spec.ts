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
      level: ReporterLevelEnum.DEBUG,
      flights: {
        colorful: false,
        title: false,
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

  it('complete (pipeline not closed)', async () => {
    await scheduler.complete()
    await pipeline.close()
  })

  it('complete (pipeline has been closed)', async () => {
    await pipeline.close()
    await scheduler.complete()
  })

  it('should be able to schedule and wait', async () => {
    const code1: number = await scheduler.schedule({
      type: FileChangeTypeEnum.CREATE,
      filepath: 'a',
    })
    expect(reporterMock.getIndiscriminateAll()).toEqual([])

    await scheduler.waitTaskTerminated(code1)
    const log1: string = JSON.stringify(reporterMock.getIndiscriminateAll())
    expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "verb  [sora-scheduler] task(create) starting. codes: [0]
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
          "verb  [sora-scheduler] task(create) COMPLETED. codes: 0.
      ",
        ],
      ]
    `)

    const code2: number = await scheduler.schedule({
      type: FileChangeTypeEnum.CREATE,
      filepath: 'b',
    })
    expect(JSON.stringify(reporterMock.getIndiscriminateAll())).toEqual(log1)

    const code3: number = await scheduler.schedule({
      type: FileChangeTypeEnum.CREATE,
      filepath: 'c',
    })
    expect(JSON.stringify(reporterMock.getIndiscriminateAll())).toEqual(log1)

    await scheduler.waitAllScheduledTasksTerminated()
    const log3: string = JSON.stringify(reporterMock.getIndiscriminateAll())
    expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "verb  [sora-scheduler] task(create) starting. codes: [0]
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
          "verb  [sora-scheduler] task(create) COMPLETED. codes: 0.
      ",
        ],
        [
          "verb  [sora-scheduler] task(create) starting. codes: [1, 2]
      ",
        ],
        [
          "[create] run:",
          "create",
          [
            "b",
            "c",
          ],
        ],
        [
          "verb  [sora-scheduler] task(create) COMPLETED. codes: 1, 2.
      ",
        ],
      ]
    `)

    await scheduler.waitTaskTerminated(code2)
    expect(JSON.stringify(reporterMock.getIndiscriminateAll())).toEqual(log3)

    await scheduler.waitTaskTerminated(code3)
    expect(JSON.stringify(reporterMock.getIndiscriminateAll())).toEqual(log3)

    await scheduler.complete()
    expect(JSON.stringify(reporterMock.getIndiscriminateAll())).toEqual(log3)
  })

  it('occur error', async () => {
    await scheduler.schedule({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    await scheduler.schedule({ type: FileChangeTypeEnum.DELETE, filepath: 'b' })

    await scheduler.waitAllScheduledTasksTerminated()
    expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "verb  [sora-scheduler] task(create) starting. codes: [0]
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
          "verb  [sora-scheduler] task(create) COMPLETED. codes: 0.
      ",
        ],
        [
          "verb  [sora-scheduler] task(delete) starting. codes: [1]
      ",
        ],
        [
          "[delete] run:",
          "delete",
          [
            "b",
          ],
        ],
        [
          "verb  [sora-scheduler] task(delete) COMPLETED. codes: 1.
      ",
        ],
      ]
    `)

    await scheduler.schedule({ type: FileChangeTypeEnum.DELETE, filepath: 'non-exist' })
    await expect(scheduler.waitAllScheduledTasksTerminated()).resolves.toBeUndefined()
    expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "verb  [sora-scheduler] task(create) starting. codes: [0]
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
          "verb  [sora-scheduler] task(create) COMPLETED. codes: 0.
      ",
        ],
        [
          "verb  [sora-scheduler] task(delete) starting. codes: [1]
      ",
        ],
        [
          "[delete] run:",
          "delete",
          [
            "b",
          ],
        ],
        [
          "verb  [sora-scheduler] task(delete) COMPLETED. codes: 1.
      ",
        ],
        [
          "verb  [sora-scheduler] task(delete) starting. codes: [2]
      ",
        ],
        [
          "verb  [sora-scheduler] task(delete) FAILED. codes: 2.
      ",
        ],
        [
          "error [sora-scheduler] task(delete) failed. codes: [2]. error: {from:'delete',level:5,details:[{from:'delete',level:5,details:{}}]}
      ",
        ],
      ]
    `)

    await scheduler.schedule({ type: FileChangeTypeEnum.MODIFY, filepath: 'a' })
    await scheduler.waitAllScheduledTasksTerminated()
    expect(reporterMock.getIndiscriminateAll()).toMatchInlineSnapshot(`
      [
        [
          "verb  [sora-scheduler] task(create) starting. codes: [0]
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
          "verb  [sora-scheduler] task(create) COMPLETED. codes: 0.
      ",
        ],
        [
          "verb  [sora-scheduler] task(delete) starting. codes: [1]
      ",
        ],
        [
          "[delete] run:",
          "delete",
          [
            "b",
          ],
        ],
        [
          "verb  [sora-scheduler] task(delete) COMPLETED. codes: 1.
      ",
        ],
        [
          "verb  [sora-scheduler] task(delete) starting. codes: [2]
      ",
        ],
        [
          "verb  [sora-scheduler] task(delete) FAILED. codes: 2.
      ",
        ],
        [
          "error [sora-scheduler] task(delete) failed. codes: [2]. error: {from:'delete',level:5,details:[{from:'delete',level:5,details:{}}]}
      ",
        ],
        [
          "verb  [sora-scheduler] task(modify) starting. codes: [3]
      ",
        ],
        [
          "[modify] run:",
          "modify",
          [
            "a",
          ],
        ],
        [
          "verb  [sora-scheduler] task(modify) COMPLETED. codes: 3.
      ",
        ],
      ]
    `)

    await pipeline.close()
  })
})
