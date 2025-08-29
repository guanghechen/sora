<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/observable@6.1.8/packages/observable#readme">@guanghechen/observable</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/observable">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/observable.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/observable">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/observable.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/observable">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/observable.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/observable"
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

Observable pattern implementation with ticker functionality for reactive programming.

## Install

- npm

  ```bash
  npm install --save @guanghechen/observable
  ```

- yarn

  ```bash
  yarn add @guanghechen/observable
  ```

## Usage

|       Name       |                        Description                        |
| :--------------: | :-------------------------------------------------------: |
|   `Observable`   |     Reactive observable value with change notification   |
|    `Ticker`      |     Timer-based ticker for scheduled notifications       |

## Example

- Basic observable:

  ```typescript
  import { Observable } from '@guanghechen/observable'
  import { Subscriber } from '@guanghechen/subscriber'

  const observable = new Observable<number>(0)

  // Create a subscriber
  const subscriber = new Subscriber({
    onNext: (newValue, oldValue) => {
      console.log(`Value changed from ${oldValue} to ${newValue}`)
    },
    onDispose: () => {
      console.log('Subscriber disposed')
    }
  })

  // Subscribe to changes
  const unsubscribe = observable.subscribe(subscriber)

  observable.next(1) // Output: "Value changed from undefined to 1"
  observable.next(2) // Output: "Value changed from 1 to 2"

  unsubscribe.unsubscribe()
  ```

- Observable with custom equality:

  ```typescript
  import { Observable } from '@guanghechen/observable'
  import { Subscriber } from '@guanghechen/subscriber'

  const observable = new Observable<{id: number, name: string}>(
    { id: 1, name: 'John' },
    { equals: (a, b) => a.id === b.id }
  )

  const subscriber = new Subscriber({
    onNext: (newVal) => {
      console.log('Object changed:', newVal)
    }
  })

  observable.subscribe(subscriber)

  // This won't trigger notification (same id)
  observable.next({ id: 1, name: 'Jane' })

  // This will trigger notification (different id)
  observable.next({ id: 2, name: 'Bob' })
  ```

- Using ticker:

  ```typescript
  import { Ticker } from '@guanghechen/observable'
  import { Subscriber } from '@guanghechen/subscriber'

  const ticker = new Ticker<string>('initial', { interval: 1000 })

  const subscriber = new Subscriber({
    onNext: (value) => {
      console.log('Ticker value:', value)
    }
  })

  ticker.subscribe(subscriber)
  ticker.start()
  
  // Update ticker value
  setTimeout(() => {
    ticker.next('updated value')
  }, 2000)
  ```

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/observable@6.1.8/packages/observable#readme