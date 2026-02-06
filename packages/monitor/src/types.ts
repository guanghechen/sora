import type { IDisposable, IUnsubscribable } from '@guanghechen/types'

export type IMonitorCallback<P extends any[]> = (...args: P) => void

export interface IMonitor<P extends any[]> extends IDisposable {
  readonly name: string

  readonly size: number

  subscribe(callback: IMonitorCallback<P>): IUnsubscribable

  /**
   * Notify all subscribers.
   * @param args
   */
  notify(...args: P): void
}
