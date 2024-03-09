import { Observable, isObservable } from '../src'

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
