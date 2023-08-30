import type { ITask } from './task'

export interface IScheduler<D> extends ITask {
  schedule(data: D): void
}
