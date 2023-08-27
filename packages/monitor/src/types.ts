export type IMonitorCallback<P extends any[]> = (...args: P) => void
export type IMonitorUnsubscribe = () => void

export interface IMonitor<P extends any[]> {
  readonly name: string

  readonly size: number

  readonly destroyed: boolean

  subscribe(callback: IMonitorCallback<P>): IMonitorUnsubscribe

  notify(...args: P): void

  destroy(): void
}
