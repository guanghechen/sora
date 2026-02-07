<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/equal@2.0.0/packages/equal#readme">@guanghechen/equal</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/equal">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/equal.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/equal">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/equal.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/equal">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/equal.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/equal"
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

The fastest deep equal with ES6 Map, Set and Typed arrays support. Inspired by
[fast-deep-equal](https://github.com/epoberezkin/fast-deep-equal), re-published with ESM support.

## Install

- npm

  ```bash
  npm install --save @guanghechen/equal
  ```

- yarn

  ```bash
  yarn add @guanghechen/equal
  ```

## Usage

### Basic Comparison

```typescript
import isEqual from '@guanghechen/equal'

// Primitives
isEqual(1, 1)           // true
isEqual('a', 'a')       // true
isEqual(null, null)     // true
isEqual(undefined, undefined) // true

// Objects
isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })  // true
isEqual({ a: 1 }, { a: 2 })              // false

// Arrays
isEqual([1, 2, 3], [1, 2, 3])  // true
isEqual([1, 2], [1, 2, 3])     // false

// Nested structures
isEqual(
  { user: { name: 'John', tags: ['admin'] } },
  { user: { name: 'John', tags: ['admin'] } }
) // true
```

### Named Export

```typescript
import { isEqual } from '@guanghechen/equal'

isEqual({ foo: 'bar' }, { foo: 'bar' }) // true
```

### Special Types

```typescript
import isEqual from '@guanghechen/equal'

// RegExp
isEqual(/abc/gi, /abc/gi)  // true
isEqual(/abc/g, /abc/i)    // false

// Date
isEqual(new Date('2024-01-01'), new Date('2024-01-01'))  // true

// Custom valueOf/toString
class Point {
  constructor(public x: number, public y: number) {}
  valueOf() { return this.x * 1000 + this.y }
}
isEqual(new Point(1, 2), new Point(1, 2))  // true
```

## Reference

- [homepage][homepage]
- Inspired by [fast-deep-equal](https://github.com/epoberezkin/fast-deep-equal)

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/equal@2.0.0/packages/equal#readme
