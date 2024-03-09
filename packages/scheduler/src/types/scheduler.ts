import type { ITask } from '@guanghechen/task'
import type { IProductConsumer } from './consumer'

export interface IScheduler<D, T> extends ITask {
  /**
   * Use a cooker to cook the material to product.
   * @param cooker
   */
  use(consumer: IProductConsumer<T, ITask>): void

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
