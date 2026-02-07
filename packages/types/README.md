<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/types@2.0.0/packages/types#readme">@guanghechen/types</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/types">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/types.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/types">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/types.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/types">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/types.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/types"
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

Common type definitions for @guanghechen packages. Provides shared interfaces and types for
disposable resources, error handling, path resolution, logging, and pub-sub patterns.

## Install

- npm

  ```bash
  npm install --save-dev @guanghechen/types
  ```

- yarn

  ```bash
  yarn add --dev @guanghechen/types
  ```

## Usage

### Disposable Types

```typescript
import type { IDisposable, IBatchDisposable } from '@guanghechen/types'

// IDisposable - Resource cleanup interface
class Connection implements IDisposable {
  disposed = false
  dispose(): void {
    this.disposed = true
    // cleanup logic
  }
}

// IBatchDisposable - Manage multiple disposables
class ResourceManager implements IBatchDisposable {
  disposed = false
  registerDisposable<T extends IDisposable>(disposable: T): void {
    // register for batch disposal
  }
  dispose(): void {
    // dispose all registered resources
  }
}
```

### Error Types

```typescript
import type { ISoraError, ISoraErrorCollector } from '@guanghechen/types'
import { ErrorLevelEnum } from '@guanghechen/types'

const error: ISoraError = {
  from: 'my-module',
  level: ErrorLevelEnum.ERROR,
  details: new Error('Something went wrong')
}

// ErrorLevelEnum: WARN = 4, ERROR = 5, FATAL = 6
```

### Path Types

```typescript
import type { IPathResolver, IWorkspacePathResolver } from '@guanghechen/types'

// IPathResolver methods:
// - basename, dirname, join, normalize, relative
// - isAbsolute, ensureAbsolute
// - isSafeRelative, ensureSafeRelative, safeRelative, safeResolve

// IWorkspacePathResolver - Workspace-scoped path operations:
// - root, pathResolver
// - isSafePath, ensureSafePath
// - relative, resolve
```

### Reporter Types

```typescript
import type { IReporter, IReporterLevel } from '@guanghechen/types'

// IReporterLevel: 'debug' | 'info' | 'warn' | 'error'

class Logger implements IReporter {
  log(level: IReporterLevel, ...args: unknown[]): void { /* ... */ }
  debug(...args: unknown[]): void { /* ... */ }
  info(...args: unknown[]): void { /* ... */ }
  warn(...args: unknown[]): void { /* ... */ }
  error(...args: unknown[]): void { /* ... */ }
}
```

### Resource Types

```typescript
import type { IResource, ITextResource } from '@guanghechen/types'

// IResource<T> - Async resource operations
// - exists(): Promise<boolean>
// - load(): Promise<T | undefined>
// - save(data: T): Promise<void>
// - destroy(): Promise<void>

// ITextResource = IResource<string>
```

### Subscriber Types

```typescript
import type {
  ISubscriber,
  ISubscribable,
  ISubscribers,
  IUnsubscribable
} from '@guanghechen/types'

// ISubscriber<T> - Receives notifications, extends IDisposable
// ISubscribable<T> - Can be subscribed to
// IUnsubscribable - Can unsubscribe from notifications
// ISubscribers<T> - Manages multiple subscribers
```

### Utility Types

```typescript
import type { Diff, Mutable, PickPartial, PromiseOr } from '@guanghechen/types'

// Diff<T, U> - Remove properties in U from T
type OnlyInA = Diff<{ a: 1; b: 2 }, { b: 2 }> // { a: 1 }

// Mutable<T> - Remove readonly from all properties
type MutableUser = Mutable<{ readonly name: string }> // { name: string }

// PickPartial<T, K> - Make specific properties optional
type PartialName = PickPartial<{ name: string; age: number }, 'name'>
// { name?: string; age: number }

// PromiseOr<T> - Value or Promise of value
type MaybeAsync = PromiseOr<string> // string | Promise<string>
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/types@2.0.0/packages/types#readme
