import type { IObservableNextOptions } from '@guanghechen/observable'
import { Observable } from '@guanghechen/observable'
import { PipelineStatusEnum } from '../constant'
import type { IPipelineStatus } from '../types/pipeline'

const _terminated: PipelineStatusEnum = PipelineStatusEnum.CLOSED
const _transitionMap: Record<PipelineStatusEnum, PipelineStatusEnum> = {
  [PipelineStatusEnum.IDLE]:
    PipelineStatusEnum.IDLE | PipelineStatusEnum.DRIED | PipelineStatusEnum.CLOSED,
  [PipelineStatusEnum.DRIED]:
    PipelineStatusEnum.DRIED | PipelineStatusEnum.IDLE | PipelineStatusEnum.CLOSED,
  [PipelineStatusEnum.CLOSED]: PipelineStatusEnum.CLOSED,
}

export class PipelineStatus extends Observable<PipelineStatusEnum> implements IPipelineStatus {
  constructor() {
    super(PipelineStatusEnum.IDLE)
  }

  public get closed(): boolean {
    const value: PipelineStatusEnum = this.getSnapshot()
    return value === PipelineStatusEnum.CLOSED
  }

  public override dispose(): void {
    if (this.disposed) return
    this.next(PipelineStatusEnum.CLOSED, { strict: true })
    super.dispose()
  }

  public override next(nextStatus: PipelineStatusEnum, options?: IObservableNextOptions): void {
    const curStatus: PipelineStatusEnum = this.getSnapshot()
    if (this._verifyTransition(curStatus, nextStatus)) {
      super.next(nextStatus, options)
      if ((nextStatus & _terminated) > 0) this.dispose()
      return
    }

    const strict: boolean = options?.strict ?? true
    if (strict) {
      const curStatusName: string = PipelineStatusEnum[curStatus]
      const nextStatusName: string = PipelineStatusEnum[nextStatus]
      throw new RangeError(`Invalid status transition: ${curStatusName} -> ${nextStatusName}.`)
    }
  }

  protected _verifyTransition(
    curStatus: PipelineStatusEnum,
    nextStatus: PipelineStatusEnum,
  ): boolean {
    const validTransitions: PipelineStatusEnum = _transitionMap[curStatus]
    /* c8 ignore next */
    if (validTransitions === undefined) return false
    return (nextStatus & validTransitions) > 0
  }
}
