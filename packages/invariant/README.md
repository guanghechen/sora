<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/invariant@7.0.0/packages/invariant#readme">@guanghechen/invariant</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/invariant">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/invariant.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/invariant">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/invariant.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/invariant">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/invariant.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/invariant"
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

A simple invariant function that throws an error when the given condition fails. Error messages are
stripped in production builds (`NODE_ENV === 'production'`) for smaller bundle size.

## Install

- npm

  ```bash
  npm install --save @guanghechen/invariant
  ```

- yarn

  ```bash
  yarn add @guanghechen/invariant
  ```

## Usage

### Basic Usage

```typescript
import invariant from '@guanghechen/invariant'

function divide(a: number, b: number): number {
  invariant(b !== 0, 'Division by zero is not allowed')
  return a / b
}

divide(10, 2) // 5
divide(10, 0) // throws Error: "Invariant failed: Division by zero is not allowed"
```

### With Lazy Message

Use a function for expensive message computation:

```typescript
import { invariant } from '@guanghechen/invariant'

function processUser(user: User | null) {
  invariant(user !== null, () => `User not found: ${JSON.stringify(context)}`)
  // TypeScript now knows `user` is not null
  return user.name
}
```

### TypeScript Type Narrowing

The function uses `asserts condition` for proper type narrowing:

```typescript
import invariant from '@guanghechen/invariant'

function getValue(map: Map<string, number>, key: string): number {
  const value = map.get(key)
  invariant(value !== undefined, `Key "${key}" not found in map`)
  // TypeScript knows `value` is `number` here, not `number | undefined`
  return value
}
```

### API

```typescript
function invariant(
  condition: boolean,
  message?: string | (() => string) | null,
): asserts condition
```

- `condition`: The condition to assert. If falsy, an error is thrown.
- `message`: Optional error message (string or function returning string).

## Reference

- [homepage][homepage]
- Inspired by [tiny-invariant][tiny-invariant]

[homepage]: https://github.com/guanghechen/sora/tree/@guanghechen/invariant@7.0.0/packages/invariant#readme
[tiny-invariant]: https://github.com/alexreardon/tiny-invariant
