import { ObservableCollection } from './observable-collection'
import type {
  IImmutableSet,
  IObservableKeyChange,
  IObservablePrimitiveValue,
  IObservableSet,
  IScheduleTransaction,
} from './types'

export class ObservableSet<V extends IObservablePrimitiveValue, C extends IImmutableSet<V>>
  extends ObservableCollection<V, V, C>
  implements IObservableSet<V, C>
{
  public add(value: V, transaction?: IScheduleTransaction): void {
    if (this._value.has(value)) return

    const changes: Array<IObservableKeyChange<V, V>> = [{ key: value, value, prevValue: undefined }]
    const prevValue: C = this._value
    const nextValue: C = this._value.add(value)
    this._value = nextValue
    this.notify(nextValue, prevValue, changes, transaction)
  }

  public addAll(values: Iterable<V>, transaction?: IScheduleTransaction): void {
    const changes: Array<IObservableKeyChange<V, V>> = []
    for (const value of values) {
      if (this._value.has(value)) continue
      changes.push({ key: value, value, prevValue: undefined })
    }

    if (changes.length <= 0) return

    const prevValue: C = this._value
    const nextValue: C = this._value.withMutations(mutable => {
      for (const change of changes) mutable.add(change.key)
    })
    this._value = nextValue
    this.notify(nextValue, prevValue, changes, transaction)
  }

  public delete(value: V, transaction?: IScheduleTransaction): void {
    if (!this._value.has(value)) return

    const changes: Array<IObservableKeyChange<V, V>> = [
      { key: value, value: undefined, prevValue: value },
    ]
    const prevValue: C = this._value
    const nextValue: C = this._value.delete(value)
    this._value = nextValue
    this.notify(nextValue, prevValue, changes, transaction)
  }

  public deleteAll(values: Iterable<V>, transaction?: IScheduleTransaction): void {
    const changes: Array<IObservableKeyChange<V, V>> = []
    for (const value of values) {
      if (this._value.has(value)) {
        changes.push({ key: value, value: undefined, prevValue: value })
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

  public override next(value: C, transaction?: IScheduleTransaction | undefined): void {
    const changes: Array<IObservableKeyChange<V, V>> = []
    const prevValue: C = this._value

    // Deleted values.
    for (const keyValue of prevValue.values()) {
      if (value.has(keyValue)) continue
      changes.push({ key: keyValue, value: undefined, prevValue: keyValue })
    }

    // Added keys or changed keys.
    for (const keyValue of value.values()) {
      if (prevValue.has(keyValue)) continue
      changes.push({ key: keyValue, value: keyValue, prevValue: undefined })
    }

    if (changes.length <= 0) return

    const nextValue: C = value
    this._value = nextValue
    this.notify(nextValue, prevValue, changes, transaction)
  }
}
