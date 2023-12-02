export type IObservablePrimitiveValue = bigint | boolean | null | number | string | symbol

export type IObservableValue = IObservablePrimitiveValue | object | undefined | void

export type IEquals<T> = (x: T, y: T) => boolean

export type ITimer = ReturnType<typeof setTimeout>

export interface IAsyncCaller {
  timer: ITimer
  createdAt: number
  call: () => void
}
