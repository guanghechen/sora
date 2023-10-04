import { isEqual } from '../src'

describe('isEqual', () => {
  it('should return true for equal values', () => {
    expect(isEqual(5, 5)).toBe(true)
    expect(isEqual('hello', 'hello')).toBe(true)
    expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    expect(isEqual({}, {})).toBe(true)
    expect(isEqual([], [])).toBe(true)
    expect(isEqual(Number(1), 1)).toBe(true)
    expect(isEqual(undefined, undefined)).toBe(true)
    expect(isEqual(null, null)).toBe(true)
    expect(isEqual(NaN, NaN)).toBe(true)
    expect(isEqual(/abc/g, new RegExp('abc', 'g'))).toBe(true)
  })

  it('should return false for unequal values', () => {
    expect(isEqual(5, 10)).toBe(false)
    expect(isEqual('hello', 'world')).toBe(false)
    expect(isEqual([1, 2, 3], [1, 2])).toBe(false)
    expect(isEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
    expect(isEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false)
    expect(isEqual(Number(1), Boolean(true))).toBe(false)
    expect(isEqual(undefined, null)).toBe(false)
    expect(isEqual(null, undefined)).toBe(false)
    expect(isEqual(null, {})).toBe(false)
    expect(isEqual({}, null)).toBe(false)
    expect(isEqual(NaN, 0)).toBe(false)
    expect(isEqual(/abc/gi, new RegExp('abc', 'g'))).toBe(false)
    expect(isEqual(/abcd/g, new RegExp('abc', 'g'))).toBe(false)
  })

  it('should handle complex objects', () => {
    const obj1 = { a: 1, b: { c: [1, 2, 3] } }
    const obj2 = { a: 1, b: { c: [1, 2, 3] } }
    const obj3 = { a: 1, b: { c: [1, 2, 4] } }

    expect(isEqual(obj1, obj2)).toBe(true)
    expect(isEqual(obj1, obj3)).toBe(false)
  })

  it('should handle special cases', () => {
    expect(isEqual(undefined, undefined)).toBe(true)
    expect(isEqual(null, null)).toBe(true)
    expect(isEqual(NaN, NaN)).toBe(true)
    expect(isEqual(0, -0)).toBe(false)
    expect(isEqual(Infinity, Infinity)).toBe(true)
  })

  it('should not equal with different constructor', () => {
    class F1 {
      public readonly name: string
      constructor() {
        this.name = 'waw'
      }
    }

    class F2 {
      public readonly name: string
      constructor() {
        this.name = 'waw'
      }
    }

    expect(isEqual(new F1(), new F1())).toEqual(true)
    expect(isEqual(new F2(), new F2())).toEqual(true)
    expect(isEqual(new F1(), new F2())).toEqual(false)
  })

  it('call customized valueOf', () => {
    class F {
      private static male = { gender: 'male' }
      private static female = { gender: 'female' }

      constructor(readonly age: number) {}

      public valueOf(): object {
        return this.age > 10 ? F.male : F.female
      }
    }

    expect(isEqual(new F(8), new F(8))).toEqual(true)
    expect(isEqual(new F(8), new F(9))).toEqual(true)
    expect(isEqual(new F(8), new F(11))).toEqual(false)
    expect(isEqual(new F(11), new F(11))).toEqual(true)
    expect(isEqual(new F(11), new F(12))).toEqual(true)
  })

it('call customized toString', () => {
    class F {
      constructor(readonly age: number) {}

      public toString(): string {
        return 'gender:' + (this.age > 10 ? 'male' : 'female')
      }
    }

    expect(isEqual(new F(8), new F(8))).toEqual(true)
    expect(isEqual(new F(8), new F(9))).toEqual(true)
    expect(isEqual(new F(8), new F(11))).toEqual(false)
    expect(isEqual(new F(11), new F(11))).toEqual(true)
    expect(isEqual(new F(11), new F(12))).toEqual(true)
  })
})
