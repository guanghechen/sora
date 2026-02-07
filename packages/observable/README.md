<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/observable@7.0.0/packages/observable#readme">@guanghechen/observable</a>
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

Observable pattern implementation with ticker functionality for reactive programming. Provides value
change notification with optional delay debouncing and custom equality comparison.

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

### Basic Observable

```typescript
import { Observable } from '@guanghechen/observable'
import { Subscriber } from '@guanghechen/subscriber'

const count = new Observable<number>(0)

const subscriber = new Subscriber({
  onNext: (newValue, oldValue) => {
    console.log(`Value changed from ${oldValue} to ${newValue}`)
  }
})

const unsubscribable = count.subscribe(subscriber)

count.next(1) // "Value changed from 0 to 1"
count.next(2) // "Value changed from 1 to 2"
count.next(2) // No notification (same value)

console.log(count.getSnapshot()) // 2

unsubscribable.unsubscribe()
count.dispose()
```

### Observable with Custom Equality

```typescript
import { Observable } from '@guanghechen/observable'
import { Subscriber } from '@guanghechen/subscriber'

interface IUser {
  id: number
  name: string
}

const user = new Observable<IUser>(
  { id: 1, name: 'John' },
  { equals: (a, b) => a.id === b.id }
)

const subscriber = new Subscriber<IUser>({
  onNext: (value) => console.log('User changed:', value)
})

user.subscribe(subscriber)

// This won't trigger notification (same id)
user.next({ id: 1, name: 'Jane' })

// This will trigger notification (different id)
user.next({ id: 2, name: 'Bob' })

// Force notification even if equal
user.next({ id: 2, name: 'Bob Updated' }, { force: true })
```

### Observable with Delay (Debouncing)

```typescript
import { Observable } from '@guanghechen/observable'
import { Subscriber } from '@guanghechen/subscriber'

// Debounce notifications by 100ms
const search = new Observable<string>('', { delay: 100 })

const subscriber = new Subscriber<string>({
  onNext: (value) => console.log('Search:', value)
})

search.subscribe(subscriber)

// Rapid updates - only the last value will be notified after 100ms
search.next('h')
search.next('he')
search.next('hel')
search.next('hell')
search.next('hello')
// Output after 100ms: "Search: hello"
```

### Ticker

Ticker is a specialized observable that increments a counter value:

```typescript
import { Observable, Ticker } from '@guanghechen/observable'
import { Subscriber } from '@guanghechen/subscriber'

const ticker = new Ticker({ start: 0, delay: 100 })

const subscriber = new Subscriber<number>({
  onNext: (tick) => console.log('Tick:', tick)
})

ticker.subscribe(subscriber)

ticker.tick() // Tick: 1
ticker.tick() // Tick: 2

// Observe other observables - ticker increments when they change
const name = new Observable<string>('John')
const unobservable = ticker.observe(name)

name.next('Jane') // Also triggers: Tick: 3

unobservable.unobserve()
ticker.dispose()
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/observable@7.0.0/packages/observable#readme
