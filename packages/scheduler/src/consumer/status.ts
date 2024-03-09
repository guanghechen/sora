import type { IObservableNextOptions } from '@guanghechen/observable'
import { Observable } from '@guanghechen/observable'
import { ProductConsumerStatusEnum } from '../constant'
import type { IProductConsumerStatus } from '../types/consumer'

const _terminated: ProductConsumerStatusEnum = ProductConsumerStatusEnum.DISPOSED
const _transitionMap: Record<ProductConsumerStatusEnum, ProductConsumerStatusEnum> = {
  [ProductConsumerStatusEnum.NOT_READY]:
    ProductConsumerStatusEnum.NOT_READY | ProductConsumerStatusEnum.DISPOSED,
  [ProductConsumerStatusEnum.IDLE]:
    ProductConsumerStatusEnum.IDLE |
    ProductConsumerStatusEnum.BUSY |
    ProductConsumerStatusEnum.DISPOSED,
  [ProductConsumerStatusEnum.BUSY]:
    ProductConsumerStatusEnum.BUSY |
    ProductConsumerStatusEnum.IDLE |
    ProductConsumerStatusEnum.DISPOSED,
  [ProductConsumerStatusEnum.DISPOSED]: ProductConsumerStatusEnum.DISPOSED,
}

export class ProductConsumerStatus
  extends Observable<ProductConsumerStatusEnum>
  implements IProductConsumerStatus
{
  constructor() {
    super(ProductConsumerStatusEnum.NOT_READY)
  }

  public get alive(): boolean {
    const value: ProductConsumerStatusEnum = this.getSnapshot()
    return (value & _terminated) === 0
  }

  public get terminated(): boolean {
    const value: ProductConsumerStatusEnum = this.getSnapshot()
    return (value & _terminated) > 0
  }

  public override dispose(): void {
    if (this.disposed) return
    this.next(ProductConsumerStatusEnum.DISPOSED, { strict: true })
    super.dispose()
  }

  public override next(
    nextStatus: ProductConsumerStatusEnum,
    options?: IObservableNextOptions,
  ): void {
    const curStatus: ProductConsumerStatusEnum = this.getSnapshot()
    if (this._verifyTransition(curStatus, nextStatus)) {
      super.next(nextStatus, options)
      if ((nextStatus & _terminated) > 0) this.dispose()
      return
    }

    const strict: boolean = options?.strict ?? true
    if (strict) {
      const curStatusName: string = ProductConsumerStatusEnum[curStatus]
      const nextStatusName: string = ProductConsumerStatusEnum[nextStatus]
      throw new RangeError(`Invalid status transition: ${curStatusName} -> ${nextStatusName}.`)
    }
  }

  protected _verifyTransition(
    curStatus: ProductConsumerStatusEnum,
    nextStatus: ProductConsumerStatusEnum,
  ): boolean {
    const validTransitions: ProductConsumerStatusEnum = _transitionMap[curStatus]
    /* c8 ignore next */
    if (validTransitions === undefined) return false
    return (nextStatus & validTransitions) > 0
  }
}
