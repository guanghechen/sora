<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/std@2.0.0/packages/std#readme">@guanghechen/std</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/std">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/std.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/std">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/std.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/std">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/std.svg"
      />
    </a>
    <a href="#install">
      <img
        alt="Module Formats: cjs, esm"
        src="https://img.shields.io/badge/module_formats-cjs%2C%20esm-green.svg"
      />
    </a>
    <a href="https://github.com/nodejs/node">
      <img
        alt="Node.js Version"
        src="https://img.shields.io/node/v/@guanghechen/std"
      />
    </a>
    <a href="https://github.com/facebook/jest">
      <img
        alt="Tested with Jest"
        src="https://img.shields.io/badge/tested_with-jest-9c465e.svg"
      />
    </a>
    <a href="https://github.com/prettier/prettier">
      <img
        alt="Code Style: prettier"
        src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square"
      />
    </a>
  </div>
</header>
<br/>

Standard utility functions for type checking, iterable operations, and common helper functions.

## Install

- npm

  ```bash
  npm install --save @guanghechen/std
  ```

- yarn

  ```bash
  yarn add @guanghechen/std
  ```

## Usage

### Type Checking Functions

```typescript
import {
  isArray,
  isString,
  isNumber,
  isObject,
  isFunction,
  isPromise,
  isPlainObject,
  isNonBlankString,
  isNotEmptyArray,
} from '@guanghechen/std'

isArray([1, 2, 3])      // true
isString('hello')       // true
isNumber(42)            // true
isObject({})            // true
isFunction(() => {})    // true
isPromise(Promise.resolve()) // true

isPlainObject({})       // true
isPlainObject(new Date()) // false

isNonBlankString('')    // false
isNonBlankString('hi')  // true

isNotEmptyArray([])     // false
isNotEmptyArray([1])    // true
```

### Complete Type Check List

| Function                  | Description                                               |
| :-----------------------: | :-------------------------------------------------------: |
| `isArray`                 | Check if the given data is an `Array` type                |
| `isBigint`                | Check if the given data is a `bigint` type                |
| `isBoolean`               | Check if the given data is a `boolean` / `Boolean` type   |
| `isDate`                  | Check if the given data is a `Date` type                  |
| `isFunction`              | Check if the given data is a `Function` type              |
| `isAsyncFunction`         | Check if the given data is an `AsyncFunction` type        |
| `isInteger`               | Check if the given data is an `Integer` type              |
| `isNumber`                | Check if the given data is a `number` / `Number` type     |
| `isObject`                | Check if the given data is an `Object` type               |
| `isString`                | Check if the given data is a `string` / `String` type     |
| `isSymbol`                | Check if the given data is a `symbol` type                |
| `isUndefined`             | Check if the given data is `undefined`                    |
| `isPrimitiveBoolean`      | Check if the given data is a primitive `boolean`          |
| `isPrimitiveInteger`      | Check if the given data is a primitive integer            |
| `isPrimitiveNumber`       | Check if the given data is a primitive `number`           |
| `isPrimitiveString`       | Check if the given data is a primitive `string`           |
| `isNonBlankString`        | Check if the given data is a non-blank string             |
| `isNotEmptyArray`         | Check if the given data is a non-empty array              |
| `isNotEmptyObject`        | Check if the given data is a non-empty object             |
| `isEmptyObject`           | Check if the given data is an empty object                |
| `isNumberLike`            | Check if the given data is a number or number-like string |
| `isPlainObject`           | Check if the given data is a plain object                 |
| `isPromise`               | Check if the given data is a Promise                      |
| `isArrayOfT`              | Check if array elements match a type guard                |
| `isTwoDimensionArrayOfT`  | Check if 2D array elements match a type guard             |

### Helper Functions

```typescript
import { delay, noop, identity, truthy, falsy } from '@guanghechen/std'

// Delay execution
await delay(1000) // Wait 1 second

// No-operation function
const callback = noop // () => {}

// Identity function (returns input unchanged)
identity(42) // 42

// Always return true/false
truthy() // true
falsy()  // false
```

### Iterable Utilities

```typescript
import { filterIterable, mapIterable, iterable2map } from '@guanghechen/std'

const set = new Set([1, 2, 3, 4, 5])

// Filter iterable
const evens = filterIterable(set, x => x % 2 === 0) // [2, 4]

// Map iterable
const doubled = mapIterable(set, x => x * 2) // [2, 4, 6, 8, 10]

// Convert iterable to Map
const arr = ['foo', 'bar', 'baz']
const map = iterable2map(arr, (el, i) => `${el}-${i}`)
// Map { 'foo-0' => 'foo', 'bar-1' => 'bar', 'baz-2' => 'baz' }
```

### Global Root Reference

```typescript
import { root } from '@guanghechen/std'

// Cross-environment global reference (globalThis, global, self, or window)
root.setTimeout(() => {}, 100)
```

## Reference

- [homepage][homepage]

[homepage]: https://github.com/guanghechen/sora/tree/@guanghechen/std@2.0.0/packages/std#readme
