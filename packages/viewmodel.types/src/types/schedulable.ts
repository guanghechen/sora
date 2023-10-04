export enum ScheduleTransactionStatus {
  NOT_STARTED = 0,
  STARTED = 1,
  COMPLETED = 2,
}

export interface ISchedulable {
  readonly scheduled: boolean
  schedule(): void
}

export interface IScheduleTransaction {
  status: ScheduleTransactionStatus
  step(task: ISchedulable): void
  start(): void
  flush(): void // execute current steps immediately.
  end(): void
}
