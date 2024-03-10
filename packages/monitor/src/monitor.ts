import { SafeBatchHandler } from '@guanghechen/disposable'
import type { IMonitor, IMonitorCallback } from './types'

const noop = (): void => {}

interface IMonitorSubscriber<P extends any[]> {
  readonly callback: IMonitorCallback<P>
  inactive: boolean
}

export class Monitor<P extends any[]> implements IMonitor<P> {
  public readonly name: string
  private readonly _subscribers: Array<IMonitorSubscriber<P>>
  private _activatedSubscriberCount: number
  private _disposed: boolean

  constructor(name: string) {
    this.name = name
    this._subscribers = []
    this._activatedSubscriberCount = 0
    this._disposed = false
  }

  public get size(): number {
    return this._activatedSubscriberCount
  }

  public get disposed(): boolean {
    return this._disposed
  }

  public dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._activatedSubscriberCount = 0

    for (const subscriber of this._subscribers) subscriber.inactive = true
    this._subscribers.length = 0
  }

  public subscribe(callback: IMonitorCallback<P>): () => void {
    if (this._disposed) return noop

    const subscriber: IMonitorSubscriber<P> = { callback, inactive: false }
    this._subscribers.push(subscriber)
    this._activatedSubscriberCount += 1

    return (): void => {
      if (subscriber.inactive) return
      subscriber.inactive = true
      this._activatedSubscriberCount -= 1

      /* c8 ignore start */
      // Optimiation: remove inactive subscribers.
      if (
        this._activatedSubscriberCount > 8 &&
        this._activatedSubscriberCount * 2 < this._subscribers.length
      ) {
        let L = 0
        for (let k = 0; k < this._subscribers.length; ++k) {
          const subscriber = this._subscribers[k]
          if (subscriber.inactive) continue

          // eslint-disable-next-line no-plusplus
          this._subscribers[L++] = subscriber
        }
        this._subscribers.length = L + 1
      }
      /* c8 ignore stop */
    }
  }

  public notify(...args: P): void {
    if (this._disposed) return

    const subscribers = this._subscribers
    const batcher = new SafeBatchHandler()

    const size: number = subscribers.length
    for (let i = 0; i < size; i++) {
      const subscriber: IMonitorSubscriber<P> = subscribers[i]
      if (subscriber.inactive) continue
      batcher.run(() => subscriber.callback(...args))
    }

    batcher.summary(`[monitor ${this.name}] Encountered errors while notifying subscribers.`)
    batcher.cleanup()
  }
}
