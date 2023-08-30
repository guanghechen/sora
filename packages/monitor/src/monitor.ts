import { noop } from '@guanghechen/shared'
import type { IMonitor, IMonitorCallback } from '@guanghechen/types'

export class Monitor<P extends any[]> implements IMonitor<P> {
  public readonly name: string
  private _callbacks: Array<IMonitorCallback<P>>
  private _destroyed: boolean
  private _notifying: boolean

  constructor(name: string) {
    this.name = name
    this._callbacks = []
    this._destroyed = false
    this._notifying = false
  }

  public get size(): number {
    return this._callbacks.length
  }

  public get destroyed(): boolean {
    return this._destroyed
  }

  public subscribe(callback: IMonitorCallback<P> | undefined): () => void {
    if (this._destroyed || callback === undefined) return noop

    if (!this._callbacks.includes(callback)) {
      if (this._notifying) this._callbacks = [...this._callbacks, callback]
      else this._callbacks.push(callback)
    }

    return (): void => {
      if (this._notifying) {
        this._callbacks = this._callbacks.filter(cb => cb !== callback)
        return
      }

      const idx: number = this._callbacks.indexOf(callback)
      if (idx >= 0) this._callbacks.splice(idx, 1)
    }
  }

  public notify(...args: P): void {
    if (this._destroyed) return

    const errors: unknown[] = []

    this._notifying = true
    const callbacks = this._callbacks
    for (const cb of callbacks) {
      try {
        cb(...args)
      } catch (error) {
        errors.push(error)
      }
    }
    this._notifying = false

    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) {
      throw new Error(`Multiple errors occurred on monitor(${this.name})`, { cause: errors })
    }
  }

  public destroy(): void {
    if (this._destroyed) return
    this._destroyed = true
    this._callbacks = []
  }
}
