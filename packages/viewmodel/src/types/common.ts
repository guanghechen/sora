export type IObservablePrimitiveValue = bigint | boolean | null | number | string | symbol

export type IObservableValue = IObservablePrimitiveValue | object | undefined | void

export interface IDisposable {
  readonly disposed: boolean
  dispose(): void
}

export interface IBatchDisposable extends IDisposable {
  registerDisposable<T extends IDisposable>(disposable: T): void
}

export interface ISubscriber<T> {
  next(value: T, prevValue: T | undefined): void
  complete(): void
}

export interface IUnsubscribable {
  unsubscribe(): void
}

export interface ISubscribable<T> {
  subscribe(subscriber: ISubscriber<T>): IUnsubscribable
}

export type IEquals<T> = (x: T, y: T) => boolean

export type ITimer = ReturnType<typeof setTimeout>

export interface IAsyncCaller {
  timer: ITimer
  createdAt: number
  call: () => void
}
