import type { IDisposable } from '@guanghechen/disposable.types'
import type { IUnsubscribable } from '@guanghechen/subscribe.types'

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
    if (this._disposed) return
    this._disposed = true
    this._onDispose()
  }
}
