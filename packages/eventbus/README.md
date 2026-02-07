<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/eventbus@7.0.0/packages/eventbus#readme">@guanghechen/eventbus</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/eventbus">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/eventbus.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/eventbus">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/eventbus.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/eventbus">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/eventbus.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/eventbus"
      />
    </a>
    <a href="https://github.com/vitest-dev/vitest">
      <img
        alt="Tested with Vitest"
        src="https://img.shields.io/badge/tested_with-vitest-6e9f18.svg"
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

A simple event bus with disposable support.

## Features

- Type-specific listeners (`on`/`once`) and global subscribers (`subscribe`)
- Returns `IUnsubscribable` for easy cleanup
- Implements `IBatchDisposable` for resource management
- Exception isolation: one handler's error won't stop other handlers
- Alias methods: `off` for `removeListener`, `emit` for `dispatch`
- `listenerCount()` to get the number of listeners

## Install

- npm

  ```bash
  npm install --save @guanghechen/eventbus
  ```

- yarn

  ```bash
  yarn add @guanghechen/eventbus
  ```

## Usage

```typescript
import type { IEvent, IEventHandler } from '@guanghechen/eventbus'
import { EventBus } from '@guanghechen/eventbus'

enum EventTypes {
  INIT = 'INIT',
  EXIT = 'EXIT',
}

const eventBus = new EventBus<EventTypes>('my-bus')

const handle: IEventHandler<EventTypes> = (evt, eventBus): void => {
  console.log('evt:', evt)
}

// Listen for specific event, returns IUnsubscribable
const unsub1 = eventBus.on(EventTypes.INIT, handle)

// Listen for specific event, auto-removed after first call
const unsub2 = eventBus.once(EventTypes.INIT, handle)

// Subscribe to all events
const unsub3 = eventBus.subscribe(handle)

// Dispatch an event
eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
// Or use alias
eventBus.emit({ type: EventTypes.INIT, payload: { id: 1 } })

// Remove listener
eventBus.off(EventTypes.INIT, handle)
// Or use unsubscribable
unsub1.unsubscribe()

// Get listener count
console.log(eventBus.listenerCount()) // all listeners + subscribers
console.log(eventBus.listenerCount(EventTypes.INIT)) // only INIT listeners

// Cleanup all listeners and subscribers
eventBus.cleanup()

// Dispose the event bus (also disposes registered disposables)
eventBus.dispose()
```

## API

### `EventBus<T>`

| Method                              | Description                                           |
| ----------------------------------- | ----------------------------------------------------- |
| `on(type, handle)`                  | Listen for a specific event type                      |
| `once(type, handle)`                | Listen for a specific event type, auto-removed        |
| `off(type, handle)`                 | Remove a listener (alias of `removeListener`)         |
| `removeListener(type, handle)`      | Remove a listener                                     |
| `subscribe(handle, once?)`          | Subscribe to all events                               |
| `unsubscribe(handle)`               | Cancel a subscription                                 |
| `dispatch(evt)`                     | Dispatch an event                                     |
| `emit(evt)`                         | Dispatch an event (alias of `dispatch`)               |
| `listenerCount(type?)`              | Get listener count                                    |
| `cleanup()`                         | Remove all listeners and subscribers                  |
| `dispose()`                         | Dispose the event bus                                 |
| `registerDisposable(disposable)`    | Register a disposable to be disposed with the bus     |

## Reference

- [homepage][homepage]

[homepage]: https://github.com/guanghechen/sora/tree/@guanghechen/eventbus@7.0.0/packages/eventbus#readme
