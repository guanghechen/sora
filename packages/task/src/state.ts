import { SoraErrorCollector } from '@guanghechen/error'
import type {
  IMonitor,
  ISoraErrorCollector,
  ITaskError,
  ITaskMonitor,
  ITaskState,
  IUnMonitorTask,
} from '@guanghechen/internal'
import { ErrorLevelEnum, TaskStatusEnum, noop } from '@guanghechen/internal'
import { Monitor } from '@guanghechen/monitor'

const active: TaskStatusEnum =
  TaskStatusEnum.RUNNING | //
  TaskStatusEnum.ATTEMPT_SUSPENDING |
  TaskStatusEnum.ATTEMPT_RESUMING
const alive: TaskStatusEnum =
  TaskStatusEnum.PENDING | //
  TaskStatusEnum.RUNNING |
  TaskStatusEnum.SUSPENDED |
  TaskStatusEnum.ATTEMPT_SUSPENDING |
  TaskStatusEnum.ATTEMPT_RESUMING
const terminated: TaskStatusEnum =
  TaskStatusEnum.CANCELLED | //
  TaskStatusEnum.FAILED |
  TaskStatusEnum.FINISHED

type IParametersOfOnAddError = Parameters<Required<ITaskMonitor>['onAddError']>
type IParametersOfOnStatusChange = Parameters<Required<ITaskMonitor>['onStatusChange']>

export class TaskState implements ITaskState {
  public readonly name: string
  protected readonly _errorCollector: ISoraErrorCollector
  private readonly _monitorAddError: IMonitor<IParametersOfOnAddError>
  private readonly _monitorStatusChange: IMonitor<IParametersOfOnStatusChange>
  private _status: TaskStatusEnum

  constructor(name: string) {
    this.name = name
    this._errorCollector = new SoraErrorCollector(name)
    this._monitorAddError = new Monitor<IParametersOfOnAddError>('onAddError')
    this._monitorStatusChange = new Monitor<IParametersOfOnStatusChange>('onStatusChange')
    this._status = TaskStatusEnum.PENDING
  }

  public get status(): TaskStatusEnum {
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
    return this._errorCollector.size > 0
  }

  public get error(): ITaskError | undefined {
    if (this._errorCollector.size === 0) return undefined
    return { from: this.name, details: this._errorCollector.errors }
  }

  public set status(status: TaskStatusEnum) {
    const curStatus = this._status
    if (status !== curStatus) {
      const accepted: boolean = this.check(status)
      if (accepted) {
        this._status = status

        // Notify.
        this._monitorStatusChange.notify(status, curStatus)
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
    const unsubscribeOnAddError = this._monitorAddError.subscribe(onAddError)
    const unsubscribeOnStatusChange = this._monitorStatusChange.subscribe(onStatusChange)

    return (): void => {
      unsubscribeOnAddError()
      unsubscribeOnStatusChange()
    }
  }

  public check(nextStatus: TaskStatusEnum): boolean {
    const status: TaskStatusEnum = this._status
    switch (nextStatus) {
      case TaskStatusEnum.PENDING:
        return false
      case TaskStatusEnum.RUNNING:
        return status === TaskStatusEnum.PENDING || status === TaskStatusEnum.ATTEMPT_RESUMING
      case TaskStatusEnum.SUSPENDED:
        return status === TaskStatusEnum.ATTEMPT_SUSPENDING
      case TaskStatusEnum.CANCELLED:
        return status === TaskStatusEnum.ATTEMPT_CANCELING
      case TaskStatusEnum.FAILED:
        return (
          status !== TaskStatusEnum.PENDING &&
          status !== TaskStatusEnum.SUSPENDED &&
          (status & terminated) === 0
        )
      case TaskStatusEnum.FINISHED:
        return (
          status !== TaskStatusEnum.PENDING &&
          status !== TaskStatusEnum.SUSPENDED &&
          (status & terminated) === 0
        )
      case TaskStatusEnum.ATTEMPT_SUSPENDING:
        return status === TaskStatusEnum.RUNNING
      case TaskStatusEnum.ATTEMPT_RESUMING:
        return status === TaskStatusEnum.SUSPENDED
      case TaskStatusEnum.ATTEMPT_CANCELING:
        return (status & alive) > 0
      case TaskStatusEnum.ATTEMPT_FINISHING:
        return status !== TaskStatusEnum.PENDING && (status & alive) > 0
      /* c8 ignore start */
      default:
        return false
      /* c8 ignore end */
    }
  }

  public cleanup(): void {
    if (!this.terminated) throw new Error(`[cleanup] task(${this.name}) is not terminated`)
    this._errorCollector.cleanup()
    this._monitorStatusChange.destroy()
    this._monitorAddError.destroy()
  }

  protected _addError(
    type: string,
    error: unknown,
    level: ErrorLevelEnum = ErrorLevelEnum.ERROR,
  ): void {
    this._errorCollector.add(type, error, level)

    // Notify.
    this._monitorAddError.notify(type, error, level)
  }
}
