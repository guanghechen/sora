import type { IBaseObservable, IObservable, IObservableNextOptions } from './observable'

/**
 * A unobservable can be unobserved.
 */
export interface IUnobservable {
  /**
   * Won't get notified from the observable after unobserved, but it could still not be completed.
   */
  unobserve(): void
}

export interface ITickerOptions {
  /**
   * The initial value of the ticker.
   */
  readonly start?: number
  /**
   * Delay before notifying subscribers. (milliseconds)
   */
  readonly delay?: number
}

export interface ITickerObserveOptions {
  /**
   * Whether to throw an error if the observable disposed.
   * @default true
   */
  readonly strict?: boolean
}

export interface ITicker extends IObservable<number> {
  /**
   * Trigger the ticker to update the value.
   */
  tick(options?: IObservableNextOptions): void

  /**
   * Subscribe the change of an observable.
   * @param observable
   * @param options
   */
  observe(observable: IBaseObservable<any>, options?: ITickerObserveOptions): IUnobservable
}
