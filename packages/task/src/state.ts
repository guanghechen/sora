import type { IMonitor } from '@guanghechen/monitor'
import { Monitor } from '@guanghechen/monitor'
import { TaskStatus, active, alive, terminated } from './constant'
import type {
  ITaskError,
  ITaskErrorDetail,
  ITaskMonitor,
  ITaskState,
  IUnMonitorTask,
} from './types'

const noop: IUnMonitorTask = (): void => {}

type IParametersOfOnAddError = Parameters<Required<ITaskMonitor>['onAddError']>
type IParametersOfOnStatusChange = Parameters<Required<ITaskMonitor>['onStatusChange']>

export class TaskState implements ITaskState {
  public readonly name: string
  private readonly _monitors: {
    onStatusChange: IMonitor<IParametersOfOnStatusChange>
    onAddError: IMonitor<IParametersOfOnAddError>
  }
  private readonly _errorDetails: ITaskErrorDetail[]
  private _status: TaskStatus

  constructor(name: string) {
    this.name = name
    this._monitors = {
      onAddError: new Monitor<IParametersOfOnAddError>('onAddError'),
      onStatusChange: new Monitor<IParametersOfOnStatusChange>('onStatusChange'),
    }
    this._errorDetails = []
    this._status = TaskStatus.PENDING
  }

  public get status(): TaskStatus {
    return this._status
  }

  public get active(): boolean {
    return (this._status & active) > 0
  }

  public get alive(): boolean {
    return (this._status & alive) > 0
  }

  public get terminated(): boolean {
    return (this._status & terminated) > 0
  }

  public get hasError(): boolean {
    return this._errorDetails.length > 0
  }

  public get error(): ITaskError | undefined {
    if (this._errorDetails.length === 0) return undefined
    return { from: this.name, details: this._errorDetails.slice() }
  }

  public set status(status: TaskStatus) {
    const curStatus = this._status
    if (status !== curStatus) {
      const accepted: boolean = this.check(status)
      if (accepted) {
        this._status = status

        // Notify.
        this._monitors.onStatusChange.notify(status, curStatus)
      } else {
        throw new TypeError(
          `[transit] unexpected status: task(${this.name}) cur(${curStatus}) next(${status})`,
        )
      }
    }
  }

  public monitor(monitor: Partial<ITaskMonitor>): IUnMonitorTask {
    if (this.terminated) return noop

    const { onAddError, onStatusChange } = monitor
    const unsubscribeOnAddError = onAddError
      ? this._monitors.onAddError.subscribe(onAddError)
      : noop
    const unsubscribeOnStatusChange = onStatusChange
      ? this._monitors.onStatusChange.subscribe(onStatusChange)
      : noop
    return (): void => {
      unsubscribeOnAddError()
      unsubscribeOnStatusChange()
    }
  }

  public check(nextStatus: TaskStatus): boolean {
    const status: TaskStatus = this._status
    switch (nextStatus) {
      case TaskStatus.PENDING:
        return false
      case TaskStatus.RUNNING:
        return status === TaskStatus.PENDING || status === TaskStatus.ATTEMPT_RESUMING
      case TaskStatus.SUSPENDED:
        return status === TaskStatus.ATTEMPT_SUSPENDING
      case TaskStatus.CANCELLED:
        return status === TaskStatus.ATTEMPT_CANCELING
      case TaskStatus.FAILED:
        return (
          status !== TaskStatus.PENDING &&
          status !== TaskStatus.SUSPENDED &&
          (status & terminated) === 0
        )
      case TaskStatus.FINISHED:
        return (
          status !== TaskStatus.PENDING &&
          status !== TaskStatus.SUSPENDED &&
          (status & terminated) === 0
        )
      case TaskStatus.ATTEMPT_SUSPENDING:
        return status === TaskStatus.RUNNING
      case TaskStatus.ATTEMPT_RESUMING:
        return status === TaskStatus.SUSPENDED
      case TaskStatus.ATTEMPT_CANCELING:
        return (status & alive) > 0
      case TaskStatus.ATTEMPT_FINISHING:
        return status !== TaskStatus.PENDING && (status & alive) > 0
      /* c8 ignore start */
      default:
        return false
      /* c8 ignore end */
    }
  }

  public cleanup(): void {
    if (!this.terminated) throw new Error(`[cleanup] task(${this.name}) is not terminated`)
    this._errorDetails.length = 0
    this._monitors.onStatusChange.destroy()
    this._monitors.onAddError.destroy()
  }

  protected _addError(type: string, error: unknown): void {
    this._errorDetails.push({ type, error })

    // Notify.
    this._monitors.onAddError.notify(type, error)
  }
}
