import { Disposable, type IDisposable } from '@guanghechen/disposable'
import { Observable, Ticker } from '@guanghechen/observable'
import type { IObservable, IObservableOptions, IValueList } from '@guanghechen/observable'
import type { ISubscriber, IUnsubscribable } from '@guanghechen/subscriber'
import { Subscriber } from '@guanghechen/subscriber'
import type { IComputed } from './types/computed'

export class Computed<T> implements IComputed<T> {
  protected readonly _observable: IObservable<T>

  constructor(observable: IObservable<T>) {
    this._observable = observable
  }

  public static fromObservables<S extends Array<IObservable<any>>, T>(
    observables: S,
    transform: (values: IValueList<S>) => T,
    options?: IObservableOptions<T>,
  ): Computed<T> {
    const ticker = new Ticker()
    for (const source of observables) ticker.observe(source)

    const getSnapshot = (): T => {
      const values = observables.map(source => source.getSnapshot()) as IValueList<S>
      return transform(values)
    }

    const observable: IObservable<T> = new Observable<T>(getSnapshot(), options)
    observable.registerDisposable(ticker)

    const subscriber: ISubscriber<number> = new Subscriber<number>({
      onNext: () => observable.next(getSnapshot()),
    })
    ticker.subscribe(subscriber)

    return new Computed<T>(observable)
  }

  public get disposed(): boolean {
    return this._observable.disposed
  }

  public dispose(): void {
    if (!this._observable.disposed) {
      this._observable.dispose()
    }
  }

  public registerDisposable<T extends IDisposable>(disposable: T): void {
    this._observable.registerDisposable(disposable)
  }

  public subscribe(subscriber: ISubscriber<T>): IUnsubscribable {
    return this._observable.subscribe(subscriber)
  }

  public readonly getSnapshot = (): T => {
    return this._observable.getSnapshot()
  }

  public readonly getServerSnapshot = (): T => {
    return this._observable.getSnapshot()
  }

  public readonly subscribeStateChange = (onStateChange: () => void): (() => void) => {
    const subscriber: ISubscriber<T> = new Subscriber<T>({ onNext: () => onStateChange() })
    const unsubscribable = this._observable.subscribe(subscriber)
    const disposable: IDisposable = new Disposable(() => {
      subscriber.dispose()
      unsubscribable.unsubscribe()
    })
    this._observable.registerDisposable(disposable)
    return () => disposable.dispose()
  }
}
