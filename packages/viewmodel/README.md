<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/viewmodel@1.0.6/packages/viewmodel#readme">@guanghechen/viewmodel</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/viewmodel">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/viewmodel.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/viewmodel">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/viewmodel.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/viewmodel">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/viewmodel.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/viewmodel"
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

Reactive viewmodel implementation with observable state management and computed properties.

## Install

- npm

  ```bash
  npm install --save @guanghechen/viewmodel
  ```

- yarn

  ```bash
  yarn add @guanghechen/viewmodel
  ```

## Usage

|        Name         |                        Description                        |
| :-----------------: | :-------------------------------------------------------: |
|    `ViewModel`      |     Abstract base class for reactive view models         |
|      `State`        |     Observable state with React-like setState API        |
|     `Computed`      |     Computed values derived from other observables       |
|  `ObservableMap`    |     Observable immutable map with change notifications   |
|  `ObservableSet`    |     Observable immutable set with change notifications   |

## Examples

### Basic ViewModel

```typescript
import { ViewModel, State } from '@guanghechen/viewmodel'
import { Subscriber } from '@guanghechen/subscriber'

class CounterViewModel extends ViewModel {
  public readonly count$ = new State<number>(0)
  public readonly message$ = new State<string>('Hello')

  constructor() {
    super()
    this.registerDisposable(this.count$)
    this.registerDisposable(this.message$)
  }

  public increment(): void {
    this.count$.updateState(prev => prev + 1)
  }

  public setMessage(msg: string): void {
    this.message$.updateState(msg)
  }
}

const viewModel = new CounterViewModel()

// Subscribe to state changes
const subscriber = new Subscriber({
  onNext: (count) => console.log('Count:', count)
})
viewModel.count$.subscribe(subscriber)

viewModel.increment() // Output: "Count: 1"
viewModel.increment() // Output: "Count: 2"
```

### Computed Properties

```typescript
import { ViewModel, State, Computed } from '@guanghechen/viewmodel'

class UserViewModel extends ViewModel {
  public readonly firstName$ = new State<string>('John')
  public readonly lastName$ = new State<string>('Doe')
  public readonly fullName$: Computed<string>

  constructor() {
    super()
    this.registerDisposable(this.firstName$)
    this.registerDisposable(this.lastName$)

    // Create computed property
    this.fullName$ = Computed.fromObservables(
      [this.firstName$, this.lastName$],
      ([first, last]) => `${first} ${last}`
    )
  }

  public setFirstName(name: string): void {
    this.firstName$.updateState(name)
  }

  public setLastName(name: string): void {
    this.lastName$.updateState(name)
  }
}

const userVM = new UserViewModel()
console.log(userVM.fullName$.getSnapshot()) // "John Doe"

userVM.setFirstName('Jane')
console.log(userVM.fullName$.getSnapshot()) // "Jane Doe"
```

### Observable Collections

```typescript
import { ViewModel, ObservableMap, ObservableSet } from '@guanghechen/viewmodel'
import { Map, Set } from 'immutable'

class TodoViewModel extends ViewModel {
  public readonly todos$ = new ObservableMap<string, Todo>(Map())
  public readonly tags$ = new ObservableSet<string>(Set())

  constructor() {
    super()
    this.registerDisposable(this.todos$)
    this.registerDisposable(this.tags$)
  }

  public addTodo(id: string, todo: Todo): void {
    this.todos$.set(id, todo)
  }

  public removeTodo(id: string): void {
    this.todos$.delete(id)
  }

  public addTag(tag: string): void {
    this.tags$.add(tag)
  }

  public addMultipleTags(tags: string[]): void {
    this.tags$.addAll(tags)
  }
}

interface Todo {
  title: string
  completed: boolean
}
```

### State with React-like API

```typescript
import { State } from '@guanghechen/viewmodel'

const userState = new State({ name: 'John', age: 30 })

// React-like setState with function
userState.setState(prev => ({ ...prev, age: prev.age + 1 }))

// Direct state update
userState.updateState({ name: 'Jane', age: 25 })

// Subscribe to changes
const unsubscribe = userState.subscribeStateChange(() => {
  console.log('State changed:', userState.getSnapshot())
})

// React integration helpers
const snapshot = userState.getSnapshot()      // For client-side
const serverSnapshot = userState.getServerSnapshot() // For SSR
```

### ViewModel Ticker (Advanced)

```typescript
import { ViewModel, State } from '@guanghechen/viewmodel'
import { Subscriber } from '@guanghechen/subscriber'

class DashboardViewModel extends ViewModel {
  public readonly users$ = new State<number>(0)
  public readonly orders$ = new State<number>(0)
  public readonly revenue$ = new State<number>(0)

  constructor() {
    super()
    this.registerDisposable(this.users$)
    this.registerDisposable(this.orders$)
    this.registerDisposable(this.revenue$)
  }

  public observeMetrics(): void {
    // Create ticker that combines multiple observables
    const metricsTicker = this.ticker(['users$', 'orders$', 'revenue$'])
    
    const subscriber = new Subscriber({
      onNext: () => {
        const metrics = {
          users: this.users$.getSnapshot(),
          orders: this.orders$.getSnapshot(),
          revenue: this.revenue$.getSnapshot()
        }
        console.log('Metrics updated:', metrics)
      }
    })
    
    metricsTicker.ticker.subscribe(subscriber)
  }

  public updateMetrics(users: number, orders: number, revenue: number): void {
    this.users$.updateState(users)
    this.orders$.updateState(orders)
    this.revenue$.updateState(revenue)
  }
}
```


[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/viewmodel@1.0.6/packages/viewmodel#readme