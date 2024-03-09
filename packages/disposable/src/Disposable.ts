import type { IDisposable } from '@guanghechen/disposable.types'

export class Disposable implements IDisposable {
  protected readonly _onDispose: () => void
  protected _disposed: boolean

  constructor(onDispose: () => void) {
    this._onDispose = onDispose
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
}
