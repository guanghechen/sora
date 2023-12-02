import type { IObservable, IObservableValue } from '@guanghechen/viewmodel.types'

export function isObservable(obj: unknown): obj is IObservable<IObservableValue> {
  if (obj === null || typeof obj !== 'object') return false
  return (
    typeof Reflect.get(obj, 'dispose') === 'function' &&
    typeof Reflect.get(obj, 'disposed') === 'boolean' &&
    typeof Reflect.get(obj, 'subscribe') === 'function' &&
    typeof Reflect.get(obj, 'equals') === 'function' &&
    typeof Reflect.get(obj, 'getSnapshot') === 'function' &&
    typeof Reflect.get(obj, 'next') === 'function'
  )
}
