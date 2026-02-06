import type { ISubscriber } from '@guanghechen/subscriber'
import { Subscriber } from '@guanghechen/subscriber'

export class TestSubscriber extends Subscriber<number> implements ISubscriber<number> {
  protected _value: number
  protected _updateTick: number

  constructor(initialValue = 0) {
    super({
      onNext: (value: number): void => {
        this._updateTick += 1
        this._value = value
      },
    })
    this._value = initialValue
    this._updateTick = 0
  }

  public get value(): number {
    return this._value
  }

  public get updateTick(): number {
    return this._updateTick
  }
}
