import type { SchedulableTransaction } from '../schedulable'
import type { IBatchDisposable, IEquals, IObservableValue, ISubscribable } from './common'

export interface IObservableOptions<T extends IObservableValue> {
  equals?: IEquals<T>
}

export interface IObservable<T extends IObservableValue>
  extends IBatchDisposable,
    ISubscribable<T> {
  readonly equals: IEquals<T>
  getSnapshot(): T
  next(value: T, transaction?: SchedulableTransaction): void
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
