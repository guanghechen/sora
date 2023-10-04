import type { IBatchDisposable, IDisposable, IUnsubscribable } from './types'
import { disposeAll } from './util'

export class BatchDisposable implements IBatchDisposable {
  protected _disposed: boolean
  protected readonly _disposables: IDisposable[]

  constructor() {
    this._disposed = false
    this._disposables = []
  }

  public get disposed(): boolean {
    return this._disposed
  }

  public dispose(): void {
    if (!this._disposed) {
      this._disposed = true
      disposeAll(this._disposables)
      this._disposables.length = 0
    }
  }

  public registerDisposable<T extends IDisposable>(disposable: T): void {
    if (this._disposed) disposable.dispose()
    else this._disposables.push(disposable)
  }
}

export class Disposable implements IDisposable {
  protected readonly _onDispose: () => void
  protected _disposed: boolean

  private constructor(onDispose: () => void) {
    this._onDispose = onDispose
    this._disposed = false
  }

  public static fromCallback(onDispose: () => void): IDisposable {
    return new Disposable(onDispose)
  }

  public static fromUnsubscribable(unsubscribable: IUnsubscribable): IDisposable {
    return new Disposable(() => unsubscribable.unsubscribe())
  }

  public get disposed(): boolean {
    return this._disposed
  }

  public dispose(): void {
    if (!this._disposed) {
      this._disposed = true
      this._onDispose()
    }
  }
}
