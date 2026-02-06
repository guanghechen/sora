import type { IAsyncMiddleware, IAsyncMiddlewareNext } from '@guanghechen/middleware'

export interface IProductConsumerApi {
  //
}

export interface IProductConsumer<D, T> {
  /**
   * Consumer name.
   */
  readonly name: string

  /**
   * Consumer a product.
   * @param material
   */
  readonly consume: IAsyncMiddleware<D, T, IProductConsumerApi>
}

export type IProductConsumerNext<T> = IAsyncMiddlewareNext<T>
