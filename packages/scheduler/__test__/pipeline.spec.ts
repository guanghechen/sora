import { Pipeline } from '../src'
import type { IPipeline } from '../src'

interface IMaterialData {
  readonly type: 'create' | 'modify' | 'delete'
  readonly filepath: string
}

interface IProductData {
  readonly type: 'create' | 'modify' | 'delete'
  readonly filepaths: string[]
}

describe('pipeline', () => {
  let pipeline: IPipeline<IMaterialData, IProductData>

  beforeEach(() => {
    pipeline = new Pipeline('sora')
  })

  afterEach(async () => {
    await pipeline.close()
  })
})
