import { PipelineStatusEnum } from '@guanghechen/constant'
import { Monitor } from '@guanghechen/monitor'
import { noop } from '@guanghechen/shared'
import type { IMonitor, IPipeline, IPipelineMonitor, IUnMonitorPipeline } from '@guanghechen/types'

type IParametersOfOnClosed = Parameters<Required<IPipelineMonitor>['onClosed']>
type IParametersOfOnPushed = Parameters<Required<IPipelineMonitor>['onPushed']>

export abstract class Pipeline<D, T> implements IPipeline<D, T> {
  protected readonly _materials: D[]
  protected readonly _monitors: {
    onClosed: IMonitor<IParametersOfOnClosed>
    onPushed: IMonitor<IParametersOfOnPushed>
  }
  private _status: PipelineStatusEnum

  constructor() {
    this._materials = []
    this._monitors = {
      onClosed: new Monitor<IParametersOfOnClosed>('onClosed'),
      onPushed: new Monitor<IParametersOfOnPushed>('onPushed'),
    }
    this._status = PipelineStatusEnum.ALIVE
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
    this._monitors.onClosed.notify()

    // cleanup
    this._monitors.onClosed.destroy()
    this._monitors.onPushed.destroy()
  }

  public monitor(monitor: Partial<IPipelineMonitor>): IUnMonitorPipeline {
    if (this.closed) {
      monitor.onClosed?.()
      return noop
    }

    const { onClosed, onPushed } = monitor
    const unsubscribeOnClosed = this._monitors.onClosed.subscribe(onClosed)
    const unsubscribeOnPushed = this._monitors.onPushed.subscribe(onPushed)

    return (): void => {
      unsubscribeOnClosed()
      unsubscribeOnPushed()
    }
  }

  public async pull(): Promise<T | undefined> {
    while (this._materials.length > 0) {
      const material: D = this._materials.shift()!
      const cooked: T | undefined = await this.cook(material, this._materials)
      if (cooked !== undefined) return cooked
    }
    return undefined
  }

  public async push(material: D): Promise<void> {
    if (this.closed) return

    this._materials.push(material)

    // Notify.
    this._monitors.onPushed.notify()
  }

  protected abstract cook(material: D, others: ReadonlyArray<D>): Promise<T | undefined>
}
