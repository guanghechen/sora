# Change Log

## 2.1.0

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
  - @guanghechen/disposable@2.1.0

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.0.1 (2025-02-07)

### Improvements

- Clean up build configs and standardize package exports

### Documentation

- Update README.md

### Miscellaneous

- Add LICENSE file
- Migrate from lerna to changesets

## 2.0.0 (2025-01-15)

### Breaking Changes

- Move subscriber types to @guanghechen/types

### Improvements

- Switch to recommended ESLint stack

## 1.0.0-alpha.2 (2024-09-18)

- :rotating_light: improve: fix lint ([3083212](https://github.com/guanghechen/sora/commit/3083212))
- :wrench: chore: upgrade devDependencies and fix configs
  ([230fb63](https://github.com/guanghechen/sora/commit/230fb63))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 1.0.0-alpha.1 (2024-03-10)

### Features

- ✨ add @guanghechen/subscriber
  ([ba57528](https://github.com/guanghechen/sora/commit/ba575283cd159e21896dfab062eff0b5da216757))
