import { Reporter } from '@guanghechen/reporter'
import { TaskStatusEnum, TaskStrategyEnum } from '@guanghechen/task'
import { vi } from 'vitest'
import type { IReporterMock } from 'vitest.helper'
import { createReporterMock, desensitize } from 'vitest.helper'
import { Pipeline, Scheduler } from '../src'
import type { IPipeline, IScheduler } from '../src'
import type { IFIleProductData, IFileMaterialData } from './tester/FilePipelineTester'
import {
  FileChangeTypeEnum,
  FileMaterialCooker,
  FileProductConsumer,
  SlowFileProductConsumer,
} from './tester/FilePipelineTester'

describe('scheduler', () => {
  let reporter: Reporter
  let reporterMock: IReporterMock
  let pipeline: IPipeline<IFileMaterialData, IFIleProductData>
  let scheduler: IScheduler<IFileMaterialData, IFIleProductData>

  beforeEach(async () => {
    reporter = new Reporter({
      prefix: 'sora-scheduler',
      level: 'debug',
      flight: { color: false },
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
    reporterMock.restore()
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
    expect(reporterMock.getIndiscriminateAll().length).toBeGreaterThan(0)

    const code2: number = await scheduler.schedule({
      type: FileChangeTypeEnum.CREATE,
      filepath: 'b',
    })

    const code3: number = await scheduler.schedule({
      type: FileChangeTypeEnum.CREATE,
      filepath: 'c',
    })

    await scheduler.waitAllScheduledTasksTerminated()
    await scheduler.waitTaskTerminated(code2)
    await scheduler.waitTaskTerminated(code3)

    await scheduler.complete()
  })

  it('occur error', async () => {
    await scheduler.schedule({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    await scheduler.schedule({ type: FileChangeTypeEnum.DELETE, filepath: 'b' })

    await scheduler.waitAllScheduledTasksTerminated()

    await scheduler.schedule({ type: FileChangeTypeEnum.DELETE, filepath: 'non-exist' })
    await expect(scheduler.waitAllScheduledTasksTerminated()).resolves.toBeUndefined()

    await scheduler.schedule({ type: FileChangeTypeEnum.MODIFY, filepath: 'a' })
    await scheduler.waitAllScheduledTasksTerminated()

    await pipeline.close()
  })
})

describe('scheduler (ABORT_ON_ERROR)', () => {
  let reporter: Reporter
  let pipeline: Pipeline<IFileMaterialData, IFIleProductData>
  let scheduler: Scheduler<IFileMaterialData, IFIleProductData>

  beforeEach(async () => {
    reporter = new Reporter({
      prefix: 'sora-scheduler',
      level: 'debug',
      flight: { color: false },
    })

    pipeline = new Pipeline<IFileMaterialData, IFIleProductData>('sora-pipeline')
    pipeline.use(new FileMaterialCooker('sora-cooker'))

    scheduler = new Scheduler<IFileMaterialData, IFIleProductData>({
      name: 'sora-scheduler',
      pipeline,
      strategy: TaskStrategyEnum.ABORT_ON_ERROR,
      reporter,
      pollInterval: 10,
      idleInterval: 10,
    })
    scheduler.use(new FileProductConsumer('sora-consumer'))
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('should throw error on ABORT_ON_ERROR strategy (line 205)', async () => {
    await scheduler.start()
    await scheduler.schedule({ type: FileChangeTypeEnum.DELETE, filepath: 'non-exist' })

    await scheduler.waitAllScheduledTasksTerminated()

    expect(scheduler.errors.length).toBeGreaterThan(0)
    expect(scheduler.status.getSnapshot()).toBe(TaskStatusEnum.FAILED)
  })
})

describe('scheduler (schedule after terminated)', () => {
  let reporter: Reporter
  let pipeline: IPipeline<IFileMaterialData, IFIleProductData>
  let scheduler: IScheduler<IFileMaterialData, IFIleProductData>

  beforeEach(async () => {
    reporter = new Reporter({
      prefix: 'sora-scheduler',
      level: 'debug',
      flight: { color: false },
    })

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

  it('should return -1 when scheduling after terminated (line 97-99)', async () => {
    await scheduler.complete()
    const code = await scheduler.schedule({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    expect(code).toBe(-1)
  })

  it('waitAllScheduledTasksTerminated with no scheduled tasks', async () => {
    await expect(scheduler.waitAllScheduledTasksTerminated()).resolves.toBeUndefined()
    await scheduler.complete()
  })
})

describe('scheduler (no consumer)', () => {
  let reporter: Reporter
  let pipeline: Pipeline<IFileMaterialData, IFIleProductData>
  let scheduler: Scheduler<IFileMaterialData, IFIleProductData>

  beforeEach(() => {
    reporter = new Reporter({
      prefix: 'sora-scheduler',
      level: 'debug',
      flight: { color: false },
    })

    pipeline = new Pipeline<IFileMaterialData, IFIleProductData>('sora-pipeline')
    pipeline.use(new FileMaterialCooker('sora-cooker'))

    scheduler = new Scheduler<IFileMaterialData, IFIleProductData>({
      name: 'sora-scheduler',
      pipeline,
      strategy: TaskStrategyEnum.CONTINUE_ON_ERROR,
      reporter,
      pollInterval: 10,
      idleInterval: 10,
    })
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('should delay when no consumer returns task (line 13, 153)', async () => {
    await scheduler.start()
    await scheduler.schedule({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })

    await vi.waitFor(() => expect(pipeline.size).toBe(0), { timeout: 1000 })

    await pipeline.close()
  })
})

describe('scheduler (pipeline closed with remaining materials)', () => {
  let reporter: Reporter
  let pipeline: Pipeline<IFileMaterialData, IFIleProductData>
  let scheduler: Scheduler<IFileMaterialData, IFIleProductData>

  beforeEach(() => {
    reporter = new Reporter({
      prefix: 'sora-scheduler',
      level: 'debug',
      flight: { color: false },
    })

    pipeline = new Pipeline<IFileMaterialData, IFIleProductData>('sora-pipeline')
    pipeline.use(new FileMaterialCooker('sora-cooker'))

    scheduler = new Scheduler<IFileMaterialData, IFIleProductData>({
      name: 'sora-scheduler',
      pipeline,
      strategy: TaskStrategyEnum.CONTINUE_ON_ERROR,
      reporter,
      pollInterval: 10,
      idleInterval: 10,
    })
    scheduler.use(new FileProductConsumer('sora-consumer'))
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('should process remaining materials after pipeline closed (line 129-131)', async () => {
    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    await pipeline.push({ type: FileChangeTypeEnum.MODIFY, filepath: 'b' })
    await pipeline.close()

    expect(pipeline.size).toBe(2)
    expect(pipeline.status.closed).toBe(true)

    await scheduler.start()

    await vi.waitFor(() => expect(pipeline.size).toBe(0), { timeout: 1000 })
  })
})

describe('scheduler (task not terminated during pull)', () => {
  let reporter: Reporter
  let pipeline: IPipeline<IFileMaterialData, IFIleProductData>
  let scheduler: IScheduler<IFileMaterialData, IFIleProductData>

  beforeEach(async () => {
    reporter = new Reporter({
      prefix: 'sora-scheduler',
      level: 'debug',
      flight: { color: false },
    })

    pipeline = new Pipeline<IFileMaterialData, IFIleProductData>('sora-pipeline')
    pipeline.use(new FileMaterialCooker('sora-cooker'))

    scheduler = new Scheduler<IFileMaterialData, IFIleProductData>({
      name: 'sora-scheduler',
      pipeline,
      strategy: TaskStrategyEnum.CONTINUE_ON_ERROR,
      reporter,
      pollInterval: 10,
      idleInterval: 10,
    })
    scheduler.use(new SlowFileProductConsumer('sora-slow-consumer'))
    await scheduler.start()
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('should complete previous task before pulling new one (line 137-138)', async () => {
    const code1 = await scheduler.schedule({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    const code2 = await scheduler.schedule({ type: FileChangeTypeEnum.CREATE, filepath: 'b' })

    await scheduler.waitTaskTerminated(code1)
    await scheduler.waitTaskTerminated(code2)
    await scheduler.complete()
  })
})

describe('scheduler status changes', () => {
  let reporter: Reporter
  let pipeline: IPipeline<IFileMaterialData, IFIleProductData>
  let scheduler: Scheduler<IFileMaterialData, IFIleProductData>

  beforeEach(async () => {
    reporter = new Reporter({
      prefix: 'sora-scheduler',
      level: 'debug',
      flight: { color: false },
    })

    pipeline = new Pipeline<IFileMaterialData, IFIleProductData>('sora-pipeline')
    pipeline.use(new FileMaterialCooker('sora-cooker'))

    scheduler = new Scheduler<IFileMaterialData, IFIleProductData>({
      name: 'sora-scheduler',
      pipeline,
      strategy: TaskStrategyEnum.CONTINUE_ON_ERROR,
      reporter,
      pollInterval: 5,
      idleInterval: 5,
    })
    scheduler.use(new SlowFileProductConsumer('sora-slow-consumer', 500))
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('should handle pause/resume on task (line 57, 61-62)', async () => {
    await scheduler.start()
    await scheduler.schedule({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })

    // Wait for task to be picked up by scheduler
    await vi.waitFor(() => expect(pipeline.size).toBe(0), { timeout: 1000 })

    await scheduler.pause()

    await vi.waitFor(
      () =>
        expect([TaskStatusEnum.SUSPENDED, TaskStatusEnum.ATTEMPT_SUSPENDING]).toContain(
          scheduler.status.getSnapshot(),
        ),
      { timeout: 1000 },
    )

    await scheduler.resume()

    await scheduler.complete()
  }, 10000)

  it('should handle cancel on task', async () => {
    await scheduler.start()
    await scheduler.schedule({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })

    // Wait for task to be picked up by scheduler
    await vi.waitFor(() => expect(pipeline.size).toBe(0), { timeout: 1000 })

    await scheduler.cancel()
    expect(scheduler.status.getSnapshot()).toBe(TaskStatusEnum.CANCELLED)
  })

  it('should handle complete on task (line 70-71)', async () => {
    await scheduler.start()
    await scheduler.schedule({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })

    // Wait for task to be picked up by scheduler
    await vi.waitFor(() => expect(pipeline.size).toBe(0), { timeout: 1000 })

    scheduler.status.next(TaskStatusEnum.ATTEMPT_COMPLETING)

    await scheduler.complete()
  })
})
