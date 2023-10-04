import type { IScheduleTransaction } from '@guanghechen/viewmodel.types'
import { SchedulableTransaction } from '../schedulable'

export function startTransaction(schedule: (transaction: IScheduleTransaction) => void): void {
  const transaction = new SchedulableTransaction()
  transaction.start()
  schedule(transaction)
  transaction.end()
}
