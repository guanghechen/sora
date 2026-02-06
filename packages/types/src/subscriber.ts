import type { IDisposable } from './disposable'

/**
 * A subscriber can subscribe from a subscribable,
 * and will be notified when the subscribed subscribable's state changed.
 */
export interface ISubscriber<T> extends IDisposable {
  /**
   * Notify the subscriber to change its state.
   * @param value
   * @param prevValue
   */
  next(value: T, prevValue: T | undefined): void
}

/**
 * A unsubscribable can be unsubscribed.
 */
export interface IUnsubscribable {
  /**
   * Won't get notified from the subscribable after unsubscribed,
   * but it could still not be completed.
   */
  unsubscribe(): void
}

/**
 * A subscribable can be subscribed by subscriber.
 */
export interface ISubscribable<T> {
  /**
   * Subscribe a subscriber, will get notified when the subscriber state changed.
   * @param subscriber
   */
  subscribe(subscriber: ISubscriber<T>): IUnsubscribable
}

export interface ISubscribers<T> extends ISubscribable<T>, IDisposable {
  /**
   * The number of subscribers.
   */
  readonly size: number

  /**
   * Notify all subscribers to change their states.
   * @param value
   * @param prevValue
   */
  notify(value: T, prevValue: T | undefined): void
}
