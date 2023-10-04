import { SchedulableTransaction } from '../schedulable'
import type { IScheduleTransaction } from '../types'

export function startTransaction(schedule: (transaction: IScheduleTransaction) => void): void {
  const transaction = new SchedulableTransaction()
  transaction.start()
  schedule(transaction)
  transaction.end()
}
