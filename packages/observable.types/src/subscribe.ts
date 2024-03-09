import type { IDisposable } from '@guanghechen/disposable.types'

/**
 * A subscriber can subscribe from a subscribable and will be notified when the subscribed
 * subscribable's state changed.
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
   * Won't get notified from the subscribable after unsubscribed, but it could still not be completed.
   */
  unsubscribe(): void
}

/**
 * A unobservable can be unobserved.
 */
export interface IUnobservable {
  /**
   * Won't get notified from the observable after unobserved, but it could still not be completed.
   */
  unobserve(): void
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
