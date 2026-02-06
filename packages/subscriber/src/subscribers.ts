import { SafeBatchHandler } from '@guanghechen/disposable'
import type { ISubscriber, ISubscribers, IUnsubscribable } from '@guanghechen/types'

interface ISubscriberItem<T> {
  readonly subscriber: ISubscriber<T>
  unsubscribed: boolean
}

interface IOptions {
  readonly ARRANGE_THRESHOLD?: number
}

const noopUnsubscribable: IUnsubscribable = { unsubscribe: () => {} }

export class Subscribers<T> implements ISubscribers<T> {
  private readonly ARRANGE_THRESHOLD: number
  private _disposed: boolean
  private _items: Array<ISubscriberItem<T>>
  private _subscribingCount: number

  constructor(options: IOptions = {}) {
    /* c8 ignore next */
    this.ARRANGE_THRESHOLD = options.ARRANGE_THRESHOLD ?? 16
    this._disposed = false
    this._items = []
    this._subscribingCount = 0
  }

  public get size(): number {
    return this._subscribingCount
  }

  public get disposed(): boolean {
    return this._disposed
  }

  public dispose(): void {
    if (this._disposed) return
    this._disposed = true

    const batcher = new SafeBatchHandler()
    const items: Array<ISubscriberItem<T>> = this._items
    for (const item of items) {
      if (item.unsubscribed) continue
      item.unsubscribed = true

      /* c8 ignore next */
      if (item.subscriber.disposed) continue
      batcher.run(() => item.subscriber.dispose())
    }
    items.length = 0
    this._subscribingCount = 0
    batcher.summary('Encountered errors while disposing.')
    batcher.cleanup()
  }

  public notify(value: T, prevValue: T | undefined): void {
    if (this._disposed) return

    const batcher = new SafeBatchHandler()
    const items: Array<ISubscriberItem<T>> = this._items
    for (let i = 0, L = items.length; i < L; ++i) {
      const item = items[i]
      if (item.unsubscribed || item.subscriber.disposed) continue
      batcher.run(() => item.subscriber.next(value, prevValue))
    }
    batcher.summary('Encountered errors while notifying subscribers.')
    batcher.cleanup()
  }

  public subscribe(subscriber: ISubscriber<T>): IUnsubscribable {
    if (subscriber.disposed) return noopUnsubscribable

    if (this.disposed) {
      subscriber.dispose()
      return noopUnsubscribable
    }

    const item: ISubscriberItem<T> = { subscriber, unsubscribed: false }
    this._items.push(item)
    this._subscribingCount += 1

    const unsubscribable: IUnsubscribable = {
      unsubscribe: (): void => {
        if (item.unsubscribed) return
        item.unsubscribed = true
        this._subscribingCount -= 1
        this._arrange()
      },
    }
    return unsubscribable
  }

  private _arrange(): void {
    const items: Array<ISubscriberItem<T>> = this._items
    if (items.length >= this.ARRANGE_THRESHOLD && this._subscribingCount * 2 <= items.length) {
      const nextItems: Array<ISubscriberItem<T>> = []
      for (const item of items) {
        if (item.unsubscribed || item.subscriber.disposed) continue
        nextItems.push(item)
      }
      this._items = nextItems
      this._subscribingCount = nextItems.length
    }
  }
}
