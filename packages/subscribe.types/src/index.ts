/**
 * A subscriber can subscribe from a subscribable and will be notified when the subscribed
 * subscribable's state changed.
 */
export interface ISubscriber<T> {
  /**
   * Notify the subscriber to change its state.
   * @param value
   * @param prevValue
   */
  next(value: T, prevValue: T | undefined): void
  /**
   * Notify the subscriber to complete and stop to accept any `.next` calls.
   */
  complete(): void
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
 * A subscribable can be subscribed by subscriber.
 */
export interface ISubscribable<T> {
  /**
   * Subscribe a subscriber, will get notified when the subscriber state changed.
   * @param subscriber
   */
  subscribe(subscriber: ISubscriber<T>): IUnsubscribable
}
