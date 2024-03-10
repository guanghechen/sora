import type { IObservable, IObservableNextOptions } from '@guanghechen/observable'
import type { PipelineStatusEnum } from '../constant'
import type { IMaterialCooker } from './cooker'
import type { IProduct } from './product'

export interface IPipelineStatus extends IObservable<PipelineStatusEnum> {
  /**
   * Whether the pipeline was closed.
   */
  readonly closed: boolean

  /**
   *
   * @param nextStatus
   * @param options
   */
  next(nextStatus: PipelineStatusEnum, options?: IObservableNextOptions): void
}

export interface IPipeline<D, T> {
  /**
   * Pipeline name.
   */
  readonly name: string

  /**
   * Indicate the pipeline status.
   */
  readonly status: IPipelineStatus

  /**
   * Indicate the length of elements in the pipeline.
   */
  readonly size: number

  /**
   * Use a cooker to cook the material to product.
   * @param cooker
   */
  use(cooker: IMaterialCooker<D, T>): this

  /**
   * Close the pipeline and perform some cleanup operation.
   */
  close(): Promise<void>

  /**
   * Add a element into the pipeline.
   * @param data
   * @returns the code of the material
   */
  push(data: D): Promise<number>

  /**
   * Retrieve an element from the pipeline.
   */
  pull(): Promise<IProduct<T>>

  /**
   * Indicate that the materials with the codes were handled.
   * @param codes
   */
  notifyMaterialHandled(codes: Iterable<number>): void

  /**
   * Waiting a material handled.
   * @param code the code of the material
   */
  waitMaterialHandled(code: number): Promise<void>

  /**
   * Waiting all materials handled which code are less than or equal to the specified code.
   * @param code
   */
  waitAllMaterialsHandledAt(code: number): Promise<void>
}
