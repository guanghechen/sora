import type { IDisposable } from '@guanghechen/disposable'
import { Disposable } from '@guanghechen/disposable'
import { Observable } from '@guanghechen/observable'
import { type ISubscriber, Subscriber } from '@guanghechen/subscriber'
import type { IState, IValuePatcher } from './types/state'

export class State<T> extends Observable<T> implements IState<T> {
  public override readonly getSnapshot = (): T => {
    return super.getSnapshot()
  }

  public readonly getServerSnapshot = (): T => {
    return super.getSnapshot()
  }

  public readonly setState = (patch: IValuePatcher<T>): void => {
    const prevValue: T = this.getSnapshot()
    const nextValue: T = patch(prevValue)
    super.next(nextValue)
  }

  public readonly updateState = (patch: T | IValuePatcher<T>): void => {
    const prevValue: T = this.getSnapshot()
    const nextValue: T = typeof patch === 'function' ? (patch as (prev: T) => T)(prevValue) : patch
    super.next(nextValue)
  }

  public readonly subscribeStateChange = (onStateChange: () => void): (() => void) => {
    const subscriber: ISubscriber<T> = new Subscriber<T>({ onNext: () => onStateChange() })
    const unsubscribable = super.subscribe(subscriber)
    const disposable: IDisposable = new Disposable(() => {
      subscriber.dispose()
      unsubscribable.unsubscribe()
    })
    this.registerDisposable(disposable)
    return () => disposable.dispose()
  }
}
