/**
 * Copy & Paste from lodash.
 * @see https://github.com/lodash/lodash/blob/2da024c3b4f9947a48517639de7560457cd4ec6c/.internal/freeGlobal.js
 */

// global globalThis, self
const freeGlobal =
  typeof global === 'object' && global !== null && global.Object === Object && global

/** Detect free variable `globalThis` */
const freeGlobalThis =
  typeof globalThis === 'object' &&
  globalThis !== null &&
  globalThis.Object === Object &&
  globalThis

/** Detect free variable `self`. */
// eslint-disable-next-line no-restricted-globals
const freeSelf = typeof self === 'object' && self !== null && self.Object === Object && self

/** Used as a reference to the global object. */
// eslint-disable-next-line no-new-func
export const root = freeGlobalThis || freeGlobal || freeSelf || Function('return this')()
