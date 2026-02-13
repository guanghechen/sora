# Change Log

## 2.2.0

### Minor Changes

- ### @guanghechen/reporter
  - feat: add `setLevel` method for dynamic log level change
  - refactor: split source into modular files (`level.ts`, `chalk.ts`, `types.ts`, `reporter.ts`)
  - refactor: move `IReporter` types from `@guanghechen/types` to `@guanghechen/reporter`
  - export: add level utilities (`LogLevelEnum`, `ILogLevel`, `LOG_LEVELS`, `LOG_LEVEL_VALUES`,
    `isLogLevel`, `getLogLevelValue`, `resolveLogLevel`)
  - export: add chalk utilities (`ANSI`, `formatTag`)

  ### @guanghechen/types
  - refactor: remove `IReporter` and `IReporterLevel` exports (moved to `@guanghechen/reporter`)

  ### @guanghechen/commander
  - feat: add predefined options `logLevelOption` and `silentOption` with `apply` callback support
  - refactor: use `ILogLevel` from `@guanghechen/reporter` instead of `IReporterLevel`

  ### Dependent packages
  - chore: bump version for packages depending on `@guanghechen/types`, `@guanghechen/reporter`, or
    `@guanghechen/commander`

## 2.1.0

### Minor Changes

- Add hint log level (debug=1, info=2, hint=3, warn=4, error=5) with magenta color output.

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.0.1 (2025-02-07)

### Improvements

- Fix build configs
- Clean up build configs and standardize package exports

### Documentation

- Update README.md

### Miscellaneous

- Add LICENSE file
- Migrate from lerna to changesets

## 2.0.0 (2025-01-15)

### Features

- Initial stable release: Unified types package consolidating error, disposable, path, subscriber,
  and resource types

### Features

- Add IReporter interface
- Move utility types from std

## 2.0.0 (2026-02-06)

### Features

- ✨ Initial release consolidating types from `@guanghechen/disposable.types`,
  `@guanghechen/error.types`, and `@guanghechen/path.types`
- ✨ Add subscriber types: `ISubscriber`, `ISubscribable`, `ISubscribers`, `IUnsubscribable`
