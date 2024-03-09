import type { IObservable, IObservableNextOptions } from './observable'

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
  observe(observable: IObservable<any>, options?: ITickerObserveOptions): void
}
