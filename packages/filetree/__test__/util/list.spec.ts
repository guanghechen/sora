import { immutableInsert, immutableRemove, immutableReplace } from '../../src'

describe('immutable', () => {
  const BASELINE: ReadonlyArray<number> = [5, 6, 7, 8]
  const originalList: ReadonlyArray<number> = BASELINE.slice()

  afterEach(() => {
    // eslint-disable-next-line jest/no-standalone-expect
    expect(originalList).toEqual(BASELINE)
  })

  describe('immutableReplace', () => {
    test('bad index', () => {
      expect(immutableReplace(originalList, -1, 0)).toBe(originalList)
      expect(immutableReplace(originalList, originalList.length, 0)).toBe(originalList)
    })

    test('same element', () => {
      expect(immutableReplace(originalList, 0, originalList[0])).toBe(originalList)
      expect(immutableReplace(originalList, 1, originalList[1])).toBe(originalList)
      expect(immutableReplace(originalList, 2, originalList[2])).toBe(originalList)
    })

    test('replace at first', () => {
      expect(immutableReplace(originalList, 0, 0)).toEqual([0].concat(originalList.slice(1)))
    })

    test('replace at last', () => {
      expect(immutableReplace(originalList, originalList.length - 1, 0)).toEqual(
        originalList.slice(0, -1).concat(0),
      )
    })

    test('replace at middle', () => {
      expect(immutableReplace(originalList, 2, 0)).toEqual([5, 6, 0, 8])
    })
  })

  describe('immutableInsert', () => {
    test('bad index', () => {
      expect(immutableInsert(originalList, -1, 0)).toBe(originalList)
      expect(immutableInsert(originalList, originalList.length + 1, 0)).toBe(originalList)
    })

    test('insert at first', () => {
      expect(immutableInsert(originalList, 0, 0)).toEqual([0].concat(originalList))
    })

    test('insert at last', () => {
      expect(immutableInsert(originalList, originalList.length, 0)).toEqual(originalList.concat(0))
    })

    test('insert at middle', () => {
      expect(immutableInsert(originalList, 2, 0)).toEqual([5, 6, 0, 7, 8])
    })
  })

  describe('immutableRemove', () => {
    test('bad index', () => {
      expect(immutableRemove(originalList, -1)).toBe(originalList)
      expect(immutableRemove(originalList, originalList.length)).toBe(originalList)
    })

    test('remove first', () => {
      expect(immutableRemove(originalList, 0)).toEqual(originalList.slice(1))
    })

    test('remove last', () => {
      expect(immutableRemove(originalList, originalList.length - 1)).toEqual(
        originalList.slice(0, -1),
      )
    })

    test('remove middle', () => {
      expect(immutableRemove(originalList, 2)).toEqual([5, 6, 8])
    })
  })
})
