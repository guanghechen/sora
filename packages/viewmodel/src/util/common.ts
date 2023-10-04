import type { IUnsubscribable } from '../types'

export const noop: (...args: any) => void = (): void => {}

export const noopUnsubscribable: IUnsubscribable = {
  unsubscribe: noop,
}
