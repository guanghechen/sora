import type { IBatchDisposable, IUnsubscribable } from '@guanghechen/types'

export type IEventType = number | string | symbol
export type IEventPayload = number | boolean | string | symbol | object

export interface IEvent<
  T extends IEventType = IEventType,
  P extends IEventPayload = IEventPayload,
> {
  type: T
  payload?: P
}

export interface IEventHandler<
  T extends IEventType = IEventType,
  P extends IEventPayload = IEventPayload,
  E extends IEvent<T, P> = IEvent<T, P>,
> {
  /**
   * The returned value will be ignored.
   * @param evt
   * @param eventBus
   */
  (evt: Readonly<E>, eventBus: IEventBus<T>): void
}

/**
 * Internal subscription record.
 */
export interface IEventSubscription<
  T extends IEventType = IEventType,
  P extends IEventPayload = IEventPayload,
  E extends IEvent<T, P> = IEvent<T, P>,
> {
  /**
   * If true, will be auto-removed after first called.
   */
  once: boolean
  /**
   * Event handler.
   */
  handle: IEventHandler<T, P, E>
}

export interface IEventBus<T extends IEventType> extends IBatchDisposable {
  /**
   * Listen for a specific event type.
   * @param type
   * @param handle
   * @returns IUnsubscribable to remove the listener
   */
  on<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    type: T,
    handle: IEventHandler<T, P, E>,
  ): IUnsubscribable

  /**
   * Listen for a specific event type, auto-removed after first call.
   * @param type
   * @param handle
   * @returns IUnsubscribable to remove the listener
   */
  once<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    type: T,
    handle: IEventHandler<T, P, E>,
  ): IUnsubscribable

  /**
   * Remove a listener for a specific event type.
   * Alias: removeListener
   * @param type
   * @param handle
   */
  off<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    type: T,
    handle: IEventHandler<T, P, E>,
  ): void

  /**
   * Remove a listener for a specific event type.
   * @param type
   * @param handle
   */
  removeListener<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    type: T,
    handle: IEventHandler<T, P, E>,
  ): void

  /**
   * Subscribe to all event types.
   * @param handle
   * @param once If true, auto-removed after first call. Defaults to false.
   * @returns IUnsubscribable to cancel the subscription
   */
  subscribe<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    handle: IEventHandler<T, P, E>,
    once?: boolean,
  ): IUnsubscribable

  /**
   * Cancel a subscription.
   * @param handle
   */
  unsubscribe<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    handle: IEventHandler<T, P, E>,
  ): void

  /**
   * Dispatch an event to all listeners and subscribers.
   * Alias: emit
   * @param evt
   */
  dispatch<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    evt: Readonly<E>,
  ): void

  /**
   * Dispatch an event to all listeners and subscribers.
   * @param evt
   */
  emit<P extends IEventPayload = IEventPayload, E extends IEvent<T, P> = IEvent<T, P>>(
    evt: Readonly<E>,
  ): void

  /**
   * Get the number of listeners.
   * @param type If provided, count listeners for that type only. Otherwise, count all.
   */
  listenerCount(type?: T): number

  /**
   * Remove all listeners and subscribers.
   */
  cleanup(): void
}
