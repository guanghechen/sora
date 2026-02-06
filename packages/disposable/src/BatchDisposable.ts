import type { IBatchDisposable, IDisposable } from '@guanghechen/types'
import { disposeAll } from './util/disposeAll'

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
    if (this._disposed) return
    this._disposed = true
    try {
      disposeAll(this._disposables)
    } finally {
      this._disposables.length = 0
    }
  }

  public registerDisposable<T extends IDisposable>(disposable: T): void {
    if (disposable.disposed) return
    if (this._disposed) disposable.dispose()
    else this._disposables.push(disposable)
  }
}
