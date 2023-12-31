import type { IBatchDisposable } from '@guanghechen/disposable.types'
import type { ISubscribable } from '@guanghechen/subscribe.types'
import type { IEquals, IObservableValue } from './common'
import type { IScheduleTransaction } from './schedulable'

export interface IObservableOptions<T extends IObservableValue> {
  equals?: IEquals<T>
}

export interface IObservable<T extends IObservableValue>
  extends IBatchDisposable,
    ISubscribable<T> {
  readonly equals: IEquals<T>
  getSnapshot(): T
  next(value: T, transaction?: IScheduleTransaction): void
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
