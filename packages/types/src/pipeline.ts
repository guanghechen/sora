import type { PipelineStatusEnum } from '@guanghechen/constant'

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
   */
  push(material: D): Promise<void>

  /**
   * Retrieve an element from the pipeline.
   */
  pull(): Promise<T | undefined>
}
