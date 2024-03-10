import type { IDisposable } from '@guanghechen/disposable'

export type IMonitorCallback<P extends any[]> = (...args: P) => void
export type IMonitorUnsubscribe = () => void

export interface IMonitor<P extends any[]> extends IDisposable {
  readonly name: string

  readonly size: number

  subscribe(callback: IMonitorCallback<P>): IMonitorUnsubscribe

  /**
   * Notify all subscribers.
   * @param args
   */
  notify(...args: P): void
}
