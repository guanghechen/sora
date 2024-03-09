import type { IObservableNextOptions } from '@guanghechen/observable'
import { ObservableCollection } from './observable-collection'
import type { IImmutableMap } from './types/collection'
import type { IObservableMap } from './types/observable'

export class ObservableMap<K, V, C extends IImmutableMap<K, V>>
  extends ObservableCollection<K, V, C>
  implements IObservableMap<K, V, C>
{
  public set(key: K, value: V, options?: IObservableNextOptions): void {
    const nextValue: C = this._value.set(key, value)
    this.next(nextValue, options)
  }

  public delete(key: K, options?: IObservableNextOptions): void {
    const nextValue: C = this._value.delete(key)
    this.next(nextValue, options)
  }

  public deleteAll(keys: Iterable<K>, options?: IObservableNextOptions): void {
    const nextValue: C = this._value.withMutations(mutable => {
      for (const key of keys) mutable.delete(key)
    })
    this.next(nextValue, options)
  }

  public merge(entries: Iterable<[K, V]>, options?: IObservableNextOptions): void {
    const nextValue: C = this._value.withMutations(mutable => {
      for (const [key, val] of entries) mutable.set(key, val)
    })
    this.next(nextValue, options)
  }
}
