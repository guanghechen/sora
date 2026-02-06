import { Ticker } from '@guanghechen/observable'
import type { ITicker } from '@guanghechen/observable'
import { Subscriber } from '@guanghechen/subscriber'
import type { ISubscriber, IUnsubscribable } from '@guanghechen/subscriber'
import { PipelineStatusEnum } from './constant'
import { PipelineStatus } from './status'
import type { IMaterialCooker, IMaterialCookerApi, IMaterialCookerNext } from './types/cooker'
import type { IMaterial } from './types/material'
import type { IPipeline, IPipelineStatus } from './types/pipeline'
import type { IProduct } from './types/product'

export class Pipeline<D, T> implements IPipeline<D, T> {
  public readonly name: string
  public readonly status: IPipelineStatus
  protected readonly _materials: Array<IMaterial<D>>
  protected readonly _cookers: Array<IMaterialCooker<D, T>>
  protected readonly _cookerApi: IMaterialCookerApi<D>
  protected readonly _handledCodes: Set<number>
  protected readonly _handledTicker: ITicker
  private _maxContinuousHandledCode: number
  private _code: number

  constructor(name: string) {
    const status: IPipelineStatus = new PipelineStatus()
    const materials: Array<IMaterial<D>> = []
    const cookers: Array<IMaterialCooker<D, T>> = []
    const cookerApi: IMaterialCookerApi<D> = {
      invalidate: (material: IMaterial<D>): void => {
        // eslint-disable-next-line no-param-reassign
        material.alive = false
      },
      subsequent: function* (): IterableIterator<IMaterial<D>> {
        for (const material of materials) {
          if (material.alive) yield material
        }
      },
    }
    const code = 0
    const maxContinuousHandledCode: number = code - 1
    const handledCodes: Set<number> = new Set<number>()
    const handledTicker: ITicker = new Ticker()

    this.name = name
    this.status = status
    this._materials = materials
    this._cookers = cookers
    this._cookerApi = cookerApi
    this._handledCodes = handledCodes
    this._handledTicker = handledTicker
    this._code = code
    this._maxContinuousHandledCode = maxContinuousHandledCode
  }

  public get size(): number {
    return this._materials.length
  }

  public use(cooker: IMaterialCooker<D, T>): this {
    this._cookers.push(cooker)
    return this
  }

  public async close(): Promise<void> {
    if (this.status.disposed) return
    this.status.dispose()
  }

  public async push(data: D): Promise<number> {
    if (this.status.closed) return -1
    this.status.next(PipelineStatusEnum.IDLE, { strict: false })

    // eslint-disable-next-line no-plusplus
    const code = this._code++
    this._materials.push({ code, data, alive: true })
    return code
  }

  public async pull(): Promise<IProduct<T>> {
    const codes: number[] = []
    const materials: Array<IMaterial<D>> = this._materials

    let cooked: T | null = null
    while (materials.length > 0) {
      const material: IMaterial<D> = materials.shift()!
      codes.push(material.code)
      if (material.alive) {
        cooked = await this._cook(material.data)
        if (cooked !== null) break
      }
    }

    while (materials.length > 0 && !materials[0].alive) {
      const material: IMaterial<D> = materials.shift()!
      codes.push(material.code)
    }

    if (materials.length === 0) this.status.next(PipelineStatusEnum.DRIED, { strict: false })
    return { codes, data: cooked }
  }

  public notifyMaterialHandled(codes: Iterable<number>): void {
    const handledCodes: Set<number> = this._handledCodes
    for (const code of codes) handledCodes.add(code)

    // Update maxContinuousHandledCode.
    let maxContinuousHandledCode = this._maxContinuousHandledCode + 1
    while (handledCodes.has(maxContinuousHandledCode)) {
      handledCodes.delete(maxContinuousHandledCode)
      maxContinuousHandledCode += 1
    }
    this._maxContinuousHandledCode = maxContinuousHandledCode - 1

    // Notify that some materials were handled.
    this._handledTicker.tick()
  }

  public async waitMaterialHandled(code: number): Promise<void> {
    if (code <= this._maxContinuousHandledCode || this._handledCodes.has(code)) return

    let resolved = false
    let subscriber: ISubscriber<number> | undefined
    let unsubscribable: IUnsubscribable | undefined
    await new Promise<void>(resolve => {
      subscriber = new Subscriber<number>({
        onNext: () => {
          /* c8 ignore next */
          if (resolved) return
          if (code <= this._maxContinuousHandledCode || this._handledCodes.has(code)) resolve()
        },
      })
      unsubscribable = this._handledTicker.subscribe(subscriber)
    }).finally(() => {
      resolved = true
      unsubscribable?.unsubscribe()
      subscriber?.dispose()
    })
  }

  public async waitAllMaterialsHandledAt(code: number): Promise<void> {
    if (code <= this._maxContinuousHandledCode) return

    let resolved = false
    let subscriber: ISubscriber<number> | undefined
    let unsubscribable: IUnsubscribable | undefined
    await new Promise<void>(resolve => {
      subscriber = new Subscriber<number>({
        onNext: () => {
          /* c8 ignore next */
          if (resolved) return
          if (code <= this._maxContinuousHandledCode) resolve()
        },
      })
      unsubscribable = this._handledTicker.subscribe(subscriber)
    }).finally(() => {
      resolved = true
      unsubscribable?.unsubscribe()
      subscriber?.dispose()
    })
  }

  protected async _cook(data: D): Promise<T | null> {
    const api: IMaterialCookerApi<D> = this._cookerApi
    const reducer: IMaterialCookerNext<T> = this._cookers.reduceRight<IMaterialCookerNext<T>>(
      (next, cooker) => embryo => cooker.cook(data, embryo, api, next),
      async embryo => embryo,
    )
    const result: T | null = await reducer(null)
    return result
  }
}
