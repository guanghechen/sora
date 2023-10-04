import type { IUnsubscribable } from '@guanghechen/viewmodel.types'

export const noop: (...args: any) => void = (): void => {}

export const noopUnsubscribable: IUnsubscribable = {
  unsubscribe: noop,
}
