import type { ErrorLevelEnum, ISoraError } from '@guanghechen/error.types'
import type { TaskStatusEnum } from './constant'

export interface ITaskError {
  from: string
  details: ISoraError[]
}

export interface ITaskMonitor {
  onAddError(type: string, error: unknown, level: ErrorLevelEnum | undefined): void
  onStatusChange(status: TaskStatusEnum, prevStatus: TaskStatusEnum): void
}

export type IUnMonitorTask = () => void

export interface ITaskState {
  readonly status: TaskStatusEnum
  readonly active: boolean
  readonly alive: boolean
  readonly terminated: boolean
}

export interface ITask extends ITaskState {
  /**
   * Task name.
   */
  readonly name: string

  /**
   * Task error.
   */
  readonly error: ITaskError | undefined

  /**
   * Indicate if the task has error.
   */
  readonly hasError: boolean

  /**
   * Start the task.
   */
  start(): Promise<void>

  /**
   * Pause the task.
   */
  pause(): Promise<void>

  /**
   * Resume the task.
   */
  resume(): Promise<void>

  /**
   * Cancel the task.
   */
  cancel(): Promise<void>

  /**
   * finish the task: run to completed no matter if the task started or not.
   */
  finish(): Promise<void>

  /**
   * Perform a clean up.
   * Will thrown an error if the task is not terminated.
   */
  cleanup(): void

  /**
   * Register a monitor to subscribe the task changes.
   * @param monitor
   */
  monitor(monitor: Partial<ITaskMonitor>): IUnMonitorTask
}
