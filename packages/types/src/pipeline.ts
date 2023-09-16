import type { PipelineStatusEnum } from '@guanghechen/constant'

export interface IPipelineMaterial<D> {
  code: number
  alive: boolean
  data: D
}

export interface IPipelineProduct<T> {
  codes: number[]
  data: T | undefined
}

export interface IPipelineMonitor {
  /**
   * Called when the pipeline disposed.
   */
  onClosed(): void

  /**
   * There is a new element be pushed into the pipeline.
   */
  onPushed(): void
}

export type IUnMonitorPipeline = () => void

export interface IPipeline<D, T> {
  /**
   * Indicate the length of elements in the pipeline.
   */
  readonly size: number

  /**
   * Indicate the pipeline status.
   */
  readonly status: PipelineStatusEnum

  /**
   * Indicate the pipeline is closed or not.
   */
  readonly closed: boolean

  /**
   * Dispose the pipeline.
   */
  close(): Promise<void>

  /**
   * Monitor the pipeline changes.
   * @param monitor
   */
  monitor(monitor: Partial<IPipelineMonitor>): IUnMonitorPipeline

  /**
   * Add a element into the pipeline.
   * @param material
   * @returns the code of the material
   */
  push(material: D): Promise<number>

  /**
   * Retrieve an element from the pipeline.
   */
  pull(): Promise<IPipelineProduct<T>>
}
