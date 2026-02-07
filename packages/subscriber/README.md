<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/subscriber@2.0.0/packages/subscriber#readme">@guanghechen/subscriber</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/subscriber">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/subscriber.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/subscriber">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/subscriber.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/subscriber">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/subscriber.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/subscriber"
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

Publisher-subscriber pattern implementation with disposable subscription support. Provides
`Subscriber` for individual subscriptions and `Subscribers` for managing multiple subscriptions.

## Install

- npm

  ```bash
  npm install --save @guanghechen/subscriber
  ```

- yarn

  ```bash
  yarn add @guanghechen/subscriber
  ```

## Usage

### Subscriber

Individual subscriber with lifecycle callbacks:

```typescript
import { Subscriber } from '@guanghechen/subscriber'

const subscriber = new Subscriber<number>({
  onNext: (value, prevValue) => {
    console.log(`Value changed from ${prevValue} to ${value}`)
  },
  onDispose: () => {
    console.log('Subscriber disposed')
  }
})

// Notify with new value
subscriber.next(42, undefined)  // "Value changed from undefined to 42"
subscriber.next(100, 42)        // "Value changed from 42 to 100"

// Check disposed state
console.log(subscriber.disposed) // false

// Dispose the subscriber
subscriber.dispose()             // "Subscriber disposed"
console.log(subscriber.disposed) // true

// Notifications are ignored after dispose
subscriber.next(200, 100)        // (no output)
```

### Subscribers

Manage multiple subscriptions:

```typescript
import { Subscriber, Subscribers } from '@guanghechen/subscriber'

const subscribers = new Subscribers<string>()

// Add subscribers
const sub1 = new Subscriber<string>({
  onNext: (value) => console.log('Sub1:', value)
})
const sub2 = new Subscriber<string>({
  onNext: (value) => console.log('Sub2:', value)
})

const unsub1 = subscribers.subscribe(sub1)
const unsub2 = subscribers.subscribe(sub2)

console.log(subscribers.size) // 2

// Notify all subscribers
subscribers.notify('Hello', undefined)
// "Sub1: Hello"
// "Sub2: Hello"

// Unsubscribe individual subscriber
unsub1.unsubscribe()
console.log(subscribers.size) // 1

subscribers.notify('World', 'Hello')
// "Sub2: World"

// Dispose all remaining subscribers
subscribers.dispose()
console.log(subscribers.disposed) // true
```

### With Observable

Typically used with `@guanghechen/observable`:

```typescript
import { Observable } from '@guanghechen/observable'
import { Subscriber } from '@guanghechen/subscriber'

const count = new Observable<number>(0)

const subscriber = new Subscriber<number>({
  onNext: (value, prevValue) => {
    console.log(`Count: ${prevValue} -> ${value}`)
  }
})

const unsubscribable = count.subscribe(subscriber)

count.next(1) // "Count: 0 -> 1"
count.next(2) // "Count: 1 -> 2"

unsubscribable.unsubscribe()
count.next(3) // (no output)
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/subscriber@2.0.0/packages/subscriber#readme
