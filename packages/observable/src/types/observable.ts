import type { IBatchDisposable } from '@guanghechen/disposable'
import type { ISubscribable } from '@guanghechen/subscriber'

export type IEquals<T> = (x: T, y: T) => boolean

export interface IObservableOptions<T> {
  /**
   * Delay before notifying subscribers. (milliseconds)
   */
  readonly delay?: number
  /**
   * Determine whether the two values are equal.
   */
  readonly equals?: IEquals<T>
}

export interface IObservableNextOptions {
  /**
   * Whether to throw an error if the observable disposed.
   * @default true
   */
  readonly strict?: boolean

  /**
   * Force trigger the notification of subscribers even the next value equals to the current value.
   * @default false
   */
  readonly force?: boolean
}

export interface IObservable<T> extends IBatchDisposable, ISubscribable<T> {
  readonly equals: IEquals<T>
  getSnapshot(): T
  next(value: T, options?: IObservableNextOptions): void
}

export type IValueList<T extends Array<IObservable<any>>> = {
  [K in keyof T]: T[K] extends IObservable<infer U> ? U : never
}

export type IValueMap<T extends object> = {
  [key in keyof T]: T[key] extends IObservable<infer U> ? U : never
}

export type IObservableRecord<T extends object> = {
  [key in keyof T]: T[key] extends IObservable<any> ? T[key] : never
}

export type IObservableKey<T extends object> = keyof {
  [key in keyof T]: T[key] extends IObservable<any> ? key : never
}
