import type { ITask } from '@guanghechen/task'

export interface IScheduler<D> extends ITask {
  schedule(data: D): void
}

export interface IReporter {
  reportError(error: unknown): void
}
