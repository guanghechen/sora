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

A minimal, level-based logger with breadcrumb prefixes, lazy evaluation, and runtime configuration
for both log threshold and output flight options.

## Install

- npm

  ```bash
  npm install --save @guanghechen/reporter
  ```

- yarn

  ```bash
  yarn add @guanghechen/reporter
  ```

## Highlights

- Five levels: `debug`, `info`, `hint`, `warn`, `error`
- Runtime updates: `setLevel()` and `setFlight()`
- Breadcrumb context: `attach()` with detach callback
- Lazy arguments: pass functions for deferred evaluation
- Mock mode: `mock()` + `collect()` for tests
- Custom output: inject your own sink

## Quick Start

```typescript
import { Reporter } from '@guanghechen/reporter'

const reporter = new Reporter({ prefix: 'app', level: 'info' })

reporter.debug('hidden by default threshold')
reporter.info('server started')
reporter.hint('cache warmed')
reporter.warn('deprecated config key')
reporter.error('request failed')
```

## Runtime Configuration

### Change Log Level Dynamically

```typescript
const reporter = new Reporter({ level: 'info' })

reporter.debug('hidden')
reporter.info('visible')

reporter.setLevel('debug')
reporter.debug('visible now')

reporter.setLevel('error')
reporter.warn('hidden again')
reporter.error('still visible')
```

### Change Output Flight Dynamically

```typescript
const reporter = new Reporter({ flight: { date: true, color: true } })

reporter.info('default output')

reporter.setFlight({ date: false })
reporter.info('without timestamp')

reporter.setFlight({ color: false })
reporter.info('without ANSI color')

reporter.setFlight({ date: true, color: true })
reporter.info('restore full output')
```

`setFlight()` is designed for partial updates. Omitted keys keep previous values.

## Breadcrumb Prefixes

```typescript
const reporter = new Reporter({ prefix: 'cli' })

const detachBuild = reporter.attach('build')
const detachAssets = reporter.attach('assets')

reporter.info('processing') // [cli:build:assets] processing

detachAssets()
detachBuild()

reporter.info('done') // [cli] done
```

## Lazy Evaluation

```typescript
const reporter = new Reporter({ level: 'warn' })

reporter.debug(() => JSON.stringify(expensiveData)) // never executed
reporter.warn(() => JSON.stringify(importantData))  // executed
```

## Testing with Mock Mode

```typescript
const reporter = new Reporter({ prefix: 'test', level: 'debug' })

reporter.mock()
reporter.info('start')
reporter.warn('warn')

const entries = reporter.collect()
expect(entries.map(x => x.level)).toEqual(['info', 'warn'])
```

## Output Customization

```typescript
import type { IReporterOutput } from '@guanghechen/reporter'

const output: IReporterOutput = (level, parts, args) => {
  console.log(`[${level}]`, ...parts, ...args)
}

const reporter = new Reporter({
  prefix: 'web',
  flight: { color: false },
  output,
})
```

## API Summary

```typescript
interface IReporter {
  setLevel(level: ILogLevel): void
  setFlight(flight: IReporterFlight): void
  log(level: ILogLevel, ...args: unknown[]): void
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  hint(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}
```

See full specification: [`spec/reporter.md`](./spec/reporter.md)

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/reporter@3.0.0/packages/reporter#readme
