# @guanghechen/reporter

A minimal, level-based logging utility with colored output and breadcrumb prefix support.

## Design Goals

1. **Simplicity** - Five log levels only (debug, info, hint, warn, error)
2. **Zero Dependencies** - Pure JavaScript, browser/node compatible
3. **Decoupled** - No implicit `process.argv` access, explicit props required
4. **Breadcrumb Prefix** - Hierarchical context via `.attach()` returning detach callback
5. **Lazy Evaluation** - Function arguments for deferred computation
6. **Testable** - Built-in mock mode for capturing logs
7. **Portable** - Injectable output for browser/custom environments

## Non-Goals

- **File logging** - Use shell redirection or custom output
- **Log rotation** - Out of scope
- **Custom formatters** - Fixed format only

---

## Module Structure

```
src/
├── index.ts     # Public exports
├── level.ts     # Log level utilities (LogLevelEnum, isLogLevel, etc.)
├── chalk.ts     # ANSI color codes and formatting
└── reporter.ts  # Reporter class implementation
```

---

## Types

```typescript
type IReporterLevel = 'debug' | 'info' | 'hint' | 'warn' | 'error'

type IReporterOutput = (level: IReporterLevel, parts: string[], args: unknown[]) => void

interface IReporterFlight {
  date?: boolean   // Include ISO timestamp (default: true)
  color?: boolean  // Use ANSI colors (default: true)
}

interface IReporterProps {
  prefix?: string           // Initial prefix, cannot contain ':'
  level?: IReporterLevel    // Minimum log level (default: 'info')
  flight?: IReporterFlight  // Output control
  output?: IReporterOutput  // Custom output function (default: console)
}

interface IReporterEntry {
  level: IReporterLevel
  prefixes: string[]
  args: unknown[]
  date: Date
}
```

---

## Log Levels

```typescript
enum LogLevelEnum {
  debug = 1,
  info = 2,
  hint = 3,
  warn = 4,
  error = 5,
}
```

| Level   | Numeric | Color   | ANSI Code  | Console Method    |
| ------- | ------- | ------- | ---------- | ----------------- |
| `debug` | 1       | Gray    | `\x1b[90m` | `console.debug()` |
| `info`  | 2       | Cyan    | `\x1b[36m` | `console.log()`   |
| `hint`  | 3       | Magenta | `\x1b[35m` | `console.log()`   |
| `warn`  | 4       | Yellow  | `\x1b[33m` | `console.warn()`  |
| `error` | 5       | Red     | `\x1b[31m` | `console.error()` |

Messages are output only if `level >= threshold`.

---

## Exports

### Reporter Class

| Export     | Type    | Description       |
| ---------- | ------- | ----------------- |
| `Reporter` | `class` | Main logger class |

### Level Utilities

| Export            | Type                                             | Description                         |
| ----------------- | ------------------------------------------------ | ----------------------------------- |
| `LogLevelEnum`    | `enum`                                           | Log level enum (debug=1, info=2, …) |
| `LOG_LEVELS`      | `readonly IReporterLevel[]`                      | All valid log levels in order       |
| `LOG_LEVEL_VALUES`| `Record<IReporterLevel, number>`                 | Log level numeric values            |
| `isLogLevel`      | `(value: string) => value is IReporterLevel`     | Type guard for log level            |
| `getLogLevelValue`| `(level: IReporterLevel) => number`              | Get numeric value for log level     |
| `resolveLogLevel` | `(value: string) => IReporterLevel \| undefined` | Case-insensitive log level resolver |

### Chalk Utilities

| Export      | Type                                    | Description                            |
| ----------- | --------------------------------------- | -------------------------------------- |
| `ANSI`      | `Record<string, string>`                | ANSI escape codes for terminal colors  |
| `formatTag` | `(level, prefixes, color) => string`    | Format a tag with optional ANSI colors |

---

## API

### Constructor

```javascript
new Reporter(props?: IReporterProps)
```

| Option         | Type              | Default     | Description                        |
| -------------- | ----------------- | ----------- | ---------------------------------- |
| `prefix`       | `string`          | `undefined` | Initial prefix, cannot contain `:` |
| `level`        | `IReporterLevel`  | `'info'`    | Minimum log level to output        |
| `flight.date`  | `boolean`         | `true`      | Include ISO timestamp              |
| `flight.color` | `boolean`         | `true`      | Use ANSI color codes               |
| `output`       | `IReporterOutput` | (console)   | Custom output function             |

### Methods

| Method                 | Returns            | Description                                               |
| ---------------------- | ------------------ | --------------------------------------------------------- |
| `.attach(prefix)`      | `() => void`       | Push prefix, return detach callback (cannot contain `:`)  |
| `.mock()`              | `this`             | Enable mock mode (capture instead of print)               |
| `.collect()`           | `IReporterEntry[]` | Disable mock mode, return captured logs                   |
| `.log(level, ...args)` | `void`             | Core logging method (invalid level falls back to default) |
| `.debug(...args)`      | `this`             | Log at debug level                                        |
| `.info(...args)`       | `this`             | Log at info level                                         |
| `.hint(...args)`       | `this`             | Log at hint level                                         |
| `.warn(...args)`       | `this`             | Log at warn level                                         |
| `.error(...args)`      | `this`             | Log at error level                                        |

---

## Output Format

```
[timestamp?] [prefixes|level] message...
```

| Segment   | Color       | Description                    |
| --------- | ----------- | ------------------------------ |
| timestamp | Gray (dim)  | ISO 8601 format                |
| `[` `]`   | Gray (dim)  | Brackets                       |
| prefix    | Level color | Each prefix segment            |
| `:`       | Gray (dim)  | Separator between prefixes     |
| message   | Default     | Log content (no color applied) |

Example with `flight.color: true`:

```
2024-01-15T10:30:00.000Z [app:theme] Starting
└──────── dim ─────────┘ ││   ││  │ └─ default
                         ││   │└──┴─ dim
                         │└───┴─ cyan (info level)
                         └─ dim
```

---

## Usage

### Basic

```javascript
import { Reporter } from '@guanghechen/reporter'

const reporter = new Reporter({ prefix: 'app' })

reporter.debug('verbose info')
reporter.info('starting')
reporter.hint('useful tip')
reporter.warn('missing config')
reporter.error('failed:', err)
```

### Breadcrumb Prefix

The `.attach()` method returns a detach callback that restores prefix state:

```javascript
const reporter = new Reporter({ prefix: 'app' })

reporter.info('Starting')                 // [app] Starting

const detach1 = reporter.attach('theme')
reporter.info('Loading')                  // [app:theme] Loading

const detach2 = reporter.attach('apply')
reporter.info('Applying')                 // [app:theme:apply] Applying

detach2()
reporter.info('Applied')                  // [app:theme] Applied

detach1()
reporter.info('Done')                     // [app] Done
```

Without prefix, falls back to level name: `[info]`, `[warn]`, `[error]`.

### Why Detach Callback Instead of `.detach()` Method?

The detach callback design ensures robustness when inner code fails:

```javascript
// Problem with .detach() method:
reporter.attach('a')
reporter.attach('b')
reporter.attach('c')  // Inner code throws, detach never called
// Outer .detach() only pops one prefix - state is corrupted

// Solution with detach callback:
const detach = reporter.attach('a')
reporter.attach('b')
reporter.attach('c')  // Even if inner code fails to detach
detach()              // Restores directly to before 'a', skipping all inner prefixes
```

The callback captures prefix length at attach time. If any outer detach is called, all inner
prefixes are automatically discarded.

### Error-Safe Context Pattern

```javascript
async function processItem(ctx, item) {
  const detach = ctx.reporter.attach('item')
  try {
    ctx.reporter.info('Processing:', item.id)
    await riskyOperation(item)  // May throw
    ctx.reporter.info('Done')
  } finally {
    detach()  // Always restores correctly, regardless of inner attach calls
  }
}
```

### Lazy Evaluation

Function arguments are only called if the log level passes:

```javascript
const reporter = new Reporter({ level: 'info' })

// Never called (debug < info)
reporter.debug(() => expensiveComputation())

// Called only when needed
reporter.info('User:', () => fetchUser(id))
```

### Flight Options

```javascript
// No timestamp
new Reporter({ prefix: 'cli', flight: { date: false } })

// No colors (for file output)
new Reporter({ prefix: 'app', flight: { color: false } })
```

### Custom Output

Inject custom output for browser or testing:

```javascript
// Browser with styled console
const browserOutput = (level, parts, args) => {
  const styles = {
    debug: 'color:gray',
    info: 'color:blue',
    hint: 'color:magenta',
    warn: 'color:orange',
    error: 'color:red',
  }
  console.log(`%c[${level}]`, styles[level], ...args)
}

const reporter = new Reporter({
  prefix: 'app',
  flight: { color: false },
  output: browserOutput,
})
```

### Mock Mode

Capture logs for testing:

```javascript
const reporter = new Reporter({ prefix: 'test', level: 'debug' })

reporter.mock()

reporter.info('Starting')
const detach = reporter.attach('sub')
reporter.warn('Warning!')
detach()

const logs = reporter.collect()

assert.equal(logs.length, 2)
assert.deepEqual(logs[0], {
  level: 'info',
  prefixes: ['test'],
  args: ['Starting'],
  date: /* Date instance */
})
assert.deepEqual(logs[1].prefixes, ['test', 'sub'])
```

### Using Level Utilities

```javascript
import {
  LogLevelEnum,
  LOG_LEVELS,
  isLogLevel,
  resolveLogLevel,
} from '@guanghechen/reporter'

// Check if a string is a valid log level
if (isLogLevel(userInput)) {
  // userInput is narrowed to IReporterLevel
}

// Resolve case-insensitively
resolveLogLevel('DEBUG')  // 'debug'
resolveLogLevel('Info')   // 'info'
resolveLogLevel('invalid') // undefined

// Use enum for comparisons
if (LogLevelEnum[level] >= LogLevelEnum.warn) {
  // This is a warning or error
}

// Iterate all levels
for (const level of LOG_LEVELS) {
  console.log(level)  // 'debug', 'info', 'hint', 'warn', 'error'
}
```
