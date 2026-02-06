import type { IDisposable } from '@guanghechen/types'

export class SafeBatchHandler {
  private readonly _errors: unknown[]
  private _summary: unknown | undefined

  constructor() {
    this._errors = []
    this._summary = undefined
  }

  public cleanup(): void {
    this._errors.length = 0
    this._summary = undefined
  }

  public run(action: () => void): void {
    try {
      action()
    } catch (error) {
      this._errors.push(error)
      this._summary = undefined
    }
  }

  public summary(errorSummary: string): void | never {
    if (this._summary === undefined) {
      if (this._errors.length === 1) throw (this._summary = this._errors[0])
      if (this._errors.length > 1) {
        this._summary = new AggregateError(this._errors, errorSummary)
      }
    }
    if (this._summary !== undefined) throw this._summary
  }
}

export function disposeAll(disposables: Iterable<IDisposable>): void | never {
  const handler = new SafeBatchHandler()
  for (const disposable of disposables) handler.run(() => disposable.dispose())
  handler.summary('[disposeAll] Encountered errors while disposing')
  handler.cleanup()
}
