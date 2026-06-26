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

  it('should compare Map by entries (keys by identity, values deeply)', () => {
    expect(isEqual(new Map(), new Map())).toBe(true)
    expect(isEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true)
    // values are compared deeply
    expect(isEqual(new Map([['a', { b: [1, 2] }]]), new Map([['a', { b: [1, 2] }]]))).toBe(true)
    expect(isEqual(new Map([['a', { b: [1, 2] }]]), new Map([['a', { b: [1, 3] }]]))).toBe(false)
    // size mismatch
    expect(isEqual(new Map([['a', 1]]), new Map())).toBe(false)
    // same size, different key
    expect(isEqual(new Map([['a', 1]]), new Map([['b', 1]]))).toBe(false)
    // same key, different value
    expect(isEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false)
  })

  it('should compare Set by elements (matched by identity)', () => {
    expect(isEqual(new Set(), new Set())).toBe(true)
    expect(isEqual(new Set([1, 2, 3]), new Set([3, 2, 1]))).toBe(true)
    // size mismatch
    expect(isEqual(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false)
    // same size, different element
    expect(isEqual(new Set([1, 2, 3]), new Set([1, 2, 4]))).toBe(false)
    // elements are matched by identity, not deeply
    expect(isEqual(new Set([{ a: 1 }]), new Set([{ a: 1 }]))).toBe(false)
  })

  it('should compare typed arrays element-wise', () => {
    expect(isEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(isEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
    expect(isEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false)
    // different typed array constructors are not equal
    expect(isEqual(new Uint8Array([1, 2, 3]), new Int8Array([1, 2, 3]))).toBe(false)
    // Object.is semantics for float elements: NaN equals NaN, +0 differs from -0
    expect(isEqual(new Float64Array([NaN]), new Float64Array([NaN]))).toBe(true)
    expect(isEqual(new Float64Array([0]), new Float64Array([-0]))).toBe(false)
  })

  it('should compare DataView byte-wise', () => {
    const mk = (bytes: number[]): DataView => {
      const dv = new DataView(new ArrayBuffer(bytes.length))
      bytes.forEach((b, i) => dv.setUint8(i, b))
      return dv
    }
    expect(isEqual(mk([1, 2, 3]), mk([1, 2, 3]))).toBe(true)
    expect(isEqual(mk([1, 2, 3]), mk([1, 2, 4]))).toBe(false)
    expect(isEqual(mk([1, 2, 3]), mk([1, 2]))).toBe(false)
  })

  it('should compare DataView relative to its byteOffset', () => {
    // dv1/dv2 view bytes [1,2,3] starting at offset 1; the byte at offset 0 differs but is
    // outside the view, so getUint8 (offset-relative) must treat them as equal.
    const dv1 = new DataView(new Uint8Array([0, 1, 2, 3]).buffer, 1)
    const dv2 = new DataView(new Uint8Array([9, 1, 2, 3]).buffer, 1)
    expect(isEqual(dv1, dv2)).toBe(true)
    const dv3 = new DataView(new Uint8Array([0, 1, 2, 9]).buffer, 1)
    expect(isEqual(dv1, dv3)).toBe(false)
  })

  it('should compare raw ArrayBuffer by bytes', () => {
    expect(isEqual(new Uint8Array([1, 2, 3]).buffer, new Uint8Array([1, 2, 3]).buffer)).toBe(true)
    expect(isEqual(new Uint8Array([1, 2, 3]).buffer, new Uint8Array([1, 2, 4]).buffer)).toBe(false)
    expect(isEqual(new Uint8Array([1, 2, 3]).buffer, new Uint8Array([1, 2]).buffer)).toBe(false)
  })

  it('should not throw on a detached ArrayBuffer', () => {
    const a = new Uint8Array([1, 2, 3]).buffer
    const b = new Uint8Array([1, 2, 3]).buffer
    structuredClone(a, { transfer: [a] }) // detaches a (byteLength -> 0)
    structuredClone(b, { transfer: [b] }) // detaches b
    expect(() => isEqual(a, b)).not.toThrow()
    expect(isEqual(a, b)).toBe(true)
  })

  it('should compare null-prototype objects without throwing', () => {
    const a = Object.create(null)
    a.x = 1
    a.y = { z: [1, 2] }
    const b = Object.create(null)
    b.x = 1
    b.y = { z: [1, 2] }
    expect(isEqual(a, b)).toBe(true)

    const c = Object.create(null)
    c.x = 2
    expect(isEqual(a, c)).toBe(false)
  })

  it('should not throw when only one side has a callable valueOf/toString', () => {
    expect(isEqual({ valueOf: () => 1 }, { valueOf: 1 })).toBe(false)
    expect(isEqual({ toString: () => 'a' }, { toString: 'a' })).toBe(false)
  })

  it('should compare Date by timestamp', () => {
    expect(isEqual(new Date('2024-01-01'), new Date('2024-01-01'))).toBe(true)
    expect(isEqual(new Date('2024-01-01'), new Date('2024-01-02'))).toBe(false)
  })
})
