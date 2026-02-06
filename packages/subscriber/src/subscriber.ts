import type { ISubscriber } from '@guanghechen/types'

type IOnDisposable = () => void
type IOnNext<T> = (value: T, prevValue: T | undefined) => void

const noop = (): void => {}

export interface ISubscriberOptions<T> {
  readonly onNext: IOnNext<T>
  readonly onDispose?: IOnDisposable
}

export class Subscriber<T> implements ISubscriber<T> {
  protected readonly _onDispose: IOnDisposable
  protected readonly _onNext: IOnNext<T>
  protected _disposed: boolean

  constructor(options: ISubscriberOptions<T>) {
    this._onDispose = options?.onDispose ?? noop
    this._onNext = options.onNext
    this._disposed = false
  }

  public get disposed(): boolean {
    return this._disposed
  }

  public dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._onDispose()
  }

  public next(value: T, prevValue: T | undefined): void {
    if (this._disposed) return
    this._onNext(value, prevValue)
  }
}
