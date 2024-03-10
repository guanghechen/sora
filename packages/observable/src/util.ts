import type { IUnsubscribable } from '@guanghechen/subscriber'
import type { IObservable } from './types/observable'
import type { IUnobservable } from './types/ticker'

export const noop = (..._args: any[]): void => {}
export const noopUnsubscribable: IUnsubscribable = { unsubscribe: noop }
export const noopUnobservable: IUnobservable = { unobserve: noop }

export const isObservable = (obj: unknown): obj is IObservable<unknown> => {
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
