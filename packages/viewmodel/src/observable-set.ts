import type { IObservableNextOptions } from '@guanghechen/observable'
import { ObservableCollection } from './observable-collection'
import type { IImmutableSet } from './types/collection'
import type { IObservableSet } from './types/observable'

export class ObservableSet<V, C extends IImmutableSet<V>>
  extends ObservableCollection<V, V, C>
  implements IObservableSet<V, C>
{
  public add(value: V, options?: IObservableNextOptions): void {
    const nextValue: C = this._value.add(value)
    this.next(nextValue, options)
  }

  public addAll(values: Iterable<V>, options?: IObservableNextOptions): void {
    const nextValue: C = this._value.withMutations(mutable => {
      for (const value of values) mutable.add(value)
    })
    this.next(nextValue, options)
  }

  public delete(value: V, options?: IObservableNextOptions): void {
    const nextValue: C = this._value.delete(value)
    this.next(nextValue, options)
  }

  public deleteAll(values: Iterable<V>, options?: IObservableNextOptions): void {
    const nextValue: C = this._value.withMutations(mutable => {
      for (const value of values) mutable.delete(value)
    })
    this.next(nextValue, options)
  }
}
