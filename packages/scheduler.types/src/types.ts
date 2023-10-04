import type { ITask } from '@guanghechen/task.types'

export interface IScheduler<D> extends ITask {
  /**
   * Schedule a task.
   * @param data
   * @returns the code of the task
   */
  schedule(data: D): Promise<number>
  /**
   * Waiting a task terminated. (done / cancelled / failed)
   * @param code the code of the task
   */
  waitTaskTerminated(code: number): Promise<void>
}
