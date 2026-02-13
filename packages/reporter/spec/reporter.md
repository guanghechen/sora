# @guanghechen/reporter Spec

A minimal, level-based logger with breadcrumb prefix support, runtime reconfiguration, and zero
external dependencies.

## Status

This spec is the contract for package behavior and public API.

## Design Goals

1. Simplicity: keep the API small and explicit.
2. Runtime control: allow dynamic updates for log threshold and output flight options.
3. Portability: run in Node.js and browser environments.
4. Testability: support deterministic capture via mock mode.
5. Safety: prefix stack should be easy to restore even when nested scopes fail.

## Non-Goals

- File sink, rotation, retention, or remote transport.
- Structured JSON logging protocol.
- User-defined formatter pipeline.

## Log Levels

```typescript
enum LogLevelEnum {
  debug = 1,
  info = 2,
  hint = 3,
  warn = 4,
  error = 5,
}

type ILogLevel = 'debug' | 'info' | 'hint' | 'warn' | 'error'
```

| Level   | Numeric | Default Console Method |
| ------- | ------- | ---------------------- |
| `debug` | 1       | `console.debug`        |
| `info`  | 2       | `console.log`          |
| `hint`  | 3       | `console.log`          |
| `warn`  | 4       | `console.warn`         |
| `error` | 5       | `console.error`        |

A record is emitted only when `value(record.level) >= value(threshold)`.

## Public Types

```typescript
type IReporterOutput = (level: ILogLevel, parts: string[], args: unknown[]) => void

interface IReporterFlight {
  date?: boolean
  color?: boolean
}

interface IReporterProps {
  prefix?: string
  level?: ILogLevel
  flight?: IReporterFlight
  output?: IReporterOutput
}

interface IReporterEntry {
  level: ILogLevel
  prefixes: string[]
  args: unknown[]
  date: Date
}

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

## API

### Constructor

```typescript
new Reporter(props?: IReporterProps)
```

| Option         | Type              | Default     | Description                        |
| -------------- | ----------------- | ----------- | ---------------------------------- |
| `prefix`       | `string`          | `undefined` | Initial prefix; cannot contain `:` |
| `level`        | `ILogLevel`       | `'info'`    | Minimum output level               |
| `flight.date`  | `boolean`         | `true`      | Include ISO timestamp              |
| `flight.color` | `boolean`         | `true`      | Enable ANSI coloring               |
| `output`       | `IReporterOutput` | console     | Custom sink                        |

### Methods

| Method                   | Returns            | Description                                       |
| ------------------------ | ------------------ | ------------------------------------------------- |
| `.setLevel(level)`       | `void`             | Replace threshold level                           |
| `.setFlight(flight)`     | `void`             | Update `date/color` flight options                |
| `.attach(prefix)`        | `() => void`       | Push prefix and return detach callback            |
| `.mock()`                | `this`             | Enable capture mode                               |
| `.collect()`             | `IReporterEntry[]` | Leave capture mode and return captured entries    |
| `.log(level, ...args)`   | `void`             | Generic log entry                                 |
| `.debug(...args)`        | `this`             | Sugar for `.log('debug', ...)`                    |
| `.info(...args)`         | `this`             | Sugar for `.log('info', ...)`                     |
| `.hint(...args)`         | `this`             | Sugar for `.log('hint', ...)`                     |
| `.warn(...args)`         | `this`             | Sugar for `.log('warn', ...)`                     |
| `.error(...args)`        | `this`             | Sugar for `.log('error', ...)`                    |

## Runtime Configuration Semantics

### `setLevel(level)`

- Replaces the current threshold immediately.
- Affects only subsequent logs.
- Invalid value handling follows implementation policy.

### `setFlight(flight)`

- Updates runtime output flight options.
- Supports partial update: omitted keys keep previous values.
- Typical usage:

```typescript
reporter.setFlight({ date: false })
reporter.setFlight({ color: false })
reporter.setFlight({ date: true, color: true })
```

- Affects only subsequent logs.
- In mock mode, entries are still captured with `entry.date`; flight controls formatted output only.

## Prefix Model

- Prefix separator is `:`.
- Prefix token cannot contain `:`.
- `attach(prefix)` returns a detach callback that restores the stack length captured at attach time.

Example:

```typescript
const reporter = new Reporter({ prefix: 'app' })

const detachFeature = reporter.attach('feature')
const detachStep = reporter.attach('step')

reporter.info('running')

detachStep()
detachFeature()
```

This callback-based restore avoids stack corruption when nested scopes fail unexpectedly.

## Output Model

When not in mock mode:

1. Resolve lazy arguments (`() => value`) after level filtering.
2. Build `parts`:
   - prepend ISO timestamp when `flight.date === true`
   - append formatted tag from prefix stack; fallback to level tag when no prefix exists
3. Call `output(level, parts, resolvedArgs)`.

Text layout:

```text
[timestamp?] [prefixes|level] ...args
```

When in mock mode:

- Output sink is bypassed.
- Captured entry shape:

```typescript
{
  level: ILogLevel,
  prefixes: string[],
  args: unknown[],
  date: Date,
}
```

## Usage Examples

### Dynamic Level + Flight

```typescript
const reporter = new Reporter({ level: 'info' })

reporter.debug('hidden')
reporter.info('visible')

reporter.setLevel('debug')
reporter.debug('visible now')

reporter.setFlight({ date: false })
reporter.setFlight({ color: false })
reporter.info('plain output')
```

### CLI Integration

```typescript
import { logLevelOption } from '@guanghechen/commander'

.option(logLevelOption)
.option({
  long: 'no-color',
  type: 'boolean',
  args: 'none',
  desc: 'Disable ANSI colors',
  apply: (value, ctx) => {
    if (value) ctx.reporter.setFlight({ color: false })
  },
})
```

### Mock in Tests

```typescript
const reporter = new Reporter({ prefix: 'test', level: 'debug' })

reporter.mock()
reporter.info('start')
reporter.warn('warn')

const entries = reporter.collect()
expect(entries.map(x => x.level)).toEqual(['info', 'warn'])
```
