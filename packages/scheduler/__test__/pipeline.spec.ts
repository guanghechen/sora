import { Pipeline, PipelineStatusEnum } from '../src'
import type { IPipeline } from '../src'
import type { IFIleProductData, IFileMaterialData } from './tester/FilePipelineTester'
import { FileChangeTypeEnum, FileMaterialCooker } from './tester/FilePipelineTester'

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
