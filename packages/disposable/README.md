<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/disposable@1.0.3/packages/disposable#readme">@guanghechen/disposable</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/disposable">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/disposable.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/disposable">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/disposable.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/disposable">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/disposable.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/disposable"
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

Disposable pattern implementation for resource cleanup and memory management.

## Install

- npm

  ```bash
  npm install --save @guanghechen/disposable
  ```

- yarn

  ```bash
  yarn add @guanghechen/disposable
  ```

## Usage

|        Name        |                        Description                        |
| :----------------: | :-------------------------------------------------------: |
|   `Disposable`     |     Single disposable resource with cleanup callback     |
| `BatchDisposable`  |     Batch disposable for managing multiple resources     |
|   `disposeAll`     |        Utility to dispose all disposable items           |
|  `isDisposable`    |      Type guard to check if object is disposable         |

## Example

- Basic disposable:

  ```typescript
  import { Disposable } from '@guanghechen/disposable'

  const resource = new Disposable(() => {
    console.log('Resource cleaned up!')
  })

  console.log(resource.disposed) // false
  resource.dispose()
  console.log(resource.disposed) // true
  // Output: "Resource cleaned up!"
  ```

- Batch disposable:

  ```typescript
  import { BatchDisposable, Disposable } from '@guanghechen/disposable'

  const batch = new BatchDisposable()

  const resource1 = new Disposable(() => console.log('Resource 1 disposed'))
  const resource2 = new Disposable(() => console.log('Resource 2 disposed'))

  batch.registerDisposable(resource1)
  batch.registerDisposable(resource2)

  batch.dispose()
  // Output: "Resource 1 disposed"
  // Output: "Resource 2 disposed"
  ```

- Utility functions:

  ```typescript
  import { disposeAll, isDisposable } from '@guanghechen/disposable'

  const items = [
    new Disposable(() => console.log('Disposed 1')),
    new Disposable(() => console.log('Disposed 2')),
    'not disposable'
  ]

  items.forEach(item => {
    if (isDisposable(item)) {
      console.log('Item is disposable')
    }
  })

  disposeAll(items) // Disposes all disposable items in the array
  ```

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/disposable@1.0.3/packages/disposable#readme