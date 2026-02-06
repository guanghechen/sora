import { Observable, isObservable, noop, noopUnobservable, noopUnsubscribable } from '../src'

test('noop', () => {
  noop()
  noop(1, 2, 3)
})

test('noopUnsubscribable', () => {
  noopUnsubscribable.unsubscribe()
})

test('noopUnobservable', () => {
  noopUnobservable.unobserve()
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
