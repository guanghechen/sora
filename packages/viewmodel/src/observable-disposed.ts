import type { IDisposable } from '@guanghechen/disposable'
import { noopUnsubscribable } from '@guanghechen/observable'
import type {
  IEquals,
  IObservable,
  IObservableNextOptions,
  IObservableOptions,
} from '@guanghechen/observable'
import type { ISubscriber, IUnsubscribable } from '@guanghechen/subscriber'

const defaultEquals = <T>(x: T, y: T): boolean => Object.is(x, y)

export class DisposedObservable<T> implements IObservable<T> {
  public readonly equals: IEquals<T>
  protected _value: T

  constructor(defaultValue: T, options?: IObservableOptions<T>) {
    this._value = defaultValue
    this.equals = options?.equals ?? defaultEquals
  }

  public get disposed(): boolean {
    return true satisfies boolean
  }

  public dispose(): void {}

  public registerDisposable<T extends IDisposable>(disposable: T): void {
    disposable.dispose()
  }

  public getSnapshot(): T {
    return this._value
  }

  public next(value: T, options?: IObservableNextOptions): void {
    const strict: boolean = options?.strict ?? true
    if (strict) {
      throw new RangeError(`Don't update a disposed observable. value: ${String(value)}.`)
    }
  }

  public subscribe(subscriber: ISubscriber<T>): IUnsubscribable {
    subscriber.dispose()
    return noopUnsubscribable
  }
}
