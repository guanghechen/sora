import type { IDisposable, IUnsubscribable } from '@guanghechen/types'
import type {
  IEvent,
  IEventBus,
  IEventHandler,
  IEventPayload,
  IEventSubscription,
  IEventType,
} from './types'
import { filterInPlace } from './util'

/**
 * A simple event bus implementation with disposable support.
 *
 * Features:
 *  - Supports both type-specific listeners (on/once) and global subscribers (subscribe)
 *  - Returns IUnsubscribable for easy cleanup
 *  - Implements IBatchDisposable for resource management
 *  - Exception isolation: one handler's error won't stop other handlers
 *  - Listeners/subscribers are notified in registration order
 *
 * Note on `once` semantics:
 *  All `once` handlers are removed after each dispatch cycle completes.
 *  If a new `once` handler is registered during dispatch (e.g., inside another handler),
 *  it will also be removed at the end of that dispatch without being called.
 *  Use `on()` + manual `unsubscribe()` if you need more control over handler lifecycle.
 */
export class EventBus<T extends IEventType> implements IEventBus<T> {
  public readonly name: string
  protected _disposed: boolean
  protected _listeners: Map<T, Array<IEventSubscription<T>>>
  protected _subscribers: Array<IEventSubscription<T>>
  protected _disposables: IDisposable[]

  constructor(name: string) {
    this.name = name
    this._disposed = false
    this._listeners = new Map<T, Array<IEventSubscription<T>>>()
    this._subscribers = []
    this._disposables = []
  }

  public get disposed(): boolean {
    return this._disposed
  }

  public dispose(): void {
    if (this._disposed) return
    this._disposed = true

    // Dispose all registered disposables
    const errors: unknown[] = []
    for (const disposable of this._disposables) {
      try {
        disposable.dispose()
      } catch (error) {
        errors.push(error)
      }
    }
    this._disposables.length = 0

    // Cleanup listeners and subscribers
    this._listeners.clear()
    this._subscribers.length = 0

    if (errors.length > 0) {
      throw new AggregateError(errors, 'EventBus dispose encountered errors')
    }
  }

  public registerDisposable<D extends IDisposable>(disposable: D): void {
    if (disposable.disposed) return
    if (this._disposed) {
      disposable.dispose()
    } else {
      this._disposables.push(disposable)
    }
  }

  public on<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    type: T,
    handle: IEventHandler<T, P, E>,
  ): IUnsubscribable {
    return this._addListener(type, handle, false)
  }

  public once<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    type: T,
    handle: IEventHandler<T, P, E>,
  ): IUnsubscribable {
    return this._addListener(type, handle, true)
  }

  public off<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    type: T,
    handle: IEventHandler<T, P, E>,
  ): void {
    this.removeListener(type, handle)
  }

  public removeListener<
    P extends IEventPayload = IEventPayload,
    E extends IEvent<T, P> = IEvent<T, P>,
  >(type: T, handle: IEventHandler<T, P, E>): void {
    const listeners = this._listeners.get(type)
    if (listeners) {
      filterInPlace(listeners, listener => listener.handle !== handle)
    }
  }

  public subscribe<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    handle: IEventHandler<T, P, E>,
    once: boolean = false,
  ): IUnsubscribable {
    // A subscriber can only be registered once
    const existing = this._subscribers.find(subscriber => subscriber.handle === handle)
    if (existing) {
      existing.once = once
      return { unsubscribe: () => this.unsubscribe(handle) }
    }

    this._subscribers.push({ once, handle: handle as IEventHandler<T> })
    return { unsubscribe: () => this.unsubscribe(handle) }
  }

  public unsubscribe<
    P extends IEventPayload = IEventPayload,
    E extends IEvent<T, P> = IEvent<T, P>,
  >(handle: IEventHandler<T, P, E>): void {
    filterInPlace(this._subscribers, subscriber => subscriber.handle !== handle)
  }

  public dispatch<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    evt: Readonly<E>,
  ): void {
    if (this._disposed) return

    const errors: unknown[] = []

    // Trigger subscribers (all events)
    const subscribers = [...this._subscribers]
    for (const subscriber of subscribers) {
      try {
        subscriber.handle(evt, this)
      } catch (error) {
        errors.push(error)
      }
    }
    filterInPlace(this._subscribers, subscriber => !subscriber.once)

    // Trigger listeners (type-specific)
    const listeners = this._listeners.get(evt.type)
    if (listeners) {
      const snapshot = [...listeners]
      for (const listener of snapshot) {
        try {
          listener.handle(evt, this)
        } catch (error) {
          errors.push(error)
        }
      }
      filterInPlace(listeners, listener => !listener.once)
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'EventBus dispatch encountered errors')
    }
  }

  public emit<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    evt: Readonly<E>,
  ): void {
    this.dispatch(evt)
  }

  public listenerCount(type?: T): number {
    if (type !== undefined) {
      const listeners = this._listeners.get(type)
      return listeners ? listeners.length : 0
    }

    let count = this._subscribers.length
    for (const listeners of this._listeners.values()) {
      count += listeners.length
    }
    return count
  }

  public cleanup(): void {
    this._listeners.clear()
    this._subscribers.length = 0
  }

  protected _addListener<
    P extends IEventPayload = IEventPayload,
    E extends IEvent<T, P> = IEvent<T, P>,
  >(type: T, handle: IEventHandler<T, P, E>, once: boolean): IUnsubscribable {
    let listeners = this._listeners.get(type)
    if (!listeners) {
      listeners = []
      this._listeners.set(type, listeners)
    }

    // An event handle can only be registered once per type
    const existing = listeners.find(listener => listener.handle === handle)
    if (existing) {
      existing.once = once
      return { unsubscribe: () => this.removeListener(type, handle) }
    }

    listeners.push({ once, handle: handle as IEventHandler<T> })
    return { unsubscribe: () => this.removeListener(type, handle) }
  }
}
