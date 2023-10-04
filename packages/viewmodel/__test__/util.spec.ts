import { BatchDisposable, Disposable, Observable, isDisposable, isObservable } from '../src'

test('isDisposable', () => {
  expect(isDisposable(null)).toEqual(false)
  expect(isDisposable(undefined)).toEqual(false)
  expect(isDisposable({})).toEqual(false)
  expect(isDisposable({ dispose: () => {} })).toEqual(false)
  expect(isDisposable({ disposed: false })).toEqual(false)
  expect(isDisposable({ dispose: () => {}, disposed: false })).toEqual(true)
  expect(isDisposable({ dispose: () => {}, disposed: true })).toEqual(true)
  expect(isDisposable(Disposable.fromCallback(() => {}))).toEqual(true)
  expect(isDisposable(Disposable.fromUnsubscribable({ unsubscribe: () => {} }))).toEqual(true)
  expect(isDisposable(new BatchDisposable())).toEqual(true)
})

test('isObservable', () => {
  expect(isObservable(null)).toEqual(false)
  expect(isObservable(undefined)).toEqual(false)
  expect(isObservable({})).toEqual(false)
  expect(
    isObservable({
      dispose: () => {},
      disposed: false,
      subscribe: () => {},
      equals: () => {},
      getSnapshot: () => {},
    }),
  ).toEqual(false)
  expect(
    isObservable({
      dispose: () => {},
      disposed: false,
      subscribe: () => {},
      equals: () => {},
      getSnapshot: () => {},
      next: () => {},
    }),
  ).toEqual(true)
  expect(isObservable(new Observable(1))).toEqual(true)
})
