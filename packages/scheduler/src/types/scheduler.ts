import type { ITask } from '@guanghechen/task'

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
  /**
   * Waiting all scheduled tasks terminated. (done / cancelled / failed)
   */
  waitAllScheduledTasksTerminated(): Promise<void>
}
