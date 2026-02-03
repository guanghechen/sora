import { AtomicTask, type ITask, TaskStrategyEnum } from '@guanghechen/task'
import type {
  IMaterialCooker,
  IMaterialCookerApi,
  IMaterialCookerNext,
  IProductConsumer,
  IProductConsumerApi,
  IProductConsumerNext,
} from '../../src'

export enum FileChangeTypeEnum {
  CREATE = 'create',
  DELETE = 'delete',
  MODIFY = 'modify',
}

export interface IFileMaterialData {
  readonly type: FileChangeTypeEnum
  readonly filepath: string
}

export interface IFIleProductData {
  readonly type: FileChangeTypeEnum
  readonly filepaths: string[]
}

export class FileMaterialCooker implements IMaterialCooker<IFileMaterialData, IFIleProductData> {
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
    switch (data.type) {
      case FileChangeTypeEnum.CREATE:
        for (const material of api.subsequent()) {
          if (material.data.type === FileChangeTypeEnum.CREATE) {
            if (!productData.filepaths.includes(material.data.filepath)) {
              productData.filepaths.push(material.data.filepath)
            }
            api.invalidate(material)
            continue
          }
          if (material.data.type === FileChangeTypeEnum.DELETE) {
            const idx: number = productData.filepaths.indexOf(material.data.filepath)
            if (idx >= 0) {
              productData.filepaths.splice(idx, 1)
              api.invalidate(material)
              continue
            }
            break
          }
          break
        }
        break
      case FileChangeTypeEnum.DELETE:
        for (const material of api.subsequent()) {
          if (material.data.type === FileChangeTypeEnum.CREATE) {
            const idx: number = productData.filepaths.indexOf(material.data.filepath)
            if (idx >= 0) {
              productData.filepaths.splice(idx, 1)
              api.invalidate(material)
              continue
            }
            break
          }
          if (material.data.type === FileChangeTypeEnum.DELETE) {
            if (!productData.filepaths.includes(material.data.filepath)) {
              productData.filepaths.push(material.data.filepath)
            }
            api.invalidate(material)
            continue
          }
          break
        }
        break
      case FileChangeTypeEnum.MODIFY:
        for (const material of api.subsequent()) {
          if (material.data.type === FileChangeTypeEnum.MODIFY) {
            if (!productData.filepaths.includes(material.data.filepath)) {
              productData.filepaths.push(material.data.filepath)
            }
            api.invalidate(material)
            continue
          }
          break
        }
        break
    }
    return next(productData)
  }
}

export class FileProductConsumer implements IProductConsumer<IFIleProductData, ITask> {
  public readonly name: string

  constructor(name: string) {
    this.name = name
  }

  public async consume(
    data: IFIleProductData,
    embryo: ITask | null,
    _api: IProductConsumerApi,
    next: IProductConsumerNext<ITask>,
  ): Promise<ITask | null> {
    if (embryo !== null) return embryo
    const task: ITask = new FileTask(data.type, data)
    return next(task)
  }
}

export class FileTask extends AtomicTask implements ITask {
  protected readonly data: IFIleProductData

  constructor(name: string, data: IFIleProductData) {
    super(name, TaskStrategyEnum.ABORT_ON_ERROR)
    this.data = data
  }

  protected override async run(): Promise<void> {
    const { type, filepaths } = this.data
    if (filepaths.includes('non-exist')) {
      if (type === FileChangeTypeEnum.DELETE || type === FileChangeTypeEnum.MODIFY) {
        throw new Error('file not exist')
      }
    }
    console.log(`[${this.name}] run:`, type, filepaths)
  }
}

export class SlowFileTask extends AtomicTask implements ITask {
  protected readonly data: IFIleProductData
  protected readonly delay: number

  constructor(name: string, data: IFIleProductData, delay: number = 100) {
    super(name, TaskStrategyEnum.ABORT_ON_ERROR)
    this.data = data
    this.delay = delay
  }

  protected override async run(): Promise<void> {
    const { type, filepaths } = this.data
    await new Promise(resolve => setTimeout(resolve, this.delay))
    if (filepaths.includes('non-exist')) {
      if (type === FileChangeTypeEnum.DELETE || type === FileChangeTypeEnum.MODIFY) {
        throw new Error('file not exist')
      }
    }
    console.log(`[${this.name}] slow run:`, type, filepaths)
  }
}

export class SlowFileProductConsumer implements IProductConsumer<IFIleProductData, ITask> {
  public readonly name: string
  private readonly delay: number

  constructor(name: string, delay: number = 50) {
    this.name = name
    this.delay = delay
  }

  public async consume(
    data: IFIleProductData,
    embryo: ITask | null,
    _api: IProductConsumerApi,
    next: IProductConsumerNext<ITask>,
  ): Promise<ITask | null> {
    if (embryo !== null) return embryo
    const task: ITask = new SlowFileTask(data.type, data, this.delay)
    return next(task)
  }
}
