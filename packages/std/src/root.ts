/**
 * Copy & Paste from lodash.
 * @see https://github.com/lodash/lodash/blob/2da024c3b4f9947a48517639de7560457cd4ec6c/.internal/freeGlobal.js
 */

declare const self: (typeof globalThis & { Object: typeof Object }) | undefined
declare const global: (typeof globalThis & { Object: typeof Object }) | undefined

/** Detect free variable `globalThis` */
const freeGlobalThis =
  typeof globalThis === 'object' &&
  globalThis !== null &&
  globalThis.Object === Object &&
  globalThis

/** Detect free variable `global` (Node.js) */
const freeGlobal =
  typeof global === 'object' && global !== null && global.Object === Object && global

/** Detect free variable `self` (Browser/Web Worker) */
const freeSelf = typeof self === 'object' && self !== null && self.Object === Object && self

/** Used as a reference to the global object. */
export const root = freeGlobalThis || freeGlobal || freeSelf || Function('return this')()
