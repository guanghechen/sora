import type { ITask } from '@guanghechen/task'
import type { IProductConsumer } from './consumer'

export interface IScheduler<D, T> extends ITask {
  /**
   * Use a consumer to consume the products.
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
}
