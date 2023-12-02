import type { IDisposable } from '@guanghechen/disposable.types'

export function isDisposable(obj: unknown): obj is IDisposable {
  if (obj === null || typeof obj !== 'object') return false
  return (
    typeof Reflect.get(obj, 'dispose') === 'function' &&
    typeof Reflect.get(obj, 'disposed') === 'boolean'
  )
}
