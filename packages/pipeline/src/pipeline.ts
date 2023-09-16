import { PipelineStatusEnum } from '@guanghechen/constant'
import { Monitor } from '@guanghechen/monitor'
import { noop } from '@guanghechen/shared'
import type {
  IMonitor,
  IPipeline,
  IPipelineMaterial,
  IPipelineMonitor,
  IPipelineProduct,
  IUnMonitorPipeline,
} from '@guanghechen/types'

type IParametersOfOnClosed = Parameters<Required<IPipelineMonitor>['onClosed']>
type IParametersOfOnPushed = Parameters<Required<IPipelineMonitor>['onPushed']>

export abstract class Pipeline<D, T> implements IPipeline<D, T> {
  protected readonly _materials: Array<IPipelineMaterial<D>>
  protected readonly _monitorClosed: IMonitor<IParametersOfOnClosed>
  protected readonly _monitorPushed: IMonitor<IParametersOfOnPushed>
  private _status: PipelineStatusEnum
  private _code: number

  constructor() {
    this._materials = []
    this._monitorClosed = new Monitor<IParametersOfOnClosed>('onClosed')
    this._monitorPushed = new Monitor<IParametersOfOnPushed>('onPushed')
    this._status = PipelineStatusEnum.ALIVE
    this._code = 0
  }

  public get size(): number {
    return this._materials.length
  }

  public get status(): PipelineStatusEnum {
    return this._status
  }

  public get closed(): boolean {
    return this._status === PipelineStatusEnum.CLOSED
  }

  public async close(): Promise<void> {
    if (this.closed) return

    this._status = PipelineStatusEnum.CLOSED
    this._monitorClosed.notify()

    // cleanup
    this._monitorClosed.destroy()
    this._monitorPushed.destroy()
  }

  public monitor(monitor: Partial<IPipelineMonitor>): IUnMonitorPipeline {
    if (this.closed) {
      monitor.onClosed?.()
      return noop
    }

    const { onClosed, onPushed } = monitor
    const unsubscribeOnClosed = this._monitorClosed.subscribe(onClosed)
    const unsubscribeOnPushed = this._monitorPushed.subscribe(onPushed)

    return (): void => {
      unsubscribeOnClosed()
      unsubscribeOnPushed()
    }
  }

  public async pull(): Promise<IPipelineProduct<T>> {
    const codes: number[] = []

    let cooked: T | undefined
    while (this._materials.length > 0) {
      const material: IPipelineMaterial<D> = this._materials.shift()!
      codes.push(material.code)
      if (material.alive) {
        cooked = await this.cook(material)
        if (cooked !== undefined) break
      }
    }

    while (this._materials.length > 0 && !this._materials[0].alive) {
      const material: IPipelineMaterial<D> = this._materials.shift()!
      codes.push(material.code)
    }

    return { codes, data: cooked }
  }

  public async push(data: D): Promise<number> {
    if (this.closed) return -1

    const code = this._code
    this._code += 1
    this._materials.push({ code, alive: true, data })

    // Notify.
    this._monitorPushed.notify()
    return code
  }

  protected abstract cook(material: IPipelineMaterial<D>): Promise<T | undefined>
}
