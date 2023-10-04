import type { IObservable } from './observable'
import type { IScheduleTransaction } from './schedulable'

export interface ITickerOptions {
  delay?: number
  threshold?: number
}

export interface ITicker extends IObservable<number> {
  tick(transaction?: IScheduleTransaction): void

  /**
   * Subscribe the change of an observable.
   * @param observable
   */
  observe(observable: IObservable<any>): void
}
