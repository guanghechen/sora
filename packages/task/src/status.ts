import { Observable } from '@guanghechen/observable'
import type { IObservableNextOptions } from '@guanghechen/observable'
import { TaskStatusEnum } from './constant'
import type { ITaskStatus } from './types'

const _terminated: TaskStatusEnum =
  TaskStatusEnum.CANCELLED | TaskStatusEnum.FAILED | TaskStatusEnum.COMPLETED
const _transitionMap: Record<TaskStatusEnum, TaskStatusEnum> = {
  [TaskStatusEnum.PENDING]:
    TaskStatusEnum.PENDING |
    TaskStatusEnum.RUNNING |
    TaskStatusEnum.CANCELLED |
    TaskStatusEnum.ATTEMPT_CANCELING,
  [TaskStatusEnum.RUNNING]:
    TaskStatusEnum.RUNNING |
    TaskStatusEnum.SUSPENDED |
    _terminated |
    TaskStatusEnum.ATTEMPT_SUSPENDING |
    TaskStatusEnum.ATTEMPT_CANCELING |
    TaskStatusEnum.ATTEMPT_COMPLETING,
  [TaskStatusEnum.SUSPENDED]:
    TaskStatusEnum.RUNNING |
    TaskStatusEnum.SUSPENDED |
    _terminated |
    TaskStatusEnum.ATTEMPT_RESUMING |
    TaskStatusEnum.ATTEMPT_CANCELING |
    TaskStatusEnum.ATTEMPT_COMPLETING,
  [TaskStatusEnum.CANCELLED]: TaskStatusEnum.CANCELLED,
  [TaskStatusEnum.FAILED]: TaskStatusEnum.FAILED,
  [TaskStatusEnum.COMPLETED]: TaskStatusEnum.COMPLETED,
  [TaskStatusEnum.ATTEMPT_SUSPENDING]:
    TaskStatusEnum.SUSPENDED |
    _terminated |
    TaskStatusEnum.ATTEMPT_SUSPENDING |
    TaskStatusEnum.ATTEMPT_CANCELING |
    TaskStatusEnum.ATTEMPT_COMPLETING,
  [TaskStatusEnum.ATTEMPT_RESUMING]:
    TaskStatusEnum.RUNNING |
    _terminated |
    TaskStatusEnum.ATTEMPT_RESUMING |
    TaskStatusEnum.ATTEMPT_CANCELING |
    TaskStatusEnum.ATTEMPT_COMPLETING,
  [TaskStatusEnum.ATTEMPT_CANCELING]: _terminated | TaskStatusEnum.ATTEMPT_CANCELING,
  [TaskStatusEnum.ATTEMPT_COMPLETING]: _terminated | TaskStatusEnum.ATTEMPT_COMPLETING,
}

export class TaskStatus extends Observable<TaskStatusEnum> implements ITaskStatus {
  constructor() {
    super(TaskStatusEnum.PENDING)
  }

  public get alive(): boolean {
    const value: TaskStatusEnum = this.getSnapshot()
    return (value & _terminated) === 0
  }

  public get terminated(): boolean {
    const value: TaskStatusEnum = this.getSnapshot()
    return (value & _terminated) > 0
  }

  public override dispose(): void {
    if (this.terminated) {
      if (!this.disposed) super.dispose()
      return
    }

    this.next(TaskStatusEnum.CANCELLED, { strict: false })
    super.dispose()
  }

  public override next(nextStatus: TaskStatusEnum, options?: IObservableNextOptions): void {
    const curStatus: TaskStatusEnum = this.getSnapshot()
    if (curStatus === nextStatus) return

    if (this._verifyTransition(curStatus, nextStatus)) {
      super.next(nextStatus, options)
      if ((nextStatus & _terminated) > 0) this.dispose()
      return
    }

    const strict: boolean = options?.strict ?? true
    if (strict) {
      const curStatusName: string = TaskStatusEnum[curStatus]
      const nextStatusName: string = TaskStatusEnum[nextStatus]
      throw new RangeError(`Invalid status transition: ${curStatusName} -> ${nextStatusName}.`)
    }
  }

  protected _verifyTransition(curStatus: TaskStatusEnum, nextStatus: TaskStatusEnum): boolean {
    const validTransitions: TaskStatusEnum = _transitionMap[curStatus]
    /* c8 ignore next */
    if (validTransitions === undefined) return false
    return (nextStatus & validTransitions) > 0
  }
}
