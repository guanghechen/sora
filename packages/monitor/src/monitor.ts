import type { ISubscriber, ISubscribers, IUnsubscribable } from '@guanghechen/subscriber'
import { Subscriber, Subscribers } from '@guanghechen/subscriber'
import type { IMonitor, IMonitorCallback } from './types'

const noop = (): void => {}
const noopUnsubscribable: IUnsubscribable = { unsubscribe: noop }

export class Monitor<P extends any[]> implements IMonitor<P> {
  public readonly name: string
  private readonly _subscribers: ISubscribers<P>

  constructor(name: string) {
    this.name = name
    this._subscribers = new Subscribers<P>()
  }

  public get size(): number {
    return this._subscribers.size
  }

  public get disposed(): boolean {
    return this._subscribers.disposed
  }

  public dispose(): void {
    this._subscribers.dispose()
  }

  public subscribe(callback: IMonitorCallback<P>): IUnsubscribable {
    if (this._subscribers.disposed) return noopUnsubscribable
    const subscriber: ISubscriber<P> = new Subscriber<P>({ onNext: args => callback(...args) })
    return this._subscribers.subscribe(subscriber)
  }

  public notify(...args: P): void {
    if (this._subscribers.disposed) return
    this._subscribers.notify(args, undefined)
  }
}
