import type { IUnsubscribable } from '@guanghechen/observable.types'

export function noop(..._args: any[]): void {}

export const noopUnsubscribable: IUnsubscribable = {
  unsubscribe: noop,
}
