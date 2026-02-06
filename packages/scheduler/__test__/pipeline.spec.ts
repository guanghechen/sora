import { Subscriber } from '@guanghechen/subscriber'
import { vi } from 'vitest'
import { Pipeline, PipelineStatusEnum } from '../src'
import type { IMaterialCooker, IMaterialCookerApi, IMaterialCookerNext, IPipeline } from '../src'
import type { IFIleProductData, IFileMaterialData } from './tester/FilePipelineTester'
import { FileChangeTypeEnum, FileMaterialCooker } from './tester/FilePipelineTester'

class InvalidatingCooker implements IMaterialCooker<IFileMaterialData, IFIleProductData> {
  public readonly name: string

  constructor(name: string) {
    this.name = name
  }

  public async cook(
    data: IFileMaterialData,
    embryo: IFIleProductData | null,
    api: IMaterialCookerApi<IFileMaterialData>,
    next: IMaterialCookerNext<IFIleProductData>,
  ): Promise<IFIleProductData | null> {
    if (embryo !== null) return embryo

    const productData: IFIleProductData = { type: data.type, filepaths: [data.filepath] }

    for (const material of api.subsequent()) {
      if (material.data.filepath.startsWith('skip-')) {
        api.invalidate(material)
      }
    }

    return next(productData)
  }
}

const getHandledTicker = (
  pipeline: Pipeline<any, any>,
): {
  _subscribers: { size: number }
  subscribe: (subscriber: Subscriber<number>) => { unsubscribe: () => void }
} =>
  (
    pipeline as unknown as {
      _handledTicker: {
        _subscribers: { size: number }
        subscribe: (subscriber: Subscriber<number>) => { unsubscribe: () => void }
      }
    }
  )._handledTicker

const getHandledSubscriberSize = (pipeline: Pipeline<any, any>): number =>
  getHandledTicker(pipeline)._subscribers.size

describe('pipeline', () => {
  let pipeline: IPipeline<IFileMaterialData, IFIleProductData>

  beforeEach(() => {
    pipeline = new Pipeline('sora-pipeline')
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('should be able to push and pull', async () => {
    expect(pipeline.size).toEqual(0)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.DRIED)

    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    expect(pipeline.size).toEqual(1)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.IDLE)

    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'b' })
    expect(pipeline.size).toEqual(2)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.IDLE)

    const product = await pipeline.pull()
    expect(product).toEqual({ codes: [0, 1], data: null })
    expect(pipeline.size).toEqual(0)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.DRIED)

    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'c' })
    expect(pipeline.size).toEqual(1)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.IDLE)

    await pipeline.close()
    expect(pipeline.size).toEqual(1)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.CLOSED)

    const codeD = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'd' })
    expect(codeD).toEqual(-1)
    expect(pipeline.size).toEqual(1)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.CLOSED)

    const product2 = await pipeline.pull()
    expect(product2).toEqual({ codes: [2], data: null })
    expect(pipeline.size).toEqual(0)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.CLOSED)
  })

  it('should be able to use cooker', async () => {
    pipeline.use(new FileMaterialCooker('sora-cooker'))

    expect(pipeline.size).toEqual(0)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.DRIED)

    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    expect(pipeline.size).toEqual(1)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.IDLE)

    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'b' })
    expect(pipeline.size).toEqual(2)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.IDLE)

    const product = await pipeline.pull()
    expect(product).toEqual({
      codes: [0, 1],
      data: {
        type: FileChangeTypeEnum.CREATE,
        filepaths: ['a', 'b'],
      },
    })
    expect(pipeline.size).toEqual(0)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.DRIED)

    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'c' })
    expect(pipeline.size).toEqual(1)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.IDLE)

    await pipeline.close()
    expect(pipeline.size).toEqual(1)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.CLOSED)

    const codeD = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'd' })
    expect(codeD).toEqual(-1)
    expect(pipeline.size).toEqual(1)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.CLOSED)

    const product2 = await pipeline.pull()
    expect(product2).toEqual({
      codes: [2],
      data: {
        type: FileChangeTypeEnum.CREATE,
        filepaths: ['c'],
      },
    })
    expect(pipeline.size).toEqual(0)
    expect(pipeline.status.getSnapshot()).toEqual(PipelineStatusEnum.CLOSED)
  })
})

describe('pipeline (subsequent and invalidation)', () => {
  let pipeline: IPipeline<IFileMaterialData, IFIleProductData>

  beforeEach(() => {
    pipeline = new Pipeline('sora-pipeline')
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('should iterate over alive materials in subsequent (line 35)', async () => {
    pipeline.use(new InvalidatingCooker('invalidating-cooker'))

    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'skip-b' })
    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'c' })
    expect(pipeline.size).toBe(3)

    const product = await pipeline.pull()
    expect(product.data).toEqual({
      type: FileChangeTypeEnum.CREATE,
      filepaths: ['a'],
    })
    expect(product.codes).toContain(0)

    const product2 = await pipeline.pull()
    expect(product2.data).toEqual({
      type: FileChangeTypeEnum.CREATE,
      filepaths: ['c'],
    })
  })

  it('should skip dead materials at the beginning of pull (line 87)', async () => {
    pipeline.use(new InvalidatingCooker('invalidating-cooker'))

    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'skip-b' })
    await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'skip-c' })
    expect(pipeline.size).toBe(3)

    const product = await pipeline.pull()
    expect(product.data).toEqual({
      type: FileChangeTypeEnum.CREATE,
      filepaths: ['a'],
    })
    expect(product.codes).toEqual([0, 1, 2])
    expect(pipeline.size).toBe(0)
  })
})

describe('pipeline (waitMaterialHandled)', () => {
  let pipeline: Pipeline<IFileMaterialData, IFIleProductData>

  beforeEach(() => {
    pipeline = new Pipeline('sora-pipeline')
    pipeline.use(new FileMaterialCooker('sora-cooker'))
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('should wait for specific material to be handled', async () => {
    const code1 = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    const code2 = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'b' })

    setTimeout(() => {
      void pipeline.pull().then(() => {
        pipeline.notifyMaterialHandled([code1, code2])
      })
    }, 50)

    await pipeline.waitMaterialHandled(code1)
    await pipeline.waitMaterialHandled(code2)
  })

  it('should immediately resolve if material already handled', async () => {
    const code1 = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    await pipeline.pull()
    pipeline.notifyMaterialHandled([code1])

    await pipeline.waitMaterialHandled(code1)
  })

  it('should handle non-sequential codes in handledCodes set', async () => {
    const code1 = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    const code2 = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'b' })
    const code3 = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'c' })

    await pipeline.pull()
    pipeline.notifyMaterialHandled([code3])

    setTimeout(() => {
      pipeline.notifyMaterialHandled([code1, code2])
    }, 50)

    await pipeline.waitMaterialHandled(code3)
    await pipeline.waitAllMaterialsHandledAt(code3)
  })
})

describe('pipeline (waitAllMaterialsHandledAt)', () => {
  let pipeline: Pipeline<IFileMaterialData, IFIleProductData>

  beforeEach(() => {
    pipeline = new Pipeline('sora-pipeline')
    pipeline.use(new FileMaterialCooker('sora-cooker'))
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('should wait for all materials up to code to be handled', async () => {
    const code1 = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    const code2 = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'b' })

    setTimeout(() => {
      void pipeline.pull().then(() => {
        pipeline.notifyMaterialHandled([code1, code2])
      })
    }, 50)

    await pipeline.waitAllMaterialsHandledAt(code2)
  })

  it('should immediately resolve if all materials already handled', async () => {
    const code1 = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    await pipeline.pull()
    pipeline.notifyMaterialHandled([code1])

    await pipeline.waitAllMaterialsHandledAt(code1)
  })
})

describe('pipeline (wait cleanup)', () => {
  let pipeline: Pipeline<IFileMaterialData, IFIleProductData>

  beforeEach(() => {
    pipeline = new Pipeline('sora-pipeline')
    pipeline.use(new FileMaterialCooker('sora-cooker'))
  })

  afterEach(async () => {
    await pipeline.close()
  })

  it('cleans up subscribers after waitMaterialHandled resolves', async () => {
    const code = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    const waitPromise = pipeline.waitMaterialHandled(code)

    await vi.waitFor(() => expect(getHandledSubscriberSize(pipeline)).toBe(1))

    await pipeline.pull()
    pipeline.notifyMaterialHandled([code])
    await waitPromise

    expect(getHandledSubscriberSize(pipeline)).toBe(0)
  })

  it('cleans up when notify throws during waiting', async () => {
    const ticker = getHandledTicker(pipeline)
    let notifiedOnce = false
    const throwSubscriber = new Subscriber<number>({
      onNext: (): void => {
        if (notifiedOnce) throw new Error('boom')
        notifiedOnce = true
      },
    })
    const throwUnsubscribable = ticker.subscribe(throwSubscriber)

    const code = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    const waitPromise = pipeline.waitMaterialHandled(code)
    await vi.waitFor(() => expect(getHandledSubscriberSize(pipeline)).toBe(2))

    await pipeline.pull()
    expect(() => pipeline.notifyMaterialHandled([code])).toThrow()
    await waitPromise

    expect(getHandledSubscriberSize(pipeline)).toBe(1)
    throwUnsubscribable.unsubscribe()
    throwSubscriber.dispose()
    expect(getHandledSubscriberSize(pipeline)).toBe(0)
  })

  it('cleans up after close while waiting', async () => {
    const code = await pipeline.push({ type: FileChangeTypeEnum.CREATE, filepath: 'a' })
    const waitPromise = pipeline.waitMaterialHandled(code)

    await vi.waitFor(() => expect(getHandledSubscriberSize(pipeline)).toBe(1))
    await pipeline.close()
    await pipeline.pull()
    pipeline.notifyMaterialHandled([code])
    await waitPromise

    expect(getHandledSubscriberSize(pipeline)).toBe(0)
    expect(pipeline.status.closed).toBe(true)
  })
})
