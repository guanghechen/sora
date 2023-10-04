import type { IDisposable } from '../types'

export function disposeAll(disposables: Iterable<IDisposable>): void | never {
  const errors: unknown[] = []
  for (const disposable of disposables) {
    try {
      disposable.dispose()
    } catch (e) {
      errors.push(e)
    }
  }

  if (errors.length === 1) {
    throw errors[0]
  }

  if (errors.length > 1) {
    throw new AggregateError(errors, 'Encountered errors while disposing')
  }
}
