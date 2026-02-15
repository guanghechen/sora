# Change Log

## 7.1.1

### Patch Changes

- chore: vitest config auto-load aliases and coverage thresholds; style/doc formatting updates

## 7.1.0

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

### Patch Changes

- Updated dependencies:
  - @guanghechen/types@2.2.0

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 7.0.1 (2025-02-07)

### Documentation

- Update README.md

### Miscellaneous

- Add LICENSE file
- Remove unused workspace dependencies
- Migrate from lerna to changesets

## 7.0.0 (2025-01-15)

### Breaking Changes

- Require name parameter in constructor
- Rename package from event-bus to eventbus

### Improvements

- Switch to recommended ESLint stack
