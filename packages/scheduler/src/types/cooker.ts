import type { IAsyncMiddleware, IAsyncMiddlewareNext } from '@guanghechen/middleware'
import type { IMaterial } from './material'

export interface IMaterialCookerApi<D> {
  /**
   * Invalidate the material.
   */
  invalidate(material: IMaterial<D>): void
  /**
   * Transverse the subsequent materials.
   */
  subsequent(): IterableIterator<IMaterial<D>>
}

export interface IMaterialCooker<D, T> {
  /**
   * Cooker name.
   */
  readonly name: string

  /**
   * Cook a material.
   * @param material
   */
  readonly cook: IAsyncMiddleware<D, T, IMaterialCookerApi<D>>
}

export type IMaterialCookerNext<T> = IAsyncMiddlewareNext<T>
