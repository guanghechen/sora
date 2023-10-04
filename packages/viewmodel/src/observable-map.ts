import { ObservableCollection } from './observable-collection'
import type {
  IImmutableMap,
  IObservableKeyChange,
  IObservableMap,
  IObservableValue,
  IScheduleTransaction,
} from './types'

export class ObservableMap<K, V extends IObservableValue, C extends IImmutableMap<K, V>>
  extends ObservableCollection<K, V, C>
  implements IObservableMap<K, V, C>
{
  public set(key: K, value: V, transaction?: IScheduleTransaction): void {
    const prevKeyValue: V | undefined = this._value.get(key)
    const nextKeyValue = value
    if (this.valueEquals(nextKeyValue, prevKeyValue)) return

    const changes: Array<IObservableKeyChange<K, V>> = [{ key, value, prevValue: prevKeyValue }]

    const prevValue: C = this._value
    const nextValue: C = this._value.set(key, nextKeyValue)
    this._value = nextValue
    this.notify(nextValue, prevValue, changes, transaction)
  }

  public delete(key: K, transaction?: IScheduleTransaction): void {
    if (!this._value.has(key)) return

    const prevKeyValue: V | undefined = this._value.get(key)
    const changes: Array<IObservableKeyChange<K, V>> = [
      { key, value: undefined, prevValue: prevKeyValue },
    ]

    const prevValue: C = this._value
    const nextValue: C = this._value.delete(key)
    this._value = nextValue
    this.notify(nextValue, prevValue, changes, transaction)
  }

  public deleteAll(keys: Iterable<K>, transaction?: IScheduleTransaction): void {
    const changes: Array<IObservableKeyChange<K, V>> = []
    for (const key of keys) {
      if (this._value.has(key)) {
        const prevKeyValue: V | undefined = this._value.get(key)
        changes.push({ key, value: undefined, prevValue: prevKeyValue })
      }
    }

    if (changes.length <= 0) return

    const prevValue: C = this._value
    const nextValue: C = this._value.withMutations(mutable => {
      for (const change of changes) mutable.delete(change.key)
    })
    this._value = nextValue
    this.notify(nextValue, prevValue, changes, transaction)
  }

  public merge(entries: Iterable<[K, V]>, transaction?: IScheduleTransaction): void {
    const changes: Array<IObservableKeyChange<K, V>> = []
    for (const [key, nextKeyValue] of entries) {
      const prevKeyValue: V | undefined = this._value.get(key)
      if (!this.valueEquals(nextKeyValue, prevKeyValue)) {
        changes.push({ key, value: nextKeyValue, prevValue: prevKeyValue })
      }
    }

    if (changes.length <= 0) return

    const prevValue: C = this._value
    const nextValue: C = this._value.merge(changes.map(c => [c.key, c.value!]))
    this._value = nextValue
    this.notify(nextValue, prevValue, changes, transaction)
  }

  public override next(value: C, transaction?: IScheduleTransaction): void {
    const changes: Array<IObservableKeyChange<K, V>> = []
    const prevValue: C = this._value

    // Deleted keys.
    for (const [key, prevKeyValue] of prevValue.entries()) {
      if (value.has(key)) continue
      changes.push({ key, value: undefined, prevValue: prevKeyValue })
    }

    // Added keys or changed keys.
    for (const [key, nextKeyValue] of value.entries()) {
      if (prevValue.has(key)) continue

      const prevKeyValue = prevValue.get(key)
      if (this.valueEquals(nextKeyValue, prevKeyValue)) continue

      changes.push({ key, value: nextKeyValue, prevValue: undefined })
    }

    if (changes.length <= 0) return

    const nextValue: C = value
    this._value = nextValue
    this.notify(nextValue, prevValue, changes, transaction)
  }
}
