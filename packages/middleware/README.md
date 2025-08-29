<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/middleware@1.0.6/packages/middleware#readme">@guanghechen/middleware</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/middleware">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/middleware.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/middleware">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/middleware.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/middleware">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/middleware.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/middleware"
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

Middleware pattern implementation for both synchronous and asynchronous processing pipelines.

## Install

- npm

  ```bash
  npm install --save @guanghechen/middleware
  ```

- yarn

  ```bash
  yarn add @guanghechen/middleware
  ```

## Usage

|        Name         |                        Description                        |
| :-----------------: | :-------------------------------------------------------: |
| `AsyncMiddlewares`  |   Asynchronous middleware chain for processing data      |
|   `Middlewares`     |   Synchronous middleware chain for processing data       |

## Example

- Async middleware:

  ```typescript
  import { AsyncMiddlewares } from '@guanghechen/middleware'

  const middlewares = new AsyncMiddlewares<string, string, any>()

  // Add middlewares
  middlewares.use(async (input, embryo, api, next) => {
    const result = await next(input.toUpperCase())
    return result
  })

  middlewares.use(async (input, embryo, api, next) => {
    const result = await next(`[${input}]`)
    return result
  })

  // Execute middleware chain
  const reducer = middlewares.reducer('hello', {})
  const result = await reducer(null) // Result: "[HELLO]"
  ```

- Sync middleware:

  ```typescript
  import { Middlewares } from '@guanghechen/middleware'

  const middlewares = new Middlewares<number, number, any>()

  middlewares.use((input, embryo, api, next) => {
    return next(input * 2)
  })

  middlewares.use((input, embryo, api, next) => {
    return next(input + 1)
  })

  const reducer = middlewares.reducer(5, {})
  const result = reducer(null) // Result: 11 (5 * 2 + 1)
  ```

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/middleware@1.0.6/packages/middleware#readme