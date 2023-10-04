import { Disposable } from './disposable'
import { Observable } from './observable'
import type { IDisposable, IStatableValue, IState, ISubscriber } from './types'

export class State<T extends Readonly<IStatableValue>> extends Observable<T> implements IState<T> {
  public override readonly getSnapshot = (): T => {
    return super.getSnapshot()
  }

  public readonly getServerSnapshot = (): T => {
    return super.getSnapshot()
  }

  public readonly setState = (patch: T | ((prev: T) => T)): void => {
    const nextValue: T = typeof patch === 'function' ? patch(this.getSnapshot()) : patch
    super.next(nextValue)
  }

  public readonly subscribeStateChange = (onStateChange: () => void): (() => void) => {
    const subscriber: ISubscriber<T> = {
      next: () => onStateChange(),
      complete: () => {},
    }
    const unsubscribable = super.subscribe(subscriber)
    const disposable: IDisposable = Disposable.fromUnsubscribable(unsubscribable)
    this.registerDisposable(disposable)
    return () => disposable.dispose()
  }
}
