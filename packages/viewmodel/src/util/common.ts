import type { IUnsubscribable } from '@guanghechen/subscribe.types'

export const noop: (...args: any) => void = (): void => {}

export const noopUnsubscribable: IUnsubscribable = {
  unsubscribe: noop,
}
