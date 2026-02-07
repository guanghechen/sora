<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/reporter@3.0.0/packages/reporter#readme">@guanghechen/reporter</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/reporter">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/reporter.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/reporter">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/reporter.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/reporter">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/reporter.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/reporter"
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

A minimal, level-based logging utility with colored output and breadcrumb prefix support. Provides
debug, info, warn, and error levels with optional ISO timestamps and ANSI colors.

## Install

- npm

  ```bash
  npm install --save @guanghechen/reporter
  ```

- yarn

  ```bash
  yarn add @guanghechen/reporter
  ```

## Usage

### Basic Logging

```typescript
import { Reporter } from '@guanghechen/reporter'

const reporter = new Reporter({ prefix: 'app' })

reporter.debug('Debug message')  // Only shown when level is 'debug'
reporter.info('Server started')  // 2024-01-15T10:30:00.000Z [app] Server started
reporter.warn('Deprecated API')  // Yellow warning
reporter.error('Failed to connect') // Red error
```

### Log Levels

```typescript
import { Reporter } from '@guanghechen/reporter'

// Only show warnings and errors
const reporter = new Reporter({ level: 'warn' })

reporter.debug('Not shown')
reporter.info('Not shown')
reporter.warn('Shown')
reporter.error('Shown')
```

### Breadcrumb Prefixes

Use `attach()` to add nested context prefixes:

```typescript
import { Reporter } from '@guanghechen/reporter'

const reporter = new Reporter({ prefix: 'app' })

function processUser(userId: string) {
  const detach = reporter.attach('user')
  const detachId = reporter.attach(userId)

  reporter.info('Processing') // [app:user:123] Processing

  detachId()
  detach()
}

processUser('123')
reporter.info('Done') // [app] Done
```

### Configuration Options

```typescript
import { Reporter } from '@guanghechen/reporter'

const reporter = new Reporter({
  prefix: 'myapp',       // Initial prefix
  level: 'info',         // Minimum log level: 'debug' | 'info' | 'warn' | 'error'
  flight: {
    date: true,          // Include ISO timestamp (default: true)
    color: true,         // Use ANSI colors (default: true)
  },
  output: (level, parts, args) => {
    // Custom output handler
    console.log(`[${level}]`, ...parts, ...args)
  }
})
```

### Testing with Mock

Capture log entries for testing:

```typescript
import { Reporter } from '@guanghechen/reporter'

const reporter = new Reporter({ prefix: 'test' })

// Start capturing
reporter.mock()

reporter.info('Message 1')
reporter.warn('Message 2')

// Collect and stop capturing
const entries = reporter.collect()

console.log(entries)
// [
//   { level: 'info', prefixes: ['test'], args: ['Message 1'], date: Date },
//   { level: 'warn', prefixes: ['test'], args: ['Message 2'], date: Date }
// ]
```

### Lazy Evaluation

Pass functions to defer expensive operations:

```typescript
import { Reporter } from '@guanghechen/reporter'

const reporter = new Reporter({ level: 'warn' })

// Function only called if level passes threshold
reporter.debug(() => JSON.stringify(expensiveObject))
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/reporter@3.0.0/packages/reporter#readme
