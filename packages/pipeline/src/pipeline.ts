import type { IMonitor } from '@guanghechen/monitor'
import { Monitor } from '@guanghechen/monitor'
import { PipelineStatus } from './constant'
import type { IPipeline, IPipelineMonitor, IUnMonitorPipeline } from './types'

const noop = (): void => {}

type IParametersOfOnClosed = Parameters<Required<IPipelineMonitor>['onClosed']>
type IParametersOfOnPushed = Parameters<Required<IPipelineMonitor>['onPushed']>

export abstract class Pipeline<D, T> implements IPipeline<D, T> {
  protected readonly _materials: D[]
  protected readonly _monitors: {
    onClosed: IMonitor<IParametersOfOnClosed>
    onPushed: IMonitor<IParametersOfOnPushed>
  }
  private _status: PipelineStatus

  constructor() {
    this._materials = []
    this._monitors = {
      onClosed: new Monitor<IParametersOfOnClosed>('onClosed'),
      onPushed: new Monitor<IParametersOfOnPushed>('onPushed'),
    }
    this._status = PipelineStatus.ALIVE
  }

  public get size(): number {
    return this._materials.length
  }

  public get status(): PipelineStatus {
    return this._status
  }

  public get closed(): boolean {
    return this._status === PipelineStatus.CLOSED
  }

  public close(): void {
    if (this.closed) return

    this._status = PipelineStatus.CLOSED
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
    const unsubscribeOnClosed = onClosed ? this._monitors.onClosed.subscribe(onClosed) : noop
    const unsubscribeOnPushed = onPushed ? this._monitors.onPushed.subscribe(onPushed) : noop

    return (): void => {
      unsubscribeOnClosed()
      unsubscribeOnPushed()
    }
  }

  public pull(): T | undefined {
    while (this._materials.length > 0) {
      const material: D = this._materials.shift()!
      const cooked: T | undefined = this.cook(material, this._materials)
      if (cooked !== undefined) return cooked
    }
    return undefined
  }

  public push(material: D): void {
    if (this.closed) return

    this._materials.push(material)

    // Notify.
    this._monitors.onPushed.notify()
  }

  protected abstract cook(material: D, others: ReadonlyArray<D>): T | undefined
}
