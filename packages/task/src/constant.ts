const bit = 1

export enum TaskStrategyEnum {
  ABORT_ON_ERROR = bit << 0, // Abort the task if any error occurred.
  CONTINUE_ON_ERROR = bit << 1, // Continue the task even if any error occurred.
}

export enum TaskStatusEnum {
  PENDING = bit << 0, // Task not start.
  RUNNING = bit << 1, // Task is running.
  SUSPENDED = bit << 2, // Task is paused.
  CANCELLED = bit << 3, // Task is cancelled.
  FAILED = bit << 4, // Task is failed.
  COMPLETED = bit << 5, // Task is completed.
  ATTEMPT_SUSPENDING = bit << 6, // Attempting to suspend the task.
  ATTEMPT_RESUMING = bit << 7, // Attempting to resume the task.
  ATTEMPT_CANCELING = bit << 8, // Attempting to cancel the task.
  ATTEMPT_COMPLETING = bit << 9, // Attempting to run util complete the task.
}
