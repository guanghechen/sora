import type { IDisposable } from '@guanghechen/disposable.types'
import type { IAsyncMiddleware, IAsyncMiddlewareNext } from '@guanghechen/middleware'
import type { IObservable, IObservableNextOptions } from '@guanghechen/observable.types'
import type { ProductConsumerStatusEnum } from '../constant'
import type { IProduct } from './product'

export interface IProductConsumerStatus extends IObservable<ProductConsumerStatusEnum> {
  /**
   * Whether the pipeline was alive.
   */
  readonly alive: boolean

  /**
   * Whether the pipeline was terminated.
   */
  readonly terminated: boolean

  /**
   *
   * @param nextStatus
   * @param options
   */
  next(nextStatus: ProductConsumerStatusEnum, options?: IObservableNextOptions): void
}

export interface IProductConsumerApi {
  //
}

export interface IProductConsumer<D, T> extends IDisposable {
  /**
   * Consumer name.
   */
  readonly name: string

  /**
   * Consumer status.
   */
  readonly status: IProductConsumerStatus

  /**
   * Perform some initialization.
   */
  init(): Promise<void>

  /**
   * Consumer a product.
   */
  readonly consume: IAsyncMiddleware<IProduct<D>, T, IProductConsumerApi>
}

export type IProductConsumerNext<T> = IAsyncMiddlewareNext<T>
