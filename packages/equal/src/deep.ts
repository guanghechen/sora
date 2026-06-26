/**
 * Inspired by https://github.com/epoberezkin/fast-deep-equal.
 *
 * @param x
 * @param y
 * @returns
 */
export function isEqual(x: any, y: any): boolean {
  if (x === null || y === null) return x === y
  if (x === undefined || y === undefined) return x === y
  if (typeof x !== typeof y) return false
  if (Object.is(x, y)) return true

  if (typeof x === 'object') {
    if (x.constructor !== y.constructor) return false

    if (Array.isArray(x)) {
      if (x.length !== y.length) return false
      for (let i = 0; i < x.length; ++i) {
        if (!isEqual(x[i], y[i])) return false
      }
      return true
    }

    if (x instanceof Map) {
      if (x.size !== y.size) return false
      // Keys are matched by SameValueZero (Map.has/get); values are compared deeply.
      for (const [key, value] of x) {
        if (!y.has(key) || !isEqual(value, y.get(key))) return false
      }
      return true
    }

    if (x instanceof Set) {
      if (x.size !== y.size) return false
      // Elements are matched by SameValueZero (Set.has), not deeply, mirroring fast-deep-equal.
      for (const value of x) {
        if (!y.has(value)) return false
      }
      return true
    }

    if (ArrayBuffer.isView(x)) {
      // DataView has no indexed elements; compare it byte-wise.
      if (x instanceof DataView) {
        if (x.byteLength !== y.byteLength) return false
        for (let i = 0; i < x.byteLength; ++i) {
          if (x.getUint8(i) !== y.getUint8(i)) return false
        }
        return true
      }
      // Typed arrays: compare element-wise. constructor equality is already checked above.
      // Use Object.is so NaN/-0 elements follow the same semantics as the top-level comparison.
      const lhs = x as Uint8Array
      const rhs = y as Uint8Array
      if (lhs.length !== rhs.length) return false
      for (let i = 0; i < lhs.length; ++i) {
        if (!Object.is(lhs[i], rhs[i])) return false
      }
      return true
    }

    if (x instanceof ArrayBuffer) {
      // Raw ArrayBuffer: compare the underlying bytes.
      if (x.byteLength !== y.byteLength) return false
      // A detached buffer reports byteLength 0; short-circuit before new Uint8Array (which
      // throws on a detached buffer).
      if (x.byteLength === 0) return true
      const lhs = new Uint8Array(x)
      const rhs = new Uint8Array(y)
      for (let i = 0; i < lhs.length; ++i) {
        if (lhs[i] !== rhs[i]) return false
      }
      return true
    }

    if (x.constructor === RegExp) return x.source === y.source && x.flags === y.flags
    // Use a custom valueOf/toString only when both sides expose it as a callable: null-prototype
    // objects have neither, and a non-function override on the other side must not be invoked.
    if (typeof x.valueOf === 'function' && x.valueOf !== Object.prototype.valueOf) {
      if (typeof y.valueOf !== 'function') return false
      return x.valueOf() === y.valueOf()
    }
    if (typeof x.toString === 'function' && x.toString !== Object.prototype.toString) {
      if (typeof y.toString !== 'function') return false
      return x.toString() === y.toString()
    }

    const keys = Object.keys(x)
    if (keys.length !== Object.keys(y).length) return false

    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(y, key)) return false
    }

    for (const key of keys) {
      // React-specific: avoid traversing React elements' _owner.
      //  _owner contains circular references
      // and is not needed when comparing the actual elements (and not their owners)
      /* c8 ignore next */
      if (key === '_owner' && x.$$typeof) continue

      if (!isEqual(x[key], y[key])) return false
    }

    return true
  }

  return false
}

export default isEqual
