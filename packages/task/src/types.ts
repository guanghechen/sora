import type { IObservable, IObservableNextOptions } from '@guanghechen/observable'
import type { TaskStatusEnum, TaskStrategyEnum } from './constant'

export interface ITaskStatus extends IObservable<TaskStatusEnum> {
  /**
   * Whether the task was alive.
   */
  readonly alive: boolean
  /**
   * Whether the task was terminated.
   */
  readonly terminated: boolean
  /**
   *
   * @param nextStatus
   * @param options
   */
  next(nextStatus: TaskStatusEnum, options?: IObservableNextOptions): void
}

export interface ITask {
  /**
   * Task name.
   */
  readonly name: string

  /**
   * Task status.
   */
  readonly status: ITaskStatus

  /**
   * Task strategy.
   */
  readonly strategy: TaskStrategyEnum

  /**
   * Errors while run the task.
   */
  readonly errors: ReadonlyArray<unknown>

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
  complete(): Promise<void>
}
