# Change Log

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
  - @guanghechen/reporter@3.2.0
  - @guanghechen/types@2.2.0
  - @guanghechen/observable@7.1.0
  - @guanghechen/subscriber@2.1.0
  - @guanghechen/task@2.1.0

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 7.0.1 (2025-02-07)

### Improvements

- Clean up build configs and standardize package exports
- Enhance type safety and resource cleanup

### Documentation

- Update README.md

### Miscellaneous

- Add LICENSE file
- Migrate from lerna to changesets

## 7.0.0 (2025-01-15)

### Improvements

- Upgrade to stable release

## 6.0.0-beta.8 (2024-09-19)

**Note:** Version bump only for package @guanghechen/scheduler

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 6.0.0-beta.7 (2024-09-18)

- :rotating_light: improve: fix lint ([3083212](https://github.com/guanghechen/sora/commit/3083212))
- :wrench: chore: upgrade devDependencies and fix configs
  ([230fb63](https://github.com/guanghechen/sora/commit/230fb63))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [6.0.0-beta.6](https://github.com/guanghechen/sora/compare/@guanghechen/scheduler@6.0.0-beta.5...@guanghechen/scheduler@6.0.0-beta.6) (2024-03-10)

**Note:** Version bump only for package @guanghechen/scheduler

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [6.0.0-beta.5](https://github.com/guanghechen/sora/compare/@guanghechen/scheduler@6.0.0-beta.4...@guanghechen/scheduler@6.0.0-beta.5) (2024-03-10)

### Performance Improvements

- 🎨 return 'this' for 'use' method
  ([75418e5](https://github.com/guanghechen/sora/commit/75418e5f98303390874331ba0a407ab1e4eb2e83))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [6.0.0-beta.4](https://github.com/guanghechen/sora/compare/@guanghechen/scheduler@6.0.0-beta.3...@guanghechen/scheduler@6.0.0-beta.4) (2024-03-10)

### Performance Improvements

- :alien: fix due to the change of @guanghechen/observable
  ([7fb9ffa](https://github.com/guanghechen/sora/commit/7fb9ffa35861093cd13eaf96a5b39503a37a70f8))
- 🎨 refaactor observable with subscriber & remove observable.types
  ([bac2118](https://github.com/guanghechen/sora/commit/bac211888713cac920154efb593dbbcf903ab33e))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [6.0.0-beta.3](https://github.com/guanghechen/sora/compare/@guanghechen/scheduler@6.0.0-beta.2...@guanghechen/scheduler@6.0.0-beta.3) (2024-03-10)

### Performance Improvements

- 🎨 format codes
  ([a953c67](https://github.com/guanghechen/sora/commit/a953c67ba19389b6b14bc829361d9ca406c24059))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [6.0.0-beta.2](https://github.com/guanghechen/sora/compare/@guanghechen/scheduler@6.0.0-beta.1...@guanghechen/scheduler@6.0.0-beta.2) (2024-03-09)

### Performance Improvements

- :art: format codes
  ([177eb54](https://github.com/guanghechen/sora/commit/177eb5407fe9209269541a327d42084901a63090))
- :art: refactor scheduler
  ([11609db](https://github.com/guanghechen/sora/commit/11609db3482679ca321829177fee6df05845c51b))
- ✅ update tests
  ([68bbfa0](https://github.com/guanghechen/sora/commit/68bbfa0be78cc9e5b984d4e251186c5e8e5d9156))
- ✅ update tests
  ([25797d2](https://github.com/guanghechen/sora/commit/25797d26a6e5fd26980501a15312d8830998d734))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [6.0.0-beta.1](https://github.com/guanghechen/sora/compare/@guanghechen/scheduler@6.0.0-alpha.29...@guanghechen/scheduler@6.0.0-beta.1) (2024-03-09)

### Performance Improvements

- :art: refactor scheduler & remove scheduler.types
  ([f89cfaf](https://github.com/guanghechen/sora/commit/f89cfaf16308db373e890f285322059589dfed29))
